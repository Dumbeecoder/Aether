import { describe, expect, it } from "vitest";
import { explainRecommendation } from "../compare";
import type { AgentProfile } from "../agents";
import type { AetherScoreResult } from "../scoring";

function scored(score: number): AetherScoreResult {
  return {
    status: "scored",
    score,
    components: [
      { key: "verified_task_performance", label: "Verified task performance", weight: 0.3, value: score },
    ],
  };
}

function makeAgent(overrides: Partial<AgentProfile>): AgentProfile {
  return {
    id: overrides.id ?? "id",
    agentId: "1",
    chainId: 97,
    slug: overrides.slug ?? "agent",
    name: overrides.name ?? "Agent",
    description: null,
    avatarUrl: null,
    category: "risk",
    identityVerified: true,
    endpointVerified: true,
    performanceVerified: false,
    dataSource: "onchain",
    score: scored(80),
    walletAddress: "0x0",
    ownerWallet: null,
    identityRegistry: null,
    registrationTxHash: null,
    registrationBlock: null,
    registrationTimestamp: null,
    agentUri: null,
    capabilities: [],
    protocols: [],
    endpoints: [],
    performance: { totalTasks: 100, successRate: 90 },
    ...overrides,
  };
}

describe("explainRecommendation", () => {
  it("returns null when fewer than two agents have a real score", () => {
    const a = makeAgent({ id: "a" });
    const b = makeAgent({ id: "b", score: { status: "new", score: null, components: [] } });
    expect(explainRecommendation([a, b])).toBeNull();
  });

  it("recommends the higher-scored agent by name", () => {
    const winner = makeAgent({ id: "a", name: "LiquidGuard AI", score: scored(94) });
    const loser = makeAgent({ id: "b", name: "Yield Bot", score: scored(80) });
    const explanation = explainRecommendation([winner, loser]);
    expect(explanation).toContain("LiquidGuard AI");
    expect(explanation).toContain("14 points ahead");
  });

  it("never mentions a metric that wasn't actually in the data", () => {
    const a = makeAgent({ id: "a", name: "A", score: scored(80), performance: null });
    const b = makeAgent({ id: "b", name: "B", score: scored(70), performance: null });
    const explanation = explainRecommendation([a, b]);
    expect(explanation).not.toContain("track record");
  });

  it("handles a tie without inventing a winner", () => {
    const a = makeAgent({ id: "a", name: "A", score: scored(80) });
    const b = makeAgent({ id: "b", name: "B", score: scored(80) });
    const explanation = explainRecommendation([a, b]);
    expect(explanation).toContain("tied");
  });

  // --- Phase 3.1 audit regression test ---
  it("flags a seeded/demo agent that wins a comparison, since nothing upstream excludes it", () => {
    const demoWinner = makeAgent({ id: "d", name: "Demo Bot", dataSource: "seeded", score: scored(95) });
    const real = makeAgent({ id: "r", name: "Real Agent", dataSource: "onchain", score: scored(60) });
    const explanation = explainRecommendation([demoWinner, real]);
    expect(explanation).toContain("Demo Bot");
    expect(explanation).toContain("seeded/demo agent");
  });

  it("does not add the seeded caveat when the winner is a real onchain agent", () => {
    const real = makeAgent({ id: "r", name: "Real Agent", dataSource: "onchain", score: scored(90) });
    const demo = makeAgent({ id: "d", name: "Demo Bot", dataSource: "seeded", score: scored(60) });
    const explanation = explainRecommendation([real, demo]);
    expect(explanation).not.toContain("seeded/demo agent");
  });
});
