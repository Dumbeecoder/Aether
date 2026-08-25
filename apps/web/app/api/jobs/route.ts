import { NextResponse } from "next/server";
import { z } from "zod";
import { SUPPORTED_CHAIN_ID, getErc8183Addresses } from "@/lib/web3/network";
import { readJobFromChain } from "@/lib/web3/publicClient";
import { getPublicClient } from "@/lib/web3/publicClient";
import { AGENTIC_COMMERCE_ABI } from "@/lib/web3/abis";
import { verifyJobMatchesClaim } from "@/lib/jobs";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getSupabaseReadClient } from "@/lib/supabase";

const bodySchema = z.object({
  jobId: z.string().regex(/^\d+$/, "jobId must be a numeric string (uint256 as string, not a JS number)"),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  clientWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  agentSlug: z.string().min(1),
});

/**
 * This route only ever RECORDS state that already exists on-chain — it
 * never creates, funds, or moves anything itself (that all happens from
 * the user's own wallet, client-side, before this is ever called). Its
 * entire job is: independently verify the browser's claim against a fresh
 * chain read (lib/jobs.ts::verifyJobMatchesClaim), then upsert a cache row
 * with the service-role key. A forged or stale claim that doesn't match
 * the chain is rejected, not trusted.
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { jobId, txHash, clientWallet, agentSlug } = parsed.data;

  const supabase = getSupabaseReadClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id,wallet_address")
    .eq("slug", agentSlug)
    .maybeSingle();
  if (agentError) return NextResponse.json({ error: agentError.message }, { status: 500 });
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });

  const jobIdBigInt = BigInt(jobId);
  const onChainJob = await readJobFromChain(jobIdBigInt);
  const verification = verifyJobMatchesClaim(onChainJob, {
    jobId: jobIdBigInt,
    clientWallet: clientWallet as `0x${string}`,
    providerWallet: agent.wallet_address as `0x${string}`,
  });

  if (!verification.valid) {
    return NextResponse.json({ error: verification.reason }, { status: 409 });
  }

  const { commerce } = getErc8183Addresses();
  let paymentToken: string | null = null;
  try {
    const client = getPublicClient();
    paymentToken = (await client.readContract({
      address: commerce,
      abi: AGENTIC_COMMERCE_ABI,
      functionName: "paymentToken",
    })) as string;
  } catch {
    // Non-fatal — the token address is informational for the cache row;
    // the chain itself remains authoritative regardless.
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { job } = verification;
  const { data, error } = await admin
    .from("onchain_jobs")
    .upsert(
      {
        chain_id: SUPPORTED_CHAIN_ID,
        job_id: job.id.toString(),
        commerce_address: commerce,
        client_wallet: job.client,
        provider_agent_id: agent.id,
        provider_wallet: job.provider,
        description: job.description,
        payment_token: paymentToken,
        expired_at: new Date(Number(job.expiredAt) * 1000).toISOString(),
        status: "open",
        created_tx_hash: txHash,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "chain_id,job_id,commerce_address" }
    )
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job: data });
}
