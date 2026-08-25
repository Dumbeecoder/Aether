import { resolveSearchIntent } from "./ai";
import type { AgentSearchIntent } from "./ai/types";
import { listSearchCandidates, type SearchCandidate } from "./agents";
import { computeMatchScore, type MatchScoreResult } from "./matchScore";

export interface RankedSearchResult {
  candidate: SearchCandidate;
  match: MatchScoreResult;
}

export type RunSearchResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      intent: AgentSearchIntent;
      providerName: string;
      usedFallback: boolean;
      results: RankedSearchResult[];
    };

/**
 * Ranking rule (documented, not arbitrary — spec Section 3.2 audit
 * pattern): sort by Match Score first, since the user explicitly asked for
 * something specific. Among matched candidates whose scores are close
 * (within 5 points — a difference small enough to be noise rather than a
 * real distinction), prefer the one with the higher Aether Score, so trust
 * still breaks near-ties without ever computing one fabricated blended
 * number out of two differently-scaled, differently-meaning scores.
 * Candidates the query gave nothing concrete to match against
 * ("unscoreable") are never assigned a synthetic match number — they sort
 * after every matched candidate, ordered by Aether Score alone.
 */
export function compareResults(a: RankedSearchResult, b: RankedSearchResult): number {
  const aMatched = a.match.status === "matched";
  const bMatched = b.match.status === "matched";
  if (aMatched && !bMatched) return -1;
  if (!aMatched && bMatched) return 1;

  if (aMatched && bMatched) {
    const gap = (b.match.score as number) - (a.match.score as number);
    if (Math.abs(gap) > 5) return gap;
  }

  const aScore = a.candidate.score.status === "scored" ? (a.candidate.score.score as number) : -1;
  const bScore = b.candidate.score.status === "scored" ? (b.candidate.score.score as number) : -1;
  return bScore - aScore;
}

export async function runAgentSearch(query: string): Promise<RunSearchResult> {
  const { intent, providerName, usedFallback } = await resolveSearchIntent(query);

  const candidatesResult = await listSearchCandidates(intent.category);
  if (candidatesResult.status !== "ok") {
    return candidatesResult;
  }

  const results: RankedSearchResult[] = candidatesResult.candidates.map((candidate) => ({
    candidate,
    match: computeMatchScore(intent, candidate),
  }));

  results.sort(compareResults);

  return { status: "ok", intent, providerName, usedFallback, results };
}
