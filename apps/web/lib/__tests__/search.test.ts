import { describe, expect, it } from "vitest";
import { compareResults, type RankedSearchResult } from "../search";
import type { AetherScoreResult } from "../scoring";
import type { SearchCandidate } from "../agents";

function aetherScore(score: number | null): AetherScoreResult {
  return score === null
    ? { status: "new", score: null, components: [] }
    : { status: "scored", score, components: [] };
}

function makeResult(overrides: {
  matchScore: number | null;
  aetherScore: number | null;
  id?: string;
}): RankedSearchResult {
  const candidate: SearchCandidate = {
    id: overrides.id ?? "id",
    agentId: "1",
    chainId: 97,
    slug: "agent",
    name: "Agent",
    description: null,
    avatarUrl: null,
    category: "risk",
    identityVerified: true,
    endpointVerified: true,
    performanceVerified: false,
    dataSource: "onchain",
    score: aetherScore(overrides.aetherScore),
    capabilities: [],
    protocols: [],
  };
  return {
    candidate,
    match:
      overrides.matchScore === null
        ? { status: "unscoreable", score: null, components: [] }
        : { status: "matched", score: overrides.matchScore, components: [] },
  };
}

describe("compareResults", () => {
  it("ranks a higher Match Score above a lower one", () => {
    const high = makeResult({ id: "high", matchScore: 90, aetherScore: 50 });
    const low = makeResult({ id: "low", matchScore: 40, aetherScore: 50 });
    expect([low, high].sort(compareResults).map((r) => r.candidate.id)).toEqual(["high", "low"]);
  });

  it("breaks a near-tie in Match Score (within 5 points) using Aether Score", () => {
    const trusted = makeResult({ id: "trusted", matchScore: 80, aetherScore: 90 });
    const untrusted = makeResult({ id: "untrusted", matchScore: 82, aetherScore: 20 });
    expect([untrusted, trusted].sort(compareResults).map((r) => r.candidate.id)).toEqual([
      "trusted",
      "untrusted",
    ]);
  });

  it("does not let Aether Score override a clear (>5 point) Match Score gap", () => {
    const betterMatch = makeResult({ id: "betterMatch", matchScore: 95, aetherScore: 10 });
    const betterTrust = makeResult({ id: "betterTrust", matchScore: 60, aetherScore: 99 });
    expect([betterTrust, betterMatch].sort(compareResults).map((r) => r.candidate.id)).toEqual([
      "betterMatch",
      "betterTrust",
    ]);
  });

  it("always ranks matched candidates above unscoreable ones", () => {
    const matched = makeResult({ id: "matched", matchScore: 10, aetherScore: null });
    const unscoreable = makeResult({ id: "unscoreable", matchScore: null, aetherScore: 99 });
    expect([unscoreable, matched].sort(compareResults).map((r) => r.candidate.id)).toEqual([
      "matched",
      "unscoreable",
    ]);
  });

  it("ranks unscoreable candidates among themselves by Aether Score, never a fabricated match number", () => {
    const higherTrust = makeResult({ id: "higherTrust", matchScore: null, aetherScore: 80 });
    const lowerTrust = makeResult({ id: "lowerTrust", matchScore: null, aetherScore: 30 });
    const brandNew = makeResult({ id: "brandNew", matchScore: null, aetherScore: null });
    const sorted = [lowerTrust, brandNew, higherTrust].sort(compareResults).map((r) => r.candidate.id);
    expect(sorted).toEqual(["higherTrust", "lowerTrust", "brandNew"]);
  });

  // --- Phase 4.1 audit: exact scenario from the audit spec, item 5 ---
  it("audit spec scenario: Agent B (Aether 85, Match 95) outranks Agent A (Aether 98, Match 60)", () => {
    const agentA = makeResult({ id: "A", matchScore: 60, aetherScore: 98 });
    const agentB = makeResult({ id: "B", matchScore: 95, aetherScore: 85 });
    const sorted = [agentA, agentB].sort(compareResults).map((r) => r.candidate.id);
    // A 35-point Match Score gap is well outside the 5-point near-tie
    // threshold, so Match Score decides even though A has the higher
    // Aether Score. This is Match Score being primary, exactly as
    // documented — a lower general-trust agent that fits the specific
    // request better should win the specific request.
    expect(sorted).toEqual(["B", "A"]);
  });

  it("audit spec: exercises the exact implemented near-tie threshold boundary (5 points)", () => {
    // Gap of exactly 5 is NOT ">5", so per the implemented rule
    // (`Math.abs(gap) > 5`) this must still fall through to the Aether
    // Score tiebreak, not be decided by Match Score alone.
    const exactlyFive = makeResult({ id: "exactlyFive", matchScore: 85, aetherScore: 20 });
    const baseline = makeResult({ id: "baseline", matchScore: 80, aetherScore: 90 });
    expect([exactlyFive, baseline].sort(compareResults).map((r) => r.candidate.id)).toEqual([
      "baseline",
      "exactlyFive",
    ]);

    // Gap of 6 IS ">5", so Match Score alone decides here.
    const sixPointGap = makeResult({ id: "sixPointGap", matchScore: 86, aetherScore: 20 });
    const lowerMatch = makeResult({ id: "lowerMatch", matchScore: 80, aetherScore: 90 });
    expect([sixPointGap, lowerMatch].sort(compareResults).map((r) => r.candidate.id)).toEqual([
      "sixPointGap",
      "lowerMatch",
    ]);
  });
});
