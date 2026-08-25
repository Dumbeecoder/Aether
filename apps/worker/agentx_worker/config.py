"""Configuration for the Aether worker.

The worker is internal-only: it must never be reachable from the public
internet directly, and it never handles user private keys — only keys for
Aether's own reference/demo agents (Phase 6). All values are optional at
import time so `uvicorn agentx_worker.main:app` can boot for a health check
before Supabase/chain config exists; individual features validate their own
required settings when first used.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Service-to-service auth: the Next.js server includes this header on
    # any internal request to the worker. The worker rejects requests
    # without a matching key. Never exposed to the browser.
    worker_internal_api_key: str | None = None

    # BNB network / bnbagent SDK config
    network: str = "bsc-testnet"
    rpc_url: str | None = None
    erc8004_registry_address: str | None = None
    erc8183_commerce_address: str | None = None
    erc8183_router_address: str | None = None
    erc8183_policy_address: str | None = None

    # Supabase (service role — server-side only)
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    # Demo/reference agent wallets. Never the user's.
    wallet_password: str | None = None

    # Indexer (Phase 2)
    indexer_chain_id: int = 97
    indexer_batch_size: int = 2000
    indexer_confirmation_depth: int = 15  # blocks to wait before treating an event as final
    indexer_poll_interval_seconds: int = 12
    indexer_metadata_timeout_seconds: int = 10
    indexer_max_metadata_bytes: int = 512_000
    indexer_health_check_timeout_seconds: int = 8
    indexer_health_check_interval_seconds: int = 900  # don't hammer endpoints


settings = Settings()

# Per-chain presets, verified against bnbagent==0.3.6's NETWORKS table
# (apps/worker source of truth: pinned SDK version, re-check on any bump).
CHAIN_PRESETS: dict[int, dict[str, str | int]] = {
    97: {
        "name": "bsc-testnet",
        "rpc_url": "https://data-seed-prebsc-2-s2.binance.org:8545",
        "identity_registry": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    },
    56: {
        "name": "bsc-mainnet",
        "rpc_url": "https://bsc-dataseed.binance.org",
        "identity_registry": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    },
}


def chain_preset(chain_id: int) -> dict[str, str | int]:
    try:
        return CHAIN_PRESETS[chain_id]
    except KeyError:
        raise ValueError(
            f"Unsupported chain_id {chain_id}. Supported: {sorted(CHAIN_PRESETS)}"
        ) from None
