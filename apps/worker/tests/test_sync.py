from types import SimpleNamespace
from unittest.mock import patch

from agentx_worker.indexer.events import DecodedEvent
from agentx_worker.indexer.store import InMemoryAgentStore
from agentx_worker.indexer.sync import sync_range

REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e"


class _FakeWeb3:
    def __init__(self, logs, block_timestamp=1_700_000_000):
        self.eth = SimpleNamespace(
            get_logs=lambda params: logs,
            get_block=lambda n: {"timestamp": block_timestamp},
        )


def _fake_contract():
    # sync_range only touches contract.address and passes `contract` through
    # to decode_log/get_registry_contract-derived calls, which we patch out
    # below — a bare namespace is enough.
    return SimpleNamespace(address=REGISTRY, functions=SimpleNamespace(
        getAgentWallet=lambda agent_id: (_ for _ in ()).throw(RuntimeError("no wallet call in test"))
    ))


def test_dry_run_never_writes_to_the_store():
    web3 = _FakeWeb3(logs=[{"raw": 1}])
    store = InMemoryAgentStore()

    decoded = DecodedEvent(
        event_name="Registered", agent_id="1",
        args={"agentURI": "data:application/json;base64,e30=", "owner": "0xOwner"},
        block_number=100, tx_hash="0xabc", log_index=0,
    )

    with patch("agentx_worker.indexer.sync.get_registry_contract", return_value=_fake_contract()), \
         patch("agentx_worker.indexer.sync.decode_log", return_value=decoded):
        result = sync_range(web3, REGISTRY, 97, 100, 100, store, dry_run=True)

    assert result.events_seen == 1
    assert len(store.agents) == 0
    assert len(store.event_log) == 0


def test_one_malformed_event_does_not_kill_the_batch():
    web3 = _FakeWeb3(logs=[{"raw": 1}, {"raw": 2}])
    store = InMemoryAgentStore()

    good = DecodedEvent(
        event_name="Registered", agent_id="1",
        args={"agentURI": "data:application/json;base64,e30=", "owner": "0xOwner"},
        block_number=100, tx_hash="0xgood", log_index=0,
    )
    # A "Transfer" event whose `to` address is malformed enough to blow up
    # int(from_addr, 16) in the handler.
    bad = DecodedEvent(
        event_name="Transfer", agent_id="2",
        args={"to": "0xNew", "from": "not-a-hex-address"},
        block_number=101, tx_hash="0xbad", log_index=0,
    )

    calls = iter([good, bad])

    with patch("agentx_worker.indexer.sync.get_registry_contract", return_value=_fake_contract()), \
         patch("agentx_worker.indexer.sync.decode_log", side_effect=lambda c, log: next(calls)):
        result = sync_range(web3, REGISTRY, 97, 100, 101, store, dry_run=False)

    assert result.events_seen == 2
    assert result.agents_upserted == 1
    assert result.skipped_malformed == 1
    # the good agent still made it into the store despite the bad one failing
    assert (97, "1") in store.agents
