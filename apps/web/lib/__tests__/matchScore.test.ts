import { describe, expect, it } from "vitest";
import { computeMatchScore } from "../matchScore";
import type { AgentSearchIntent } from "../ai/types";
import type { SearchCandidate } from "../agents";

function makeCandidate(overrides: Partial<SearchCandidate>): SearchCandidate {
  return {
    id: "id",
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
    score: { status: "new", score: null, components: [] },
    capabilities: [],
    protocols: [],
    ...overrides,
  };
}

const emptyIntent: AgentSearchIntent = {
  category: null,
  capabilities: [],
  protocol: null,
  budget: null,
  risk: null,
};

describe("computeMatchScore", () => {
  it("is unscoreable when the intent has nothing concrete to match against", () => {
    const result = computeMatchScore(emptyIntent, makeCandidate({}));
    expect(result.status).toBe("unscoreable");
    expect(result.score).toBeNull();
  });

  it("scores a full match near 100", () => {
    const intent: AgentSearchIntent = {
      ...emptyIntent,
      category: "risk",
      capabilities: ["liquidation_protection"],
      protocol: "Venus",
    };
    const candidate = makeCandidate({
      category: "risk",
      capabilities: ["liquidation_protection", "health_factor_monitoring"],
      protocols: ["Venus"],
    });
    const result = computeMatchScore(intent, candidate);
    expect(result.status).toBe("matched");
    expect(result.score as number).toBeGreaterThan(90);
  });

  it("scores a category mismatch as 0 for that component, not excluded", () => {
    const intent: AgentSearchIntent = { ...emptyIntent, category: "risk" };
    const candidate = makeCandidate({ category: "trading" });
    const result = computeMatchScore(intent, candidate);
    expect(result.status).toBe("matched");
    const cat = result.components.find((c) => c.key === "category");
    expect(cat?.value).toBe(0);
  });

  it("excludes capability_overlap when the candidate has no recorded capabilities, rather than scoring it 0", () => {
    const intent: AgentSearchIntent = { ...emptyIntent, capabilities: ["swap"] };
    const candidate = makeCandidate({ capabilities: [] });
    const result = computeMatchScore(intent, candidate);
    const caps = result.components.find((c) => c.key === "capabilities");
    expect(caps?.value).toBeNull();
  });

  it("matches capabilities via substring, not just exact string equality", () => {
    const intent: AgentSearchIntent = { ...emptyIntent, capabilities: ["liquidation"] };
    const candidate = makeCandidate({ capabilities: ["liquidation_protection"] });
    const result = computeMatchScore(intent, candidate);
    const caps = result.components.find((c) => c.key === "capabilities");
    expect(caps?.value).toBeGreaterThan(0);
  });

  it("does not penalize an agent for having MORE capabilities than requested (regression)", () => {
    // An agent that covers everything asked for, plus extras, is a full
    // match — not a partial one. Symmetric set-similarity would wrongly
    // penalize this.
    const intent: AgentSearchIntent = { ...emptyIntent, capabilities: ["liquidation_protection"] };
    const candidate = makeCandidate({
      capabilities: ["liquidation_protection", "health_factor_monitoring", "position_analysis"],
    });
    const result = computeMatchScore(intent, candidate);
    const caps = result.components.find((c) => c.key === "capabilities");
    expect(caps?.value).toBe(100);
  });

  it("scores partial capability coverage proportionally", () => {
    const intent: AgentSearchIntent = { ...emptyIntent, capabilities: ["swap", "liquidity", "arbitrage"] };
    const candidate = makeCandidate({ capabilities: ["swap"] });
    const result = computeMatchScore(intent, candidate);
    const caps = result.components.find((c) => c.key === "capabilities");
    expect(caps?.value).toBeCloseTo((1 / 3) * 100, 1);
  });

  // --- Phase 4.1 audit: exact scenario from the audit spec, item 4 ---
  describe("audit spec scenario: query [A, B]", () => {
    const intent: AgentSearchIntent = { ...emptyIntent, capabilities: ["a", "b"] };

    it("Agent 1 [A, B] and Agent 2 [A, B, C, D, E] receive equivalent (full) coverage", () => {
      const agent1 = computeMatchScore(intent, makeCandidate({ capabilities: ["a", "b"] }));
      const agent2 = computeMatchScore(intent, makeCandidate({ capabilities: ["a", "b", "c", "d", "e"] }));
      const cap1 = agent1.components.find((c) => c.key === "capabilities")?.value;
      const cap2 = agent2.components.find((c) => c.key === "capabilities")?.value;
      expect(cap1).toBe(100);
      expect(cap2).toBe(100);
      expect(cap1).toBe(cap2);
    });

    it("Agent 3 [A] and Agent 4 [A, C] both receive partial coverage appropriate to what was requested", () => {
      const agent3 = computeMatchScore(intent, makeCandidate({ capabilities: ["a"] }));
      const agent4 = computeMatchScore(intent, makeCandidate({ capabilities: ["a", "c"] }));
      const cap3 = agent3.components.find((c) => c.key === "capabilities")?.value;
      const cap4 = agent4.components.find((c) => c.key === "capabilities")?.value;
      // Both cover exactly 1 of the 2 requested capabilities (A) — C is
      // irrelevant to the query, so it must not add credit Agent 4 didn't
      // earn from what was actually asked for.
      expect(cap3).toBeCloseTo(50, 1);
      expect(cap4).toBeCloseTo(50, 1);
      expect(cap3).toBe(cap4);
    });
  });

  it("never returns a score outside [0, 100]", () => {
    const intent: AgentSearchIntent = {
      ...emptyIntent,
      category: "risk",
      capabilities: ["a", "b", "c"],
      protocol: "Venus",
    };
    const candidate = makeCandidate({ category: "risk", capabilities: ["a", "b", "c"], protocols: ["Venus"] });
    const result = computeMatchScore(intent, candidate);
    expect(result.score as number).toBeLessThanOrEqual(100);
    expect(result.score as number).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic", () => {
    const intent: AgentSearchIntent = { ...emptyIntent, category: "yield" };
    const candidate = makeCandidate({ category: "yield" });
    const a = computeMatchScore(intent, candidate);
    const b = computeMatchScore(intent, candidate);
    expect(a.score).toBe(b.score);
  });
});
