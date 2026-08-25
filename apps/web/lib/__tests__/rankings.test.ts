import { describe, expect, it } from "vitest";
import { partitionAgentsForRankings } from "../rankings";
import type { AgentListItem } from "../agents";
import type { AetherScoreResult } from "../scoring";

function scored(score: number): AetherScoreResult {
  return { status: "scored", score, components: [] };
}
const fresh: AetherScoreResult = { status: "new", score: null, components: [] };

function makeAgent(overrides: Partial<AgentListItem>): AgentListItem {
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
    score: fresh,
    ...overrides,
  };
}

describe("partitionAgentsForRankings", () => {
  it("puts a seeded agent in `seeded` even when it has a high score", () => {
    const seededHighScore = makeAgent({ id: "s1", dataSource: "seeded", score: scored(99) });
    const { ranked, seeded } = partitionAgentsForRankings([seededHighScore]);
    expect(ranked).toHaveLength(0);
    expect(seeded).toHaveLength(1);
    expect(seeded[0]?.id).toBe("s1");
  });

  it("never mixes seeded agents into the ranked table alongside real onchain agents", () => {
    const real = makeAgent({ id: "r1", dataSource: "onchain", score: scored(70) });
    const demo = makeAgent({ id: "d1", dataSource: "seeded", score: scored(95) });
    const { ranked, seeded } = partitionAgentsForRankings([real, demo]);
    expect(ranked.map((a) => a.id)).toEqual(["r1"]);
    expect(seeded.map((a) => a.id)).toEqual(["d1"]);
  });

  it("sorts ranked onchain agents by score descending", () => {
    const low = makeAgent({ id: "low", score: scored(40) });
    const high = makeAgent({ id: "high", score: scored(90) });
    const { ranked } = partitionAgentsForRankings([low, high]);
    expect(ranked.map((a) => a.id)).toEqual(["high", "low"]);
  });

  it("puts unscored onchain agents in freshOnchain, not ranked", () => {
    const newAgent = makeAgent({ id: "n1", dataSource: "onchain", score: fresh });
    const { ranked, freshOnchain } = partitionAgentsForRankings([newAgent]);
    expect(ranked).toHaveLength(0);
    expect(freshOnchain.map((a) => a.id)).toEqual(["n1"]);
  });

  it("puts an unscored seeded agent only in seeded, not freshOnchain", () => {
    const newSeeded = makeAgent({ id: "ns1", dataSource: "seeded", score: fresh });
    const { freshOnchain, seeded } = partitionAgentsForRankings([newSeeded]);
    expect(freshOnchain).toHaveLength(0);
    expect(seeded.map((a) => a.id)).toEqual(["ns1"]);
  });
});
