"""Idempotent persistence for indexed agents.

Two hard guarantees the tests in test_store.py check for:

1. Running the same event twice must not create duplicate rows. Every
   write is an upsert on a natural key (agent_id+chain_id for `agents`;
   agent_id+capability for `agent_capabilities`; etc — see the Phase 2
   migration for the actual unique constraints).
2. Provenance must never be downgraded. On-chain facts (owner_wallet,
   registration_tx_hash, registration_block, agent_id, chain_id) come
   exclusively from decoded events in this indexer, so they can't be
   overwritten by a weaker source by construction. Metadata-derived fields
   (name/description/image) are only overwritten when *this* run
   successfully resolved metadata — a resolution failure never blanks out
   a previously-good value.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from .slugs import build_slug
from .validator import NormalizedAgent


@dataclass
class AgentIdentity:
    chain_id: int
    agent_id: str
    identity_registry: str
    owner_wallet: str
    agent_wallet: str | None
    registration_tx_hash: str
    registration_block: int
    registration_timestamp: datetime | None


@dataclass
class AgentWrite:
    identity: AgentIdentity
    agent_uri: str
    normalized: NormalizedAgent | None  # None if metadata resolution failed this run
    endpoint_status_summary: str = "unknown"


class AgentStore(Protocol):
    def upsert_agent(self, write: AgentWrite) -> str: ...  # returns internal row id
    def record_event(self, chain_id: int, contract_address: str, event_name: str,
                      agent_id: str, block_number: int, tx_hash: str, log_index: int,
                      payload: dict) -> None: ...
    def update_owner(self, chain_id: int, agent_id: str, new_owner: str) -> None: ...


class InMemoryAgentStore:
    """Test double. Mirrors the natural-key upsert semantics of the real
    Supabase store without needing a live project."""

    def __init__(self) -> None:
        self.agents: dict[tuple[int, str], dict[str, Any]] = {}
        self.events: set[tuple[int, str, str, int]] = set()  # dedup key
        self.event_log: list[dict] = []

    def upsert_agent(self, write: AgentWrite) -> str:
        key = (write.identity.chain_id, write.identity.agent_id)
        existing = self.agents.get(key, {})

        category = "other"
        capabilities: list[str] = []
        name = existing.get("name")
        description = existing.get("description")
        image = existing.get("image")
        services: list[dict] = existing.get("services", [])

        if write.normalized is not None:
            from .categorizer import categorize

            name = write.normalized.name or name
            description = write.normalized.description or description
            image = write.normalized.image or image
            capabilities = write.normalized.capabilities
            services = [
                {"name": s.name, "endpoint": s.endpoint, "version": s.version}
                for s in write.normalized.services
                if s.valid
            ]
            category = categorize(name, description, capabilities)
        else:
            category = existing.get("category", "other")
            capabilities = existing.get("capabilities", [])

        row = {
            # onchain_fact fields — always sourced from the decoded event,
            # never from metadata, so no downgrade path exists here.
            "chain_id": write.identity.chain_id,
            "agent_id": write.identity.agent_id,
            "identity_registry": write.identity.identity_registry,
            "owner_wallet": write.identity.owner_wallet,
            "agent_wallet": write.identity.agent_wallet,
            "registration_tx_hash": write.identity.registration_tx_hash,
            "registration_block": write.identity.registration_block,
            "registration_timestamp": write.identity.registration_timestamp,
            "agent_uri": write.agent_uri,
            # agent_provided / best-effort fields
            "name": name,
            "description": description,
            "image": image,
            "services": services,
            "capabilities": capabilities,
            "category": category,
            "slug": existing.get("slug") or build_slug(
                name, write.identity.chain_id, write.identity.agent_id
            ),
            "identity_verified": True,  # we only reach here via a decoded on-chain event
            "metadata_resolved": write.normalized is not None,
            "last_indexed_at": datetime.now(timezone.utc),
        }
        self.agents[key] = row
        return f"{key[0]}:{key[1]}"

    def record_event(self, chain_id, contract_address, event_name, agent_id,
                      block_number, tx_hash, log_index, payload) -> None:
        dedup_key = (chain_id, tx_hash, event_name, log_index)
        if dedup_key in self.events:
            return  # idempotent: already recorded
        self.events.add(dedup_key)
        self.event_log.append({
            "chain_id": chain_id,
            "contract_address": contract_address,
            "agent_id": agent_id,
            "event_name": event_name,
            "block_number": block_number,
            "tx_hash": tx_hash,
            "log_index": log_index,
            "payload": payload,
        })

    def update_owner(self, chain_id: int, agent_id: str, new_owner: str) -> None:
        key = (chain_id, agent_id)
        if key in self.agents:
            self.agents[key]["owner_wallet"] = new_owner


class SupabaseAgentStore:
    """Real implementation. Upserts against the natural keys created in the
    Phase 2 migration (see supabase/migrations/0002_indexer.sql)."""

    def __init__(self, client) -> None:
        self._client = client

    def upsert_agent(self, write: AgentWrite) -> str:
        from .categorizer import categorize

        existing_resp = (
            self._client.table("agents")
            .select("id,name,description,image,slug,category")
            .eq("chain_id", write.identity.chain_id)
            .eq("agent_id", write.identity.agent_id)
            .limit(1)
            .execute()
        )
        existing = existing_resp.data[0] if existing_resp.data else None

        name = (write.normalized.name if write.normalized else None) or (
            existing["name"] if existing else None
        )
        description = (write.normalized.description if write.normalized else None) or (
            existing["description"] if existing else None
        )
        image = (write.normalized.image if write.normalized else None) or (
            existing["image"] if existing else None
        )
        capabilities = write.normalized.capabilities if write.normalized else (
            existing.get("capabilities", []) if existing else []
        )
        category = (
            categorize(name, description, capabilities)
            if write.normalized is not None
            else (existing["category"] if existing else "other")
        )
        slug = (existing["slug"] if existing else None) or build_slug(
            name, write.identity.chain_id, write.identity.agent_id
        )

        row = {
            "chain_id": write.identity.chain_id,
            "agent_id": write.identity.agent_id,
            "wallet_address": write.identity.agent_wallet or write.identity.owner_wallet,
            "name": name or f"Agent #{write.identity.agent_id}",
            "slug": slug,
            "description": description,
            "description_provenance": "agent_provided",
            "avatar_url": image,
            "category": category,
            "data_source": "onchain",
            "identity_registry": write.identity.identity_registry,
            "owner_wallet": write.identity.owner_wallet,
            "registration_tx_hash": write.identity.registration_tx_hash,
            "registration_block": write.identity.registration_block,
            "registration_timestamp": (
                write.identity.registration_timestamp.isoformat()
                if write.identity.registration_timestamp
                else None
            ),
            "identity_verified": True,
            "last_indexed_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = (
            self._client.table("agents")
            .upsert(row, on_conflict="agent_id,chain_id")
            .execute()
        )
        row_id = resp.data[0]["id"]

        if write.normalized is not None:
            for svc in write.normalized.services:
                if not svc.valid:
                    continue
                self._client.table("agent_endpoints").upsert(
                    {
                        "agent_id": row_id,
                        "endpoint": svc.endpoint,
                        "endpoint_type": svc.name or "unknown",
                        "source": "agent_metadata",
                        "status": "unknown",
                    },
                    on_conflict="agent_id,endpoint",
                ).execute()
            for cap in write.normalized.capabilities:
                self._client.table("agent_capabilities").upsert(
                    {
                        "agent_id": row_id,
                        "capability": cap,
                        "provenance": "agent_provided",
                    },
                    on_conflict="agent_id,capability",
                ).execute()

        return row_id

    def record_event(self, chain_id, contract_address, event_name, agent_id,
                      block_number, tx_hash, log_index, payload) -> None:
        self._client.table("agent_events").upsert(
            {
                "chain_id": chain_id,
                "contract_address": contract_address.lower(),
                "agent_id": agent_id,
                "event_name": event_name,
                "block_number": block_number,
                "tx_hash": tx_hash,
                "log_index": log_index,
                "payload": payload,
            },
            on_conflict="chain_id,tx_hash,log_index",
        ).execute()

    def update_owner(self, chain_id: int, agent_id: str, new_owner: str) -> None:
        self._client.table("agents").update({"owner_wallet": new_owner}).eq(
            "chain_id", chain_id
        ).eq("agent_id", agent_id).execute()
