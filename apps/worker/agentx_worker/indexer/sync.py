"""Orchestrates one indexing pass: fetch logs in batches, decode, resolve
metadata, normalize, persist, and advance the checkpoint.

Deliberately NOT "get all agents -> insert everything" (spec Section 2):
every batch is bounded by ``batch_size`` blocks, capped at
``latest_block - confirmation_depth`` so we never treat a block that could
still be reorganized as final, and the checkpoint only advances after a
batch's writes succeed — a crash mid-batch re-processes that batch (safe,
because every write is an idempotent upsert) rather than skipping it.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from web3 import Web3

from .abi import get_registry_contract
from .checkpoint import CheckpointStore
from .events import decode_log
from .resolver import resolve_agent_uri
from .store import AgentIdentity, AgentStore, AgentWrite
from .validator import normalize_registration_file

logger = logging.getLogger(__name__)

_MAX_RPC_RETRIES = 4
_RETRY_BASE_DELAY = 1.0


@dataclass
class SyncResult:
    from_block: int
    to_block: int
    events_seen: int
    agents_upserted: int
    metadata_failures: int
    skipped_malformed: int


def _get_logs_with_retry(web3: Web3, contract, from_block: int, to_block: int) -> list[dict]:
    last_err: Exception | None = None
    for attempt in range(_MAX_RPC_RETRIES):
        try:
            return web3.eth.get_logs(
                {
                    "fromBlock": from_block,
                    "toBlock": to_block,
                    "address": contract.address,
                }
            )
        except Exception as e:  # noqa: BLE001 - RPCs fail in many ways, all retryable here
            last_err = e
            delay = _RETRY_BASE_DELAY * (2**attempt)
            logger.warning(
                "get_logs(%s, %s) failed (attempt %d/%d): %s — retrying in %.1fs",
                from_block, to_block, attempt + 1, _MAX_RPC_RETRIES, e, delay,
            )
            time.sleep(delay)
    raise RuntimeError(f"get_logs failed after {_MAX_RPC_RETRIES} attempts") from last_err


def _handle_registered_or_uri_updated(
    web3: Web3,
    contract,
    identity_registry: str,
    chain_id: int,
    decoded,
    store: AgentStore,
) -> tuple[bool, bool]:
    """Returns (agent_upserted, metadata_failed)."""
    agent_uri = decoded.args.get("agentURI") or decoded.args.get("newURI")
    owner = decoded.args.get("owner")

    resolved = resolve_agent_uri(agent_uri) if agent_uri else None
    normalized = None
    metadata_failed = False
    if resolved is None:
        metadata_failed = True
    elif not resolved.ok:
        logger.info("agent #%s metadata resolution failed: %s", decoded.agent_id, resolved.error)
        metadata_failed = True
    else:
        normalized = normalize_registration_file(resolved.data)
        for w in normalized.warnings:
            logger.info("agent #%s metadata warning: %s", decoded.agent_id, w)

    agent_wallet = None
    if owner is not None:
        # Best-effort enrichment call; never fatal if it fails (RPC hiccup,
        # or the registry doesn't separate agent wallet from NFT owner).
        try:
            agent_wallet = contract.functions.getAgentWallet(int(decoded.agent_id)).call()
        except Exception:  # noqa: BLE001
            agent_wallet = None

    block = web3.eth.get_block(decoded.block_number)
    identity = AgentIdentity(
        chain_id=chain_id,
        agent_id=decoded.agent_id,
        identity_registry=identity_registry,
        owner_wallet=owner or "",
        agent_wallet=agent_wallet,
        registration_tx_hash=decoded.tx_hash,
        registration_block=decoded.block_number,
        registration_timestamp=datetime.fromtimestamp(block["timestamp"], tz=timezone.utc),
    )
    write = AgentWrite(identity=identity, agent_uri=agent_uri or "", normalized=normalized)
    store.upsert_agent(write)
    return True, metadata_failed


def sync_range(
    web3: Web3,
    identity_registry: str,
    chain_id: int,
    from_block: int,
    to_block: int,
    store: AgentStore,
    dry_run: bool = False,
) -> SyncResult:
    contract = get_registry_contract(web3, identity_registry)
    logs = _get_logs_with_retry(web3, contract, from_block, to_block)

    events_seen = 0
    agents_upserted = 0
    metadata_failures = 0
    skipped_malformed = 0

    for log in logs:
        decoded = decode_log(contract, log)
        if decoded is None:
            continue  # not one of our watched events (shouldn't happen, address-filtered)
        events_seen += 1

        if dry_run:
            logger.info(
                "[dry-run] would process %s for agent #%s (block %s, tx %s)",
                decoded.event_name, decoded.agent_id, decoded.block_number, decoded.tx_hash,
            )
            continue

        try:
            store.record_event(
                chain_id=chain_id,
                contract_address=identity_registry,
                event_name=decoded.event_name,
                agent_id=decoded.agent_id,
                block_number=decoded.block_number,
                tx_hash=decoded.tx_hash,
                log_index=decoded.log_index,
                payload={k: str(v) for k, v in decoded.args.items()},
            )

            if decoded.event_name in ("Registered", "URIUpdated"):
                upserted, failed = _handle_registered_or_uri_updated(
                    web3, contract, identity_registry, chain_id, decoded, store
                )
                agents_upserted += int(upserted)
                metadata_failures += int(failed)
            elif decoded.event_name == "Transfer":
                to_addr = decoded.args.get("to")
                from_addr = decoded.args.get("from")
                if to_addr and from_addr and int(from_addr, 16) != 0:
                    # Skip the mint transfer (from == 0x0) — that's already
                    # captured by the Registered event's `owner` field.
                    store.update_owner(chain_id, decoded.agent_id, to_addr)
            elif decoded.event_name == "MetadataSet":
                # On-chain key/value metadata. Phase 2 records it in
                # agent_events for audit; folding individual keys into the
                # agent profile is deferred — see known limitations.
                pass
        except Exception as e:  # noqa: BLE001 - one bad agent must not kill the batch
            skipped_malformed += 1
            logger.error(
                "Skipped malformed event for agent #%s (%s): %s",
                decoded.agent_id, decoded.event_name, e,
            )
            continue

    return SyncResult(
        from_block=from_block,
        to_block=to_block,
        events_seen=events_seen,
        agents_upserted=agents_upserted,
        metadata_failures=metadata_failures,
        skipped_malformed=skipped_malformed,
    )


def run_sync(
    web3: Web3,
    identity_registry: str,
    chain_id: int,
    checkpoint_store: CheckpointStore,
    agent_store: AgentStore,
    start_block: int,
    batch_size: int,
    confirmation_depth: int,
    to_block: int | None = None,
    dry_run: bool = False,
) -> list[SyncResult]:
    """Runs historical sync from the checkpoint (or start_block) up to
    `to_block` (or the current safe tip). Advances the checkpoint after
    each successful batch."""
    cursor = checkpoint_store.get(chain_id, identity_registry)
    from_block = (cursor + 1) if cursor is not None else start_block

    latest = web3.eth.block_number
    safe_tip = latest - confirmation_depth
    target = min(to_block, safe_tip) if to_block is not None else safe_tip

    results: list[SyncResult] = []
    while from_block <= target:
        batch_to = min(from_block + batch_size - 1, target)
        result = sync_range(
            web3, identity_registry, chain_id, from_block, batch_to, agent_store, dry_run
        )
        results.append(result)
        if not dry_run:
            checkpoint_store.set(chain_id, identity_registry, batch_to)
        from_block = batch_to + 1

    return results
