"""CLI: python -m agentx_worker.indexer --chain 97 [--from-block N] [--watch] [--dry-run]"""

from __future__ import annotations

import argparse
import logging
import sys
import time

from web3 import Web3

from agentx_worker.config import chain_preset, settings

from .checkpoint import InMemoryCheckpointStore, SupabaseCheckpointStore
from .store import InMemoryAgentStore, SupabaseAgentStore
from .sync import run_sync

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("agentx_worker.indexer")


def _build_stores(dry_run: bool):
    if dry_run or not (settings.supabase_url and settings.supabase_service_role_key):
        if not dry_run:
            logger.warning(
                "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — falling back to "
                "in-memory stores (nothing will persist). Pass --dry-run to silence this."
            )
        return InMemoryCheckpointStore(), InMemoryAgentStore()

    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return SupabaseCheckpointStore(client), SupabaseAgentStore(client)


def resolve_rpc_url(configured_rpc_url: str | None, preset_rpc_url: str) -> str:
    """Which RPC endpoint to actually connect to: prefer an operator-
    supplied `RPC_URL` (`settings.rpc_url`) over the chain preset's public
    RPC. Pulled out as its own function specifically so this preference
    order is unit-testable without spinning up a real Web3 connection —
    see tests/test_cli_rpc_selection.py for the regression test covering
    the bug this fixes (preset RPC was used unconditionally, ignoring any
    configured RPC_URL, which caused public-RPC rate limiting)."""
    return configured_rpc_url or preset_rpc_url


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m agentx_worker.indexer")
    parser.add_argument("--chain", type=int, default=settings.indexer_chain_id)
    parser.add_argument("--from-block", type=int, default=None, help="required on first run")
    parser.add_argument("--to-block", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=settings.indexer_batch_size)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--watch", action="store_true", help="continuous incremental sync")
    args = parser.parse_args(argv)

    preset = chain_preset(args.chain)
    rpc_url = resolve_rpc_url(settings.rpc_url, str(preset["rpc_url"]))
    if settings.rpc_url:
        logger.info("Using RPC_URL from settings for chain %s: %s", args.chain, rpc_url)
    else:
        logger.info(
            "No RPC_URL configured — falling back to the public preset RPC for chain %s: %s. "
            "This is prone to rate limiting on any real indexing run; set RPC_URL to a dedicated provider.",
            args.chain,
            rpc_url,
        )
    web3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
    if not web3.is_connected():
        logger.error("Could not connect to RPC %s for chain %s", rpc_url, args.chain)
        return 1

    checkpoint_store, agent_store = _build_stores(args.dry_run)

    if args.from_block is None and checkpoint_store.get(args.chain, str(preset["identity_registry"])) is None:
        parser.error("--from-block is required on first run (no checkpoint exists yet)")

    def _run_once() -> None:
        results = run_sync(
            web3=web3,
            identity_registry=str(preset["identity_registry"]),
            chain_id=args.chain,
            checkpoint_store=checkpoint_store,
            agent_store=agent_store,
            start_block=args.from_block or 0,
            batch_size=args.batch_size,
            confirmation_depth=settings.indexer_confirmation_depth,
            to_block=args.to_block,
            dry_run=args.dry_run,
        )
        for r in results:
            logger.info(
                "blocks %s-%s: %d events, %d agents upserted, %d metadata failures, "
                "%d skipped malformed",
                r.from_block, r.to_block, r.events_seen, r.agents_upserted,
                r.metadata_failures, r.skipped_malformed,
            )

    _run_once()

    if args.watch:
        if args.dry_run:
            logger.warning("--watch with --dry-run will re-scan the same range forever; "
                            "use one or the other")
        logger.info("Entering watch mode, polling every %ds", settings.indexer_poll_interval_seconds)
        while True:
            time.sleep(settings.indexer_poll_interval_seconds)
            args.from_block = None  # resume from checkpoint on subsequent iterations
            _run_once()

    return 0


if __name__ == "__main__":
    sys.exit(main())
