"""Deterministic keyword categorizer.

Phase 2 scope only (spec Section 14): no embeddings, no LLM. Phase 4 can
swap this out for semantic classification behind the same
``categorize(name, description, capabilities) -> str`` signature.
"""

from __future__ import annotations

CATEGORIES = ("monitoring", "trading", "risk", "yield", "pancakeswap", "other")

# Order matters: first matching category wins. PancakeSwap-specific signal
# is checked first since a PancakeSwap liquidity bot might also mention
# "yield" or "monitoring" — the protocol-specific track takes precedence
# per spec Section 14/16.
_KEYWORDS: dict[str, tuple[str, ...]] = {
    "pancakeswap": ("pancakeswap", "pancake swap", "cake token", "pancake router"),
    "risk": (
        "liquidation", "health factor", "risk", "collateral", "insurance",
        "safety", "protect",
    ),
    "yield": (
        "yield", "farming", "apy", "apr", "vault", "liquidity provision",
        "lp management", "compound",
    ),
    "monitoring": (
        "monitor", "alert", "watch", "track wallet", "whale", "notify",
    ),
    "trading": (
        "trading", "trade", "arbitrage", "grid trading", "dca",
        "dollar cost averaging", "execution", "swap",
    ),
}


def categorize(name: str | None, description: str | None, capabilities: list[str]) -> str:
    haystack = " ".join(
        filter(None, [name or "", description or "", " ".join(capabilities)])
    ).lower()
    if not haystack.strip():
        return "other"
    for category, keywords in _KEYWORDS.items():
        if any(kw in haystack for kw in keywords):
            return category
    return "other"
