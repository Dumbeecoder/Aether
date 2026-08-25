import type { Address } from "viem";
import type { OnChainJob } from "./web3/erc8183";
import { JobStatus, JOB_STATUS_LABELS } from "./web3/erc8183";
import { getSupabaseReadClient } from "./supabase";

export interface JobCreationClaim {
  jobId: bigint;
  clientWallet: Address;
  providerWallet: Address;
}

export type JobVerificationResult =
  | { valid: true; job: OnChainJob }
  | { valid: false; reason: string };

/**
 * The API route's core trust boundary: a browser can claim anything about
 * a transaction it just sent, so nothing from that claim is written to
 * Supabase until this function independently confirms the chain agrees.
 * Pulled out as a pure function specifically so this boundary is
 * unit-testable without a live RPC connection or Supabase project.
 */
export function verifyJobMatchesClaim(
  onChainJob: OnChainJob | null,
  claim: JobCreationClaim
): JobVerificationResult {
  if (!onChainJob) {
    return { valid: false, reason: "Job not found on-chain — the transaction may not be confirmed yet." };
  }
  if (onChainJob.id !== claim.jobId) {
    return { valid: false, reason: "Job ID mismatch." };
  }
  if (onChainJob.client.toLowerCase() !== claim.clientWallet.toLowerCase()) {
    return { valid: false, reason: "Job's on-chain client address does not match the connected wallet." };
  }
  if (onChainJob.provider.toLowerCase() !== claim.providerWallet.toLowerCase()) {
    return { valid: false, reason: "Job's on-chain provider address does not match the requested agent." };
  }
  return { valid: true, job: onChainJob };
}

export function jobStatusLabel(status: JobStatus): string {
  return JOB_STATUS_LABELS[status] ?? "Unknown";
}

export interface AgentActivityItem {
  id: string;
  status: string;
  description: string | null;
  createdAt: string;
}

export type AgentActivityResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ok"; items: AgentActivityItem[] };

/**
 * Real hire activity for the Agent Passport's "Recent Activity" section —
 * reads `onchain_jobs`, the read cache that's only ever written after
 * app/api/jobs/route.ts independently confirms a job against the chain
 * (see 0003_hiring.sql). Never the Phase-1 `agent_tasks`/`hire_sessions`
 * tables — those predate the ERC-8183 flow and nothing in this app writes
 * to them, so querying them would risk showing a permanently-empty legacy
 * table as if it were a real feed.
 */
export async function getAgentActivity(agentId: string, limit = 5): Promise<AgentActivityResult> {
  const client = getSupabaseReadClient();
  if (!client) return { status: "not_configured" };

  const { data, error } = await client
    .from("onchain_jobs")
    .select("id,status,description,created_at")
    .eq("provider_agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { status: "error", message: error.message };

  return {
    status: "ok",
    items: (data ?? []).map((row) => ({
      id: row.id as string,
      status: row.status as string,
      description: (row.description as string | null) ?? null,
      createdAt: row.created_at as string,
    })),
  };
}
