import { describe, expect, it } from "vitest";
import { verifyJobMatchesClaim, jobStatusLabel } from "../jobs";
import { JobStatus } from "../web3/erc8183";
import type { OnChainJob } from "../web3/erc8183";

function makeOnChainJob(overrides: Partial<OnChainJob> = {}): OnChainJob {
  return {
    id: 7n,
    client: "0xClient0000000000000000000000000000000001",
    provider: "0xProvider00000000000000000000000000000002",
    evaluator: "0xEvaluator0000000000000000000000000000003",
    description: "test",
    budget: 0n,
    expiredAt: 9_999_999_999n,
    status: JobStatus.OPEN,
    hook: "0xHook0000000000000000000000000000000004",
    submittedAt: 0n,
    deliverable: ("0x" + "00".repeat(32)) as `0x${string}`,
    ...overrides,
  };
}

describe("verifyJobMatchesClaim — the API route's core trust boundary", () => {
  it("accepts a claim that matches the on-chain job exactly", () => {
    const job = makeOnChainJob();
    const result = verifyJobMatchesClaim(job, {
      jobId: 7n,
      clientWallet: "0xClient0000000000000000000000000000000001",
      providerWallet: "0xProvider00000000000000000000000000000002",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects when the job doesn't exist on-chain (unconfirmed or fabricated tx)", () => {
    const result = verifyJobMatchesClaim(null, {
      jobId: 7n,
      clientWallet: "0xClient0000000000000000000000000000000001",
      providerWallet: "0xProvider00000000000000000000000000000002",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a job ID that doesn't match what's on-chain", () => {
    const job = makeOnChainJob({ id: 7n });
    const result = verifyJobMatchesClaim(job, {
      jobId: 999n,
      clientWallet: "0xClient0000000000000000000000000000000001",
      providerWallet: "0xProvider00000000000000000000000000000002",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects when the claimed client wallet doesn't match the job's real on-chain client", () => {
    // This is the exact attack this function exists to stop: a browser
    // claiming a job belongs to a different wallet than the one that
    // actually created it on-chain.
    const job = makeOnChainJob({ client: "0xRealClient000000000000000000000000000005" });
    const result = verifyJobMatchesClaim(job, {
      jobId: 7n,
      clientWallet: "0xAttacker00000000000000000000000000000006",
      providerWallet: "0xProvider00000000000000000000000000000002",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects when the claimed provider doesn't match the job's real on-chain provider", () => {
    const job = makeOnChainJob({ provider: "0xRealProvider0000000000000000000000000007" });
    const result = verifyJobMatchesClaim(job, {
      jobId: 7n,
      clientWallet: "0xClient0000000000000000000000000000000001",
      providerWallet: "0xWrongAgent000000000000000000000000000008",
    });
    expect(result.valid).toBe(false);
  });

  it("address comparison is case-insensitive (checksummed vs lowercase must not falsely mismatch)", () => {
    const job = makeOnChainJob({
      client: "0xAbCdEf0000000000000000000000000000000009",
      provider: "0xProvider00000000000000000000000000000002",
    });
    const result = verifyJobMatchesClaim(job, {
      jobId: 7n,
      clientWallet: "0xabcdef0000000000000000000000000000000009",
      providerWallet: "0xPROVIDER00000000000000000000000000000002",
    });
    expect(result.valid).toBe(true);
  });
});

describe("jobStatusLabel", () => {
  it("maps every status to a human label", () => {
    expect(jobStatusLabel(JobStatus.OPEN)).toBe("Open");
    expect(jobStatusLabel(JobStatus.FUNDED)).toBe("Funded");
    expect(jobStatusLabel(JobStatus.COMPLETED)).toBe("Completed");
  });
});
