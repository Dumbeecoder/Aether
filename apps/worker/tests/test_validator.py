from agentx_worker.indexer.validator import normalize_registration_file


def test_full_valid_registration_file():
    raw = {
        "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        "name": "LiquidGuard AI",
        "description": "Liquidation protection",
        "image": "https://example.com/avatar.png",
        "services": [
            {
                "name": "A2A",
                "endpoint": "https://agent.example/.well-known/agent-card.json",
                "version": "0.3.0",
                "capabilities": ["health_factor_monitoring", "liquidation_alerts"],
            }
        ],
        "registrations": [],
        "supportedTrust": ["reputation"],
    }
    result = normalize_registration_file(raw)
    assert result.is_registration_file
    assert result.name == "LiquidGuard AI"
    assert result.capabilities == ["health_factor_monitoring", "liquidation_alerts"]
    assert len(result.services) == 1
    assert result.services[0].valid
    assert result.warnings == []


def test_missing_fields_are_valid_not_errors():
    # Spec Section 7: missing info is valid, not malformed.
    raw = {"name": "Bare Agent"}
    result = normalize_registration_file(raw)
    assert result.name == "Bare Agent"
    assert result.description is None
    assert result.capabilities == []
    assert result.services == []


def test_non_http_endpoint_rejected_but_agent_survives():
    raw = {
        "name": "Weird Agent",
        "services": [{"name": "ftp-thing", "endpoint": "ftp://example.com/agent"}],
    }
    result = normalize_registration_file(raw)
    assert result.name == "Weird Agent"
    assert len(result.services) == 1
    assert not result.services[0].valid
    assert any("not http(s)" in w for w in result.warnings)


def test_non_dict_payload_does_not_raise():
    result = normalize_registration_file(["not", "an", "object"])
    assert result.name is None
    assert not result.is_registration_file
    assert result.warnings


def test_capabilities_are_deduped_across_services():
    raw = {
        "name": "Multi Service Agent",
        "services": [
            {"name": "A2A", "endpoint": "https://a.example/x", "capabilities": ["swap"]},
            {"name": "MCP", "endpoint": "https://b.example/y", "capabilities": ["swap", "quote"]},
        ],
    }
    result = normalize_registration_file(raw)
    assert result.capabilities == ["swap", "quote"]


def test_malformed_service_entry_does_not_crash_whole_agent():
    raw = {"name": "Agent", "services": ["not-a-dict", {"endpoint": "https://ok.example/x"}]}
    result = normalize_registration_file(raw)
    assert len(result.services) == 2
    assert not result.services[0].valid
    assert result.services[1].valid
