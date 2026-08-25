import { describe, expect, it } from "vitest";
import { computeAetherScore, type ScoreInputs } from "../scoring";

const baseInputs: ScoreInputs = {
  identityVerified: true,
  endpointVerified: true,
  performanceVerified: false,
  registrationTimestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  lastIndexedAt: new Date().toISOString(),
  endpointHealthStatuses: ["online"],
  performance: null,
};

function withRecord(total: number, successful: number): ScoreInputs {
  return {
    ...baseInputs,
    performance: { totalTasks: total, successfulTasks: successful, averageExecutionTimeSeconds: 2 },
  };
}

describe("computeAetherScore — basics", () => {
  it("returns status 'new' with no score when there are zero completed tasks", () => {
    const result = computeAetherScore(baseInputs);
    expect(result.status).toBe("new");
    expect(result.score).toBeNull();
    expect(result.components).toHaveLength(0);
  });

  it("returns status 'new' even for a fully-verified agent with no tasks", () => {
    const result = computeAetherScore({
      ...baseInputs,
      identityVerified: true,
      endpointVerified: true,
      performanceVerified: true,
    });
    expect(result.status).toBe("new");
  });

  it("scores an agent once it has at least one completed task", () => {
    const result = computeAetherScore(withRecord(100, 97));
    expect(result.status).toBe("scored");
    expect(result.score).not.toBeNull();
    expect(result.score as number).toBeGreaterThan(0);
    expect(result.score as number).toBeLessThanOrEqual(100);
  });

  it("no longer includes capability_match in the base score at all (it's a Match Score concept, Phase 4)", () => {
    const result = computeAetherScore(withRecord(10, 10));
    expect(result.components.find((c) => c.key === "capability_match")).toBeUndefined();
  });

  it("cost_efficiency is insufficient data (no real pricing source until Phase 5)", () => {
    const result = computeAetherScore(withRecord(10, 10));
    const costEfficiency = result.components.find((c) => c.key === "cost_efficiency");
    expect(costEfficiency?.value).toBeNull();
  });

  it("renormalizes remaining weight when a component is missing rather than defaulting it", () => {
    const withSpeed = computeAetherScore(withRecord(10, 10));
    const withoutSpeed = computeAetherScore({
      ...baseInputs,
      performance: { totalTasks: 10, successfulTasks: 10, averageExecutionTimeSeconds: null },
    });
    expect(withSpeed.score).not.toBeNull();
    expect(withoutSpeed.score).not.toBeNull();
    expect(withoutSpeed.components.find((c) => c.key === "speed")?.value).toBeNull();
  });

  it("gives a lower reliability score to an agent with only offline endpoints", () => {
    const online = computeAetherScore({ ...withRecord(5, 5), endpointHealthStatuses: ["online", "online"] });
    const offline = computeAetherScore({ ...withRecord(5, 5), endpointHealthStatuses: ["offline", "offline"] });
    const onlineReliability = online.components.find((c) => c.key === "reliability_activity")?.value ?? 0;
    const offlineReliability = offline.components.find((c) => c.key === "reliability_activity")?.value ?? 0;
    expect(onlineReliability).toBeGreaterThan(offlineReliability);
  });
});

describe("computeAetherScore — double-counting fix (Phase 3.1 finding, resolved in 3.2)", () => {
  it("has exactly one component derived from successfulTasks/totalTasks's success rate — verified_task_performance", () => {
    const result = computeAetherScore(withRecord(10, 10));
    const keys = result.components.map((c) => c.key);
    expect(keys).not.toContain("task_success_rate");
    expect(keys).not.toContain("performance"); // old key name from the pre-3.2 model
    expect(keys).toContain("verified_task_performance");
  });

  it("verified_task_performance and data_confidence measure different things, not the same thing twice", () => {
    // Use a non-100% success rate so verified_task_performance (which
    // depends on the outcome) can't coincidentally collapse onto
    // data_confidence (which by design must not depend on the outcome).
    const n10 = computeAetherScore(withRecord(10, 9));
    const n1000 = computeAetherScore(withRecord(1000, 900));
    const perf10 = n10.components.find((c) => c.key === "verified_task_performance")?.value ?? 0;
    const perf1000 = n1000.components.find((c) => c.key === "verified_task_performance")?.value ?? 0;
    const conf10 = n10.components.find((c) => c.key === "data_confidence")?.value ?? 0;
    const conf1000 = n1000.components.find((c) => c.key === "data_confidence")?.value ?? 0;

    expect(perf1000).toBeGreaterThan(perf10);
    expect(conf1000).toBeGreaterThan(conf10);
    // The gap should differ between the two metrics — if they were
    // identical formulas the deltas would match exactly.
    expect(perf1000 - perf10).not.toBeCloseTo(conf1000 - conf10, 1);
  });

  it("a 1/1 agent does not get full marks on the large-weight performance component from a single raw 100%", () => {
    const result = computeAetherScore(withRecord(1, 1));
    const perf = result.components.find((c) => c.key === "verified_task_performance")?.value ?? 100;
    expect(perf).toBeLessThan(50); // well below the naive 100 a raw rate would have given
  });
});

