"""Decodes raw eth_getLogs entries against the watched ERC-8004 events."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from web3.contract import Contract

from .abi import WATCHED_EVENTS


@dataclass
class DecodedEvent:
    event_name: str
    agent_id: str  # kept as str: uint256 can exceed safe JS/Postgres int ranges
    args: dict[str, Any]
    block_number: int
    tx_hash: str
    log_index: int


def decode_log(contract: Contract, log: dict) -> DecodedEvent | None:
    """Try each watched event's ABI against a raw log. Returns None if the
    log doesn't match any of them (e.g. it's an Approval/Transfer-adjacent
    event we don't care about, or noise from a differently-shaped log)."""
    for event_name in WATCHED_EVENTS:
        event = getattr(contract.events, event_name)
        try:
            decoded = event().process_log(log)
        except Exception:  # noqa: BLE001, S112 - a log that doesn't match this event's ABI is expected, not an error
            continue  # try the next candidate event in WATCHED_EVENTS
        args = dict(decoded["args"])
        agent_id_raw = args.get("agentId", args.get("tokenId"))
        if agent_id_raw is None:
            continue
        return DecodedEvent(
            event_name=event_name,
            agent_id=str(agent_id_raw),
            args=args,
            block_number=decoded["blockNumber"],
            tx_hash=decoded["transactionHash"].hex(),
            log_index=decoded["logIndex"],
        )
    return None


def get_topics(contract: Contract) -> dict[str, str]:
    """Event-name -> topic0 hash, for building an eth_getLogs filter that
    only asks the RPC for the events we watch instead of every log emitted
    by the registry contract."""
    return {name: getattr(contract.events, name)().topic for name in WATCHED_EVENTS}
