import type { AIProvider, AgentSearchIntent } from "../types";
import { emptyIntent } from "../types";
import type { AgentCategory } from "../../agents";

/**
 * No-LLM fallback: used whenever no AI provider is configured, or whenever
 * the configured provider fails (network error, bad response, rate limit).
 * Mirrors the exact keyword taxonomy the Python indexer uses to categorize
 * agents in the first place (`apps/worker/agentx_worker/indexer/
 * categorizer.py`) so a query and an agent's category are judged against
 * the same vocabulary — this is what makes `category` extraction here
 * meaningful rather than a coincidence.
 *
 * This is not a lesser "fake AI" — it's an honest, fully deterministic
 * substitute so search still works with zero external dependencies, and
 * its output is held to exactly the same provenance bar (Section 1: never
 * invent agents or metrics — this provider only ever extracts intent, same
 * as the LLM-backed one).
 */
const CATEGORY_KEYWORDS: Record<Exclude<AgentCategory, "other">, string[]> = {
  pancakeswap: ["pancakeswap", "pancake swap", "cake token", "pancake router"],
  risk: [
    "liquidation",
    "health factor",
    "risk",
    "collateral",
    "insurance",
    "safety",
    "protect",
    "safe",
  ],
  yield: ["yield", "farming", "apy", "apr", "vault", "liquidity provision", "lp management", "compound"],
  monitoring: ["monitor", "alert", "watch", "track wallet", "whale", "notify"],
  trading: ["trading", "trade", "arbitrage", "grid trading", "dca", "dollar cost averaging", "execution", "swap"],
};

// Display names, not just lowercase match keys — audit finding: naive
// capitalization ("pancakeswap" -> "Pancakeswap") matched correctly
// (comparisons are case-insensitive in matchScore.ts) but looked wrong
// when shown back to the user in the "Understood as" panel.
const PROTOCOL_DISPLAY_NAMES: Record<string, string> = {
  pancakeswap: "PancakeSwap",
  venus: "Venus",
  aave: "Aave",
  compound: "Compound",
};
const PROTOCOL_KEYWORDS = Object.keys(PROTOCOL_DISPLAY_NAMES);

const RISK_KEYWORDS: [level: "low" | "medium" | "high", words: string[]][] = [
  ["low", ["safe", "conservative", "low risk", "cautious"]],
  ["high", ["aggressive", "high risk", "high-risk", "risky"]],
];

function extractCategory(text: string): AgentCategory | null {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return category as AgentCategory;
  }
  return null;
}

function extractProtocol(text: string): string | null {
  const hit = PROTOCOL_KEYWORDS.find((p) => text.includes(p));
  return hit ? (PROTOCOL_DISPLAY_NAMES[hit] ?? hit) : null;
}

function extractRisk(text: string): "low" | "medium" | "high" | null {
  for (const [level, words] of RISK_KEYWORDS) {
    if (words.some((w) => text.includes(w))) return level;
  }
  return null;
}

function extractCapabilities(text: string, category: AgentCategory | null): string[] {
  // Coarse-grained: reuse category keywords actually present in the query
  // as capability hints. This is deliberately conservative — a fallback
  // parser overreaching into fine-grained capability inference would just
  // be guessing, which Section 1 explicitly forbids.
  if (!category || category === "other") return [];
  return CATEGORY_KEYWORDS[category].filter((kw) => text.includes(kw));
}

export class KeywordFallbackProvider implements AIProvider {
  readonly name = "keyword-fallback";

  async parseAgentSearchIntent(query: string): Promise<AgentSearchIntent> {
    const text = query.toLowerCase();
    if (!text.trim()) return emptyIntent();

    const category = extractCategory(text);
    return {
      category,
      capabilities: extractCapabilities(text, category),
      protocol: extractProtocol(text),
      budget: null, // no reliable number extraction without an LLM — never guess
      risk: extractRisk(text),
    };
  }
}
