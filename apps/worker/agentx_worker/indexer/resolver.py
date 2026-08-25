"""Resolves an ERC-8004 agentURI to its registration-file JSON.

Per Phase 0/2 research against the pinned bnbagent==0.3.6 SDK
(``bnbagent.erc8004.agent.ERC8004Agent.parse_agent_uri``), only two URI
schemes are actually supported by the reference implementation:

- ``data:application/json;base64,...`` — self-contained, no network fetch
- ``http://`` / ``https://`` — fetched with SSRF protection

We deliberately do NOT add ipfs:// or any other scheme here. The SDK uses
IPFS elsewhere (ERC-8183 deliverables via IPFSStorageProvider) but never for
agentURI resolution — adding it here would be scope creep not backed by the
actual protocol implementation we're indexing against.

The SSRF protection logic below mirrors the SDK's own implementation:
resolve the hostname once, reject private/loopback/link-local/reserved/CGNAT
ranges and known cloud-metadata hosts, then issue the request against the
resolved IP directly (with the original Host header) to prevent a second
DNS lookup — e.g. via a redirect or TOCTOU DNS rebinding — from landing on
a different, internal address.
"""

from __future__ import annotations

import base64
import concurrent.futures
import ipaddress
import json
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

import requests

from agentx_worker.config import settings

_BLOCKED_HOSTNAMES = {
    "metadata.google.internal",
    "metadata.goog",
    "169.254.169.254",
}
# RFC 6598 CGNAT range — covers Alibaba Cloud / some cloud providers'
# metadata services that sit outside RFC 1918 private space.
_CGNAT_NETWORK = ipaddress.ip_network("100.64.0.0/10")


@dataclass
class ResolvedMetadata:
    ok: bool
    data: dict | None = None
    source: str | None = None  # "data_uri" | "http"
    error: str | None = None


def resolve_agent_uri(agent_uri: str) -> ResolvedMetadata:
    """Resolve an agentURI to parsed JSON. Never raises."""
    if not agent_uri:
        return ResolvedMetadata(ok=False, error="empty agentURI")

    if agent_uri.startswith("data:application/json;base64,"):
        return _resolve_data_uri(agent_uri)

    if agent_uri.startswith(("http://", "https://")):
        return _resolve_http(agent_uri)

    return ResolvedMetadata(ok=False, error=f"unsupported agentURI scheme: {agent_uri[:24]!r}")


def _resolve_data_uri(agent_uri: str) -> ResolvedMetadata:
    try:
        b64 = agent_uri.split(",", 1)[1]
        raw = base64.b64decode(b64)
        if len(raw) > settings.indexer_max_metadata_bytes:
            return ResolvedMetadata(ok=False, error="data URI exceeds max metadata size")
        return ResolvedMetadata(ok=True, data=json.loads(raw.decode("utf-8")), source="data_uri")
    except Exception as e:  # noqa: BLE001 - resolver must never raise into the indexer loop
        return ResolvedMetadata(ok=False, error=f"invalid data URI: {e}")


def _safe_resolve_ip(hostname: str) -> str | None:
    """Resolve hostname to a single non-private IP, or None if unsafe/unresolvable."""

    def _resolve():
        return socket.getaddrinfo(hostname, None)

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            resolved = pool.submit(_resolve).result(timeout=5)
    except (concurrent.futures.TimeoutError, socket.gaierror, ValueError, OSError):
        return None

    for _, _, _, _, sockaddr in resolved:
        ip = ipaddress.ip_address(sockaddr[0])
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            continue
        if str(ip) == "169.254.169.254" or ip in _CGNAT_NETWORK:
            continue
        return str(ip)
    return None


def _resolve_http(agent_uri: str) -> ResolvedMetadata:
    parsed = urlparse(agent_uri)
    hostname = parsed.hostname
    if not hostname:
        return ResolvedMetadata(ok=False, error="URL has no hostname")
    if hostname.lower() in _BLOCKED_HOSTNAMES:
        return ResolvedMetadata(ok=False, error="blocked hostname (cloud metadata)")

    safe_ip = _safe_resolve_ip(hostname)
    if safe_ip is None:
        return ResolvedMetadata(ok=False, error="hostname resolves to a private/reserved IP")

    netloc = f"{safe_ip}:{parsed.port}" if parsed.port else safe_ip
    safe_url = parsed._replace(netloc=netloc).geturl()

    try:
        resp = requests.get(
            safe_url,
            timeout=settings.indexer_metadata_timeout_seconds,
            allow_redirects=False,  # a redirect could repoint at an internal host
            headers={"Host": hostname},
            stream=True,
        )
        resp.raise_for_status()
        content_length = resp.headers.get("Content-Length")
        if content_length and int(content_length) > settings.indexer_max_metadata_bytes:
            return ResolvedMetadata(ok=False, error="response exceeds max metadata size")
        chunks = bytearray()
        for chunk in resp.iter_content(chunk_size=8192):
            if not chunk:
                continue
            chunks.extend(chunk)
            if len(chunks) > settings.indexer_max_metadata_bytes:
                return ResolvedMetadata(ok=False, error="response exceeds max metadata size")
        return ResolvedMetadata(
            ok=True, data=json.loads(chunks.decode("utf-8")), source="http"
        )
    except Exception as e:  # noqa: BLE001
        return ResolvedMetadata(ok=False, error=f"fetch failed: {e}")
