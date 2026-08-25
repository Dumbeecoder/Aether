"""Endpoint health checking.

Per spec Section 11: verify *availability*, not agent behavior. This sends
a plain GET/HEAD and looks at the response — it never sends the endpoint an
A2A/MCP task payload, since that would mean "health checking" an agent
actually executes something. Reuses the same SSRF-safe IP resolution as the
metadata resolver, since agent-declared endpoints are exactly as untrusted
as agent-declared metadata URIs.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests

from agentx_worker.config import settings

from .resolver import _safe_resolve_ip  # reuse the vetted SSRF check

HealthState = str  # "online" | "degraded" | "offline" | "unknown"


@dataclass
class HealthResult:
    status: HealthState
    status_code: int | None
    response_time_ms: int | None
    checked_at: datetime
    error: str | None = None


def check_endpoint(url: str) -> HealthResult:
    now = datetime.now(timezone.utc)
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return HealthResult("unknown", None, None, now, error="unsupported endpoint scheme")

    safe_ip = _safe_resolve_ip(parsed.hostname)
    if safe_ip is None:
        return HealthResult(
            "unknown", None, None, now,
            error="endpoint resolves to a private/reserved address, refusing to probe",
        )

    netloc = f"{safe_ip}:{parsed.port}" if parsed.port else safe_ip
    safe_url = parsed._replace(netloc=netloc).geturl()

    start = time.monotonic()
    try:
        resp = requests.get(
            safe_url,
            timeout=settings.indexer_health_check_timeout_seconds,
            allow_redirects=False,
            headers={"Host": parsed.hostname},
        )
        elapsed_ms = int((time.monotonic() - start) * 1000)
        if 200 <= resp.status_code < 300:
            status: HealthState = "online"
        elif 300 <= resp.status_code < 500:
            status = "degraded"  # reachable but not a clean 2xx
        else:
            status = "offline"
        return HealthResult(status, resp.status_code, elapsed_ms, now)
    except requests.exceptions.Timeout:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return HealthResult("offline", None, elapsed_ms, now, error="timeout")
    except Exception as e:  # noqa: BLE001 - never let a bad endpoint kill the indexer
        return HealthResult("offline", None, None, now, error=str(e))


def should_check(last_checked: datetime | None) -> bool:
    """Rate limiting: don't re-probe an endpoint more often than the
    configured interval, so we don't hammer agent servers."""
    if last_checked is None:
        return True
    age = (datetime.now(timezone.utc) - last_checked).total_seconds()
    return age >= settings.indexer_health_check_interval_seconds