describe("computeAetherScore — sample-size / data confidence progression", () => {
  const cases: [total: number, successful: number][] = [
    [1, 1],
    [2, 1],
    [10, 9],
    [100, 90],
    [1000, 900],
  ];

  it("data_confidence increases monotonically with sample size", () => {
    const confidences = cases.map(([total, successful]) => {
      const r = computeAetherScore(withRecord(total, successful));
      return r.components.find((c) => c.key === "data_confidence")?.value ?? 0;
    });
    for (let i = 1; i < confidences.length; i++) {
      expect(confidences[i]).toBeGreaterThan(confidences[i - 1] as number);
    }
  });

  it("regression: data_confidence must not depend on the success rate, only on sample size (Phase 3.2 finding)", () => {
    // The first cut of this fix derived confidence from the Wilson interval
    // width, which secretly depended on the outcome: at a 100% raw rate the
    // interval's upper bound is exactly 1 for any n, collapsing confidence
    // onto performance and even making it dip when the rate moved off an
    // extreme. Same n, different success rates, must give identical
    // confidence now.
    const allSuccess = computeAetherScore(withRecord(50, 50));
    const halfSuccess = computeAetherScore(withRecord(50, 25));
    const noSuccess = computeAetherScore(withRecord(50, 0));
    const confAll = allSuccess.components.find((c) => c.key === "data_confidence")?.value;
    const confHalf = halfSuccess.components.find((c) => c.key === "data_confidence")?.value;
    const confNone = noSuccess.components.find((c) => c.key === "data_confidence")?.value;
    expect(confAll).toBe(confHalf);
    expect(confHalf).toBe(confNone);
  });

  it("never lets a small sample (1/1) match or exceed a large sample's overall score at a comparable or lower raw rate", () => {
    const small = computeAetherScore(withRecord(1, 1)); // 100% raw
    const large = computeAetherScore(withRecord(1842, 1783)); // 96.8% raw
    expect(large.score as number).toBeGreaterThan(small.score as number);
  });

  it("Agent A/B/C from the audit: A is New, B (1/1) scores well below C (1842/1783, 96.8%)", () => {
    const a = computeAetherScore(baseInputs); // 0 tasks
    const b = computeAetherScore(withRecord(1, 1));
    const c = computeAetherScore({ ...withRecord(1842, 1783), performanceVerified: true });

    expect(a.status).toBe("new");
    expect(b.status).toBe("scored");
    expect(c.status).toBe("scored");
    expect(c.score as number).toBeGreaterThan(b.score as number);
    // Real computed values (see docs/SCORING.md) — pinned so a future
    // formula change is a visible, deliberate diff rather than a silent drift.
    expect(b.score).toBe(45);
    expect(c.score).toBe(88);
  });
});

describe("computeAetherScore — math invariants", () => {
  it("never produces NaN even when successfulTasks > totalTasks (DB corruption)", () => {
    const result = computeAetherScore(withRecord(10, 999));
    expect(result.status).toBe("scored");
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score as number).toBeGreaterThanOrEqual(0);
    expect(result.score as number).toBeLessThanOrEqual(100);
    for (const c of result.components) {
      if (c.value !== null) expect(Number.isFinite(c.value)).toBe(true);
    }
  });

  it("treats a negative totalTasks as 'new', not as a valid negative sample", () => {
    const result = computeAetherScore(withRecord(-5, 0));
    expect(result.status).toBe("new");
    expect(result.score).toBeNull();
  });

  it("is deterministic: identical inputs always produce identical output", () => {
    const inputs = withRecord(37, 35);
    const a = computeAetherScore(inputs);
    const b = computeAetherScore({ ...inputs });
    expect(a.score).toBe(b.score);
    expect(a.components).toEqual(b.components);
  });

  it("never lets any single component value fall outside [0, 100]", () => {
    const result = computeAetherScore(withRecord(1_000_000, 1_000_000));
    for (const c of result.components) {
      if (c.value !== null) {
        expect(c.value).toBeGreaterThanOrEqual(0);
        expect(c.value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("caps the final score within [0, 100]", () => {
    const result = computeAetherScore({
      ...withRecord(10000, 10000),
      identityVerified: true,
      endpointVerified: true,
      performanceVerified: true,
      registrationTimestamp: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(result.score as number).toBeLessThanOrEqual(100);
    expect(result.score as number).toBeGreaterThanOrEqual(0);
  });

  it("component weights (excluding the query-dependent Match Score concept) sum to 100%", () => {
    const result = computeAetherScore(withRecord(10, 10));
    const totalWeight = result.components.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });
});

describe("computeAetherScore — provenance", () => {
  it("ScoreInputs has no field that could carry an agent's self-reported success rate into scoring", () => {
    // Structural check: the only way performance data reaches this
    // function is the `performance` object, and its shape only has
    // totalTasks/successfulTasks/averageExecutionTimeSeconds — numbers
    // that (per lib/agents.ts) come exclusively from the agent_performance
    // table, never from agent-submitted metadata. This test exists to make
    // that boundary visible in the test suite, not just in a comment.
    const inputs: ScoreInputs = withRecord(10, 10);
    const keys = Object.keys(inputs.performance as object);
    expect(keys.sort()).toEqual(["averageExecutionTimeSeconds", "successfulTasks", "totalTasks"]);
  });

  it("missing performance data never becomes a zero-quality signal — it's 'new', not a score of 0", () => {
    const result = computeAetherScore({ ...baseInputs, performance: null });
    expect(result.status).toBe("new");
    expect(result.score).not.toBe(0);
    expect(result.score).toBeNull();
  });
});
