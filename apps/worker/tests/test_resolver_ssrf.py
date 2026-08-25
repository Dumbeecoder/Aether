"""SSRF protection tests. Per spec Section 26: these must reject
localhost/private/reserved ranges and cloud-metadata hosts."""
import base64
import json

from agentx_worker.indexer.resolver import _safe_resolve_ip, resolve_agent_uri


def _data_uri(obj: dict) -> str:
    return "data:application/json;base64," + base64.b64encode(
        json.dumps(obj).encode()
    ).decode()


def test_data_uri_resolves():
    result = resolve_agent_uri(_data_uri({"name": "Test Agent", "description": "hi"}))
    assert result.ok
    assert result.data["name"] == "Test Agent"
    assert result.source == "data_uri"


def test_data_uri_malformed_base64_fails_gracefully():
    result = resolve_agent_uri("data:application/json;base64,not-valid-base64!!!")
    assert not result.ok
    assert result.error


def test_empty_uri_fails():
    result = resolve_agent_uri("")
    assert not result.ok


def test_unsupported_scheme_rejected():
    # ipfs:// is deliberately unsupported per Phase 0/2 research findings
    result = resolve_agent_uri("ipfs://Qmabc123")
    assert not result.ok
    assert "unsupported" in result.error


def test_localhost_rejected():
    assert _safe_resolve_ip("localhost") is None


def test_loopback_ip_rejected():
    assert _safe_resolve_ip("127.0.0.1") is None


def test_private_ipv4_rejected():
    assert _safe_resolve_ip("10.0.0.1") is None
    assert _safe_resolve_ip("192.168.1.1") is None
    assert _safe_resolve_ip("172.16.0.1") is None


def test_cloud_metadata_ip_rejected():
    assert _safe_resolve_ip("169.254.169.254") is None


def test_cgnat_range_rejected():
    assert _safe_resolve_ip("100.64.0.1") is None


def test_http_scheme_with_blocked_hostname_rejected():
    result = resolve_agent_uri("http://metadata.google.internal/agent.json")
    assert not result.ok
    assert "blocked hostname" in result.error
