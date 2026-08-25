/**
 * AI provider abstraction (spec Section 3 of Phase 4). The application is
 * never hardcoded to one LLM vendor — every call site depends on the
 * `AIProvider` interface below, not on a specific implementation.
 *
 * CRITICAL boundary (spec Section 1): the AI provider's ONLY job is intent
 * extraction — turning a free-text query into structured requirements. It
 * never ranks agents, never invents agents, never invents performance
 * numbers. Ranking happens entirely in `lib/matchScore.ts` and
 * `lib/scoring.ts`, both deterministic and LLM-free.
 */

import type { AgentCategory } from "../agents";

export interface AgentSearchIntent {
  category: AgentCategory | null;
  capabilities: string[];
  protocol: string | null;
  budget: number | null;
  risk: "low" | "medium" | "high" | null;
}

export interface AIProvider {
  /** Identifies which backend actually served the request, surfaced in the
   * UI so "AI-parsed" vs "keyword fallback" is never presented as if it
   * were the same thing (transparency principle carried from Phase 2/3). */
  readonly name: string;
  parseAgentSearchIntent(query: string): Promise<AgentSearchIntent>;
}

export function emptyIntent(): AgentSearchIntent {
  return { category: null, capabilities: [], protocol: null, budget: null, risk: null };
}
