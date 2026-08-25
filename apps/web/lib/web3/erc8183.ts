import { encodeFunctionData, type Address } from "viem";
import { AGENTIC_COMMERCE_ABI, EVALUATOR_ROUTER_ABI, MINIMAL_ERC20_ABI } from "./abis";
import { getErc8183Addresses } from "./network";

/**
 * Matches `IACP.JobStatus` exactly (verified against the pinned bnbagent
 * package's `erc8183/types.py::JobStatus`, Phase 5 research) — do not
 * reorder, the integers are read directly off `getJob()`.
 */
export enum JobStatus {
  OPEN = 0,
  FUNDED = 1,
  SUBMITTED = 2,
  COMPLETED = 3,
  REJECTED = 4,
  EXPIRED = 5,
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.OPEN]: "Open",
  [JobStatus.FUNDED]: "Funded",
  [JobStatus.SUBMITTED]: "Submitted",
  [JobStatus.COMPLETED]: "Completed",
  [JobStatus.REJECTED]: "Rejected",
  [JobStatus.EXPIRED]: "Expired",
};

export interface OnChainJob {
  id: bigint;
  client: Address;
  provider: Address;
  evaluator: Address;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: JobStatus;
  hook: Address;
  submittedAt: bigint;
  deliverable: `0x${string}`;
}

/** `getJob` returns a tuple whose ABI declares named components — viem
 * therefore decodes it as an object keyed by those names (`{id, client,
 * provider, ...}`), not a positional array, which is what an earlier
 * version of this function assumed (caught by `tsc`, not a runtime bug —
 * the mismatch was a type error, not a silent wrong-field read). Handles
 * both shapes so this stays correct regardless of how a given viem call
 * decodes it, and so the existing positional-array unit test keeps working. */
export function decodeJobTuple(raw: readonly unknown[] | Record<string, unknown>): OnChainJob {
  if (Array.isArray(raw)) {
    const [id, client, provider, evaluator, description, budget, expiredAt, status, hook, submittedAt, deliverable] =
      raw as [bigint, Address, Address, Address, string, bigint, bigint, number, Address, bigint, `0x${string}`];
    return { id, client, provider, evaluator, description, budget, expiredAt, status, hook, submittedAt, deliverable };
  }
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as bigint,
    client: r.client as Address,
    provider: r.provider as Address,
    evaluator: r.evaluator as Address,
    description: r.description as string,
    budget: r.budget as bigint,
    expiredAt: r.expiredAt as bigint,
    status: r.status as number,
    hook: r.hook as Address,
    submittedAt: r.submittedAt as bigint,
    deliverable: r.deliverable as `0x${string}`,
  };
}

/**
 * Foot-gun guard ported from the pinned SDK's own `create_job` pre-flight
 * (bnbagent 0.3.6, `erc8183/client.py`, referencing
 * github.com/bnb-chain/bnbagent-sdk/issues/41): if `expiredAt` is too close
 * to now relative to the policy's `disputeWindow`, `submit()` on the
 * provider side will always revert with `SubmissionTooLate()` — the job
 * would be fundable but never completable. Same 24h safety buffer as the
 * SDK's own example.
 */
const EXPIRY_SAFETY_BUFFER_SECONDS = 24 * 60 * 60;

export function validateExpiry(
  expiredAtUnixSeconds: number,
  disputeWindowSeconds: number,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000)
): { valid: true } | { valid: false; reason: string } {
  const minExpiry = nowUnixSeconds + disputeWindowSeconds + EXPIRY_SAFETY_BUFFER_SECONDS;
  if (expiredAtUnixSeconds < minExpiry) {
    return {
      valid: false,
      reason:
        `Expiry is too soon. This policy's dispute window is ${(disputeWindowSeconds / 86400).toFixed(1)} days — ` +
        `set the deadline to at least ${new Date(minExpiry * 1000).toISOString()} so the provider has time to ` +
        `submit before the window makes submission impossible.`,
    };
  }
  return { valid: true };
}

export interface TxIntent {
  to: Address;
  data: `0x${string}`;
}

