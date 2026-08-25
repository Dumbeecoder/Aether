"""Aether worker entrypoint.

Phase 1 scope: service skeleton + health check only. The ERC-8004 indexer,
reference agents (ERC-8183 providers), and any settlement logic land in
Phase 2 / Phase 6 respectively, after Phase 2 research into whether BNB
Agent Studio's own auto_settle covers our providers (spec Section 14) —
we deliberately did not scaffold a custom settle-poller here.

This app is internal-only. `/health` is unauthenticated (for the process
supervisor / uptime check); every other route requires
X-Internal-Api-Key to match WORKER_INTERNAL_API_KEY.
"""

from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException

from agentx_worker.config import settings

app = FastAPI(title="agentx-worker", version="0.1.0")


def require_internal_auth(x_internal_api_key: str | None = Header(default=None)) -> None:
    if not settings.worker_internal_api_key:
        # Fail closed: an unset key means auth can't be enforced, so refuse
        # rather than silently allow every caller.
        raise HTTPException(status_code=503, detail="worker auth not configured")
    if x_internal_api_key != settings.worker_internal_api_key:
        raise HTTPException(status_code=401, detail="invalid or missing internal api key")


@app.get("/health")
def health() -> dict:
    return {
        "service": "agentx-worker",
        "status": "ok",
        "network": settings.network,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
