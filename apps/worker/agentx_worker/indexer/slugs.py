"""Stable, human-readable slugs for /agents/[slug].

Base slug comes from the agent name (slugified). Collisions and unnamed
agents fall back to a deterministic `<base>-<chain_id>-<agent_id>` suffix,
so the URL never depends on mutable metadata and never collides — the
suffix is the on-chain identity itself.
"""

from __future__ import annotations

import re

_SLUG_STRIP_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    s = _SLUG_STRIP_RE.sub("-", text.lower()).strip("-")
    return s or "agent"


def build_slug(name: str | None, chain_id: int, agent_id: str) -> str:
    base = slugify(name) if name else "agent"
    return f"{base}-{chain_id}-{agent_id}"
