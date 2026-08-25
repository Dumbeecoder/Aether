import { describe, expect, it } from "vitest";
import {
  JobStatus,
  decodeJobTuple,
  validateExpiry,
  buildCreateJobTx,
  buildRegisterJobTx,
  buildSetBudgetTx,
  buildApproveTx,
  buildFundTx,
  buildSettleTx,
  buildCancelOpenTx,
  buildClaimRefundTx,
} from "../erc8183";

describe("JobStatus enum", () => {
  it("matches IACP.JobStatus exactly, verified against the pinned bnbagent package (Phase 5 research)", () => {
    // Regression pin: reordering this enum would silently misread every
    // job's status from getJob() without any type error to catch it.
    expect(JobStatus.OPEN).toBe(0);
    expect(JobStatus.FUNDED).toBe(1);
    expect(JobStatus.SUBMITTED).toBe(2);
    expect(JobStatus.COMPLETED).toBe(3);
    expect(JobStatus.REJECTED).toBe(4);
    expect(JobStatus.EXPIRED).toBe(5);
  });
});

describe("decodeJobTuple", () => {
  it("decodes the getJob tuple in the exact on-chain field order", () => {
    const tuple = [
      42n,
      "0xClient0000000000000000000000000000000000",
      "0xProvider00000000000000000000000000000000",
      "0xEvaluator0000000000000000000000000000000",
      "optimize my liquidity",
      1000000n,
      9999999999n,
      1, // FUNDED
      "0xHook0000000000000000000000000000000000000",
      0n,
      "0x0000000000000000000000000000000000000000000000000000000000000",
    ] as const;
    const job = decodeJobTuple(tuple);
    expect(job.id).toBe(42n);
    expect(job.client).toBe("0xClient0000000000000000000000000000000000");
    expect(job.status).toBe(JobStatus.FUNDED);
    expect(job.budget).toBe(1000000n);
  });

  it("also decodes the named-object shape viem actually returns for a named tuple (regression: caught by tsc, not a runtime bug)", () => {
    // The ABI declares named tuple components, so viem decodes getJob()
    // as `{id, client, provider, ...}`, not a positional array — an
    // earlier version of this function assumed array-only and didn't
    // compile against the real readContract return type.
    const namedObject = {
      id: 42n,
      client: "0xClient0000000000000000000000000000000000",
      provider: "0xProvider00000000000000000000000000000000",
      evaluator: "0xEvaluator0000000000000000000000000000000",
      description: "optimize my liquidity",
      budget: 1000000n,
      expiredAt: 9999999999n,
      status: 1,
      hook: "0xHook0000000000000000000000000000000000000",
      submittedAt: 0n,
      deliverable: "0x0000000000000000000000000000000000000000000000000000000000000",
    };
    const job = decodeJobTuple(namedObject);
    expect(job.id).toBe(42n);
    expect(job.status).toBe(JobStatus.FUNDED);
    expect(job.budget).toBe(1000000n);
  });
});

describe("validateExpiry (SDK foot-gun guard, ported from bnbagent 0.3.6 client.py)", () => {
  const now = 1_700_000_000;
  const disputeWindow = 7 * 86400; // 7 days

  it("rejects an expiry that leaves no time to submit before the dispute window makes it impossible", () => {
    const result = validateExpiry(now + disputeWindow, disputeWindow, now); // exactly at the window, no buffer
    expect(result.valid).toBe(false);
  });

  it("rejects an expiry in the past", () => {
    const result = validateExpiry(now - 1000, disputeWindow, now);
    expect(result.valid).toBe(false);
  });

  it("accepts an expiry with the required 24h safety buffer beyond the dispute window", () => {
    const result = validateExpiry(now + disputeWindow + 24 * 60 * 60, disputeWindow, now);
    expect(result.valid).toBe(true);
  });

  it("accepts a generous expiry far beyond the minimum", () => {
    const result = validateExpiry(now + 90 * 86400, disputeWindow, now);
    expect(result.valid).toBe(true);
  });
});

const DUMMY_ADDR = "0x1111111111111111111111111111111111111111";

describe("transaction intent builders", () => {
  it("buildCreateJobTx targets the Commerce contract and encodes non-empty calldata", () => {
    const tx = buildCreateJobTx({ provider: DUMMY_ADDR as `0x${string}`, expiredAtUnixSeconds: 2_000_000_000, description: "test job" });
    expect(tx.to).toBe(process.env.NEXT_PUBLIC_ERC8183_COMMERCE);
    expect(tx.data.startsWith("0x")).toBe(true);
    expect(tx.data.length).toBeGreaterThan(10);
  });

  it("buildRegisterJobTx targets the Router contract", () => {
    const tx = buildRegisterJobTx(1n);
    expect(tx.to).toBe(process.env.NEXT_PUBLIC_ERC8183_ROUTER);
  });

  it("buildSettleTx targets the Router contract (settlement is permissionless via the Router, never a direct commerce.complete() call)", () => {
    const tx = buildSettleTx(1n);
    expect(tx.to).toBe(process.env.NEXT_PUBLIC_ERC8183_ROUTER);
  });

  it("buildSetBudgetTx, buildFundTx, buildCancelOpenTx, buildClaimRefundTx all target the Commerce contract", () => {
    expect(buildSetBudgetTx(1n, 100n).to).toBe(process.env.NEXT_PUBLIC_ERC8183_COMMERCE);
    expect(buildFundTx(1n, 100n).to).toBe(process.env.NEXT_PUBLIC_ERC8183_COMMERCE);
    expect(buildCancelOpenTx(1n).to).toBe(process.env.NEXT_PUBLIC_ERC8183_COMMERCE);
    expect(buildClaimRefundTx(1n).to).toBe(process.env.NEXT_PUBLIC_ERC8183_COMMERCE);
  });

  it("buildApproveTx encodes the exact requested amount, not a padded floor (deliberate security deviation from the SDK's default — see erc8183.ts comment)", () => {
    const exactAmount = 12345n;
    const paddedFloor = 100_000_000_000n; // what the SDK's default floor pattern would approve instead
    const tx = buildApproveTx(DUMMY_ADDR as `0x${string}`, DUMMY_ADDR as `0x${string}`, exactAmount);
    // The encoded calldata must contain the exact amount's hex representation
    // and must NOT reflect the padded floor value.
    const exactHex = exactAmount.toString(16).padStart(64, "0");
    const floorHex = paddedFloor.toString(16).padStart(64, "0");
    expect(tx.data.toLowerCase()).toContain(exactHex);
    expect(tx.data.toLowerCase()).not.toContain(floorHex);
  });
});
