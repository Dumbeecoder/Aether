from datetime import datetime, timezone

from agentx_worker.indexer.checkpoint import InMemoryCheckpointStore
from agentx_worker.indexer.store import AgentIdentity, AgentWrite, InMemoryAgentStore
from agentx_worker.indexer.validator import normalize_registration_file

REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e"


def _identity(agent_id="18291", owner="0xOwner") -> AgentIdentity:
    return AgentIdentity(
        chain_id=97,
        agent_id=agent_id,
        identity_registry=REGISTRY,
        owner_wallet=owner,
        agent_wallet=None,
        registration_tx_hash="0xabc",
        registration_block=100,
        registration_timestamp=datetime.now(tz=timezone.utc),
    )


def test_upsert_agent_is_idempotent():
    store = InMemoryAgentStore()
    normalized = normalize_registration_file({"name": "LiquidGuard AI", "description": "x"})
    write = AgentWrite(identity=_identity(), agent_uri="data:...", normalized=normalized)

    row_id_1 = store.upsert_agent(write)
    row_id_2 = store.upsert_agent(write)

    assert row_id_1 == row_id_2
    assert len(store.agents) == 1


def test_metadata_resolution_failure_does_not_blank_previous_good_data():
    store = InMemoryAgentStore()
    good = normalize_registration_file({"name": "LiquidGuard AI", "description": "Real desc"})
    store.upsert_agent(AgentWrite(identity=_identity(), agent_uri="data:...", normalized=good))

    # Simulate a later URIUpdated event whose metadata failed to resolve.
    store.upsert_agent(AgentWrite(identity=_identity(), agent_uri="data:...", normalized=None))

    row = store.agents[(97, "18291")]
    assert row["name"] == "LiquidGuard AI"
    assert row["description"] == "Real desc"
    assert row["metadata_resolved"] is False


def test_record_event_deduplicates_on_tx_hash_and_log_index():
    store = InMemoryAgentStore()
    kwargs = {
        "chain_id": 97, "contract_address": REGISTRY, "event_name": "Registered",
        "agent_id": "18291", "block_number": 100, "tx_hash": "0xabc", "log_index": 0,
        "payload": {"owner": "0xOwner"},
    }
    store.record_event(**kwargs)
    store.record_event(**kwargs)  # simulate re-processing the same block range

    assert len(store.event_log) == 1


def test_update_owner_reflects_transfer_event():
    store = InMemoryAgentStore()
    normalized = normalize_registration_file({"name": "Agent"})
    store.upsert_agent(AgentWrite(identity=_identity(owner="0xOld"), agent_uri="d", normalized=normalized))

    store.update_owner(97, "18291", "0xNew")

    assert store.agents[(97, "18291")]["owner_wallet"] == "0xNew"


def test_checkpoint_store_is_monotonic():
    cp = InMemoryCheckpointStore()
    cp.set(97, REGISTRY, 100)
    cp.set(97, REGISTRY, 50)  # stale/out-of-order write must not move cursor backwards

    assert cp.get(97, REGISTRY) == 100


def test_checkpoint_store_resumes_from_last_value():
    cp = InMemoryCheckpointStore()
    assert cp.get(97, REGISTRY) is None
    cp.set(97, REGISTRY, 200)
    assert cp.get(97, REGISTRY) == 200
