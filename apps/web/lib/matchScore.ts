/**
 * Match Score — "does this agent fit THIS request?" Deterministic,
 * query-dependent, entirely separate from Aether Score (query-independent,
 * see docs/SCORING.md's "Aether Score vs Match Score" section). The AI
 * provider only ever produces the `AgentSearchIntent` this scores against —
 * it never sees or influences the score itself (spec Section 1: the LLM
 * does not rank agents).
 *
 * Same missing-data discipline as Aether Score: a component the intent
 * didn't specify (e.g. no protocol mentioned) is excluded and the rest
 * renormalize — never scored as a 0, which would wrongly penalize an agent
 * for a criterion the user never asked about.
 */

import type { AgentSearchIntent } from "./ai/types";
import type { SearchCandidate } from "./agents";

export interface MatchComponent {
  key: string;
  label: string;
  weight: number;
  value: number | null;
}

export interface MatchScoreResult {
  status: "matched" | "unscoreable";
  score: number | null; // 0-100
  components: MatchComponent[];
}

const WEIGHTS = {
  category: 0.4,
  capabilities: 0.4,
  protocol: 0.2,
} as const;

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

/** Fraction of the QUERY's requested capabilities that the candidate
 * actually has — deliberately asymmetric, not a symmetric Jaccard
 * similarity. An earlier version used Jaccard (intersection/union), which
 * penalized an agent for having capabilities beyond what was asked for —
 * backwards for "does this agent have what I need": an agent that does
 * everything the user wants, plus more, should score as a full match, not
 * a partial one. Caught by this module's own test suite. */
function capabilityCoverage(requested: string[], offered: string[]): number {
  const wanted = new Set(requested.map(normalize));
  const has = offered.map(normalize);
  if (wanted.size === 0 || has.length === 0) return 0;
  let covered = 0;
  for (const item of wanted) {
    // Substring match, not just exact — "liquidation" (query) should count
    // against an agent capability like "liquidation_protection" (real
    // capability strings observed from ERC-8004 registration metadata,
    // Phase 2 finding, tend to be snake_case and more specific than a
    // casual query phrase).
    if (has.some((h) => h.includes(item) || item.includes(h))) covered++;
  }
  return covered / wanted.size;
}

export function computeMatchScore(
  intent: AgentSearchIntent,
  candidate: SearchCandidate
): MatchScoreResult {
  const components: MatchComponent[] = [
    {
      key: "category",
      label: "Category match",
      weight: WEIGHTS.category,
      value: intent.category === null ? null : candidate.category === intent.category ? 100 : 0,
    },
    {
      key: "capabilities",
      label: "Capability overlap",
      weight: WEIGHTS.capabilities,
      value:
        intent.capabilities.length === 0 || candidate.capabilities.length === 0
          ? null
          : capabilityCoverage(intent.capabilities, candidate.capabilities) * 100,
    },
    {
      key: "protocol",
      label: "Protocol support",
      weight: WEIGHTS.protocol,
      value:
        intent.protocol === null
          ? null
          : candidate.protocols.some((p) => normalize(p) === normalize(intent.protocol as string))
            ? 100
            : 0,
    },
  ];

  const available = components.filter((c) => c.value !== null);
  const availableWeight = available.reduce((sum, c) => sum + c.weight, 0);

  if (availableWeight === 0) {
    // The query didn't extract anything concrete enough to compare against
    // (e.g. "find me a good agent") — no fabricated match number.
    return { status: "unscoreable", score: null, components };
  }

  const weightedSum = available.reduce((sum, c) => sum + (c.value as number) * c.weight, 0);
  const score = Math.round(Math.max(0, Math.min(100, weightedSum / availableWeight)));

  return { status: "matched", score, components };
}
