"""Indexer block-cursor checkpointing.

Backed by the `indexer_checkpoints` table (unique on chain_id +
contract_address) so a crashed/restarted indexer resumes from the last
confirmed block instead of re-scanning from genesis or, worse, silently
skipping a range. ``InMemoryCheckpointStore`` exists purely for unit tests
that don't have a live Supabase project.
"""

from __future__ import annotations

from typing import Protocol


class CheckpointStore(Protocol):
    def get(self, chain_id: int, contract_address: str) -> int | None: ...
    def set(self, chain_id: int, contract_address: str, block_number: int) -> None: ...


class InMemoryCheckpointStore:
    def __init__(self) -> None:
        self._data: dict[tuple[int, str], int] = {}

    def get(self, chain_id: int, contract_address: str) -> int | None:
        return self._data.get((chain_id, contract_address.lower()))

    def set(self, chain_id: int, contract_address: str, block_number: int) -> None:
        key = (chain_id, contract_address.lower())
        current = self._data.get(key)
        # Monotonic: never let a stale/out-of-order write move the cursor backwards.
        if current is None or block_number > current:
            self._data[key] = block_number


class SupabaseCheckpointStore:
    """Thin wrapper around a `supabase.Client`. Table: indexer_checkpoints."""

    def __init__(self, client) -> None:
        self._client = client

    def get(self, chain_id: int, contract_address: str) -> int | None:
        resp = (
            self._client.table("indexer_checkpoints")
            .select("last_processed_block")
            .eq("chain_id", chain_id)
            .eq("contract_address", contract_address.lower())
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0]["last_processed_block"] if rows else None

    def set(self, chain_id: int, contract_address: str, block_number: int) -> None:
        self._client.table("indexer_checkpoints").upsert(
            {
                "chain_id": chain_id,
                "contract_address": contract_address.lower(),
                "last_processed_block": block_number,
            },
            on_conflict="chain_id,contract_address",
        ).execute()