/**
 * `createJob` — evaluator/hook are ALWAYS the Router address (the v1
 * deployment pattern the pinned SDK itself defaults to), never a
 * user-chosen value. Passing `provider` directly here (rather than the
 * separate `setProvider` call the ABI also exposes) since Aether always
 * knows which agent's wallet it's hiring at creation time.
 */
export function buildCreateJobTx(params: {
  provider: Address;
  expiredAtUnixSeconds: number;
  description: string;
}): TxIntent {
  const { commerce, router } = getErc8183Addresses();
  return {
    to: commerce,
    data: encodeFunctionData({
      abi: AGENTIC_COMMERCE_ABI,
      functionName: "createJob",
      args: [params.provider, router, BigInt(params.expiredAtUnixSeconds), params.description, router],
    }),
  };
}

/** Client-only, Open-only, single-shot (per the pinned SDK's own docstring)
 * — binds the whitelisted OptimisticPolicy to the job. Must happen before
 * `fund`. */
export function buildRegisterJobTx(jobId: bigint): TxIntent {
  const { router, policy } = getErc8183Addresses();
  return {
    to: router,
    data: encodeFunctionData({ abi: EVALUATOR_ROUTER_ABI, functionName: "registerJob", args: [jobId, policy] }),
  };
}

export function buildSetBudgetTx(jobId: bigint, amount: bigint): TxIntent {
  const { commerce } = getErc8183Addresses();
  return {
    to: commerce,
    data: encodeFunctionData({ abi: AGENTIC_COMMERCE_ABI, functionName: "setBudget", args: [jobId, amount, "0x"] }),
  };
}

/**
 * Exact-amount approval only — deliberately NOT the pinned SDK's own
 * "floor" default (approve `max(amount, ~100 tokens)` to save gas across a
 * stream of small jobs). That's a reasonable choice for a backend service
 * running many jobs, but this app's own security stance throughout every
 * prior phase has been "never leave more standing allowance than the
 * current action needs" (spec Section 15/25 precedent) — a marketplace UI
 * asking a user to approve more than the job they're looking at right now
 * would contradict that. Costs one extra approve tx for a user's very next
 * job; that tradeoff is intentional here.
 */
export function buildApproveTx(paymentToken: Address, spender: Address, amount: bigint): TxIntent {
  return {
    to: paymentToken,
    data: encodeFunctionData({ abi: MINIMAL_ERC20_ABI, functionName: "approve", args: [spender, amount] }),
  };
}

export function buildFundTx(jobId: bigint, amount: bigint): TxIntent {
  const { commerce } = getErc8183Addresses();
  return {
    to: commerce,
    data: encodeFunctionData({ abi: AGENTIC_COMMERCE_ABI, functionName: "fund", args: [jobId, amount, "0x"] }),
  };
}

/** Permissionless (verified against the pinned SDK: `router.py` —
 * "settle(jobId) — permissionless; pulls the verdict from the policy and
 * applies it to the kernel"). No backend keeper is needed for this app —
 * the user's own wallet can call this once eligible, and the job status
 * page only enables the button once `submittedAt + disputeWindow` has
 * elapsed (checked via a read call, not assumed from a client-side timer). */
export function buildSettleTx(jobId: bigint): TxIntent {
  const { router } = getErc8183Addresses();
  return {
    to: router,
    data: encodeFunctionData({ abi: EVALUATOR_ROUTER_ABI, functionName: "settle", args: [jobId, "0x"] }),
  };
}

/** Client cancels a job still OPEN (no escrow moved yet, verified against
 * `commerce.py`: `reject()` doubles as `cancel_open` per the SDK's own
 * higher-level wrapper). */
export function buildCancelOpenTx(jobId: bigint): TxIntent {
  const { commerce } = getErc8183Addresses();
  const ZERO_REASON = ("0x" + "00".repeat(32)) as `0x${string}`;
  return {
    to: commerce,
    data: encodeFunctionData({ abi: AGENTIC_COMMERCE_ABI, functionName: "reject", args: [jobId, ZERO_REASON, "0x"] }),
  };
}

export function buildClaimRefundTx(jobId: bigint): TxIntent {
  const { commerce } = getErc8183Addresses();
  return {
    to: commerce,
    data: encodeFunctionData({ abi: AGENTIC_COMMERCE_ABI, functionName: "claimRefund", args: [jobId] }),
  };
}
