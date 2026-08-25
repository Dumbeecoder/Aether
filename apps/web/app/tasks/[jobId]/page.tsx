"use client";

import { useEffect, useState, use as usePromise } from "react";
import { formatUnits } from "viem";
import { getPublicClient } from "@/lib/web3/publicClient";
import { getErc8183Addresses } from "@/lib/web3/network";
import { AGENTIC_COMMERCE_ABI, OPTIMISTIC_POLICY_ABI, MINIMAL_ERC20_ABI } from "@/lib/web3/abis";
import { decodeJobTuple, JobStatus, buildSettleTx, buildClaimRefundTx, buildCancelOpenTx, type OnChainJob } from "@/lib/web3/erc8183";
import { jobStatusLabel } from "@/lib/jobs";
import { WalletConnect } from "@/components/WalletConnect";
import { sendTransaction } from "@/lib/web3/wallet";

export default function JobStatusPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId: jobIdStr } = usePromise(params);
  const jobId = BigInt(jobIdStr);

  const [job, setJob] = useState<OnChainJob | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [disputeWindow, setDisputeWindow] = useState<bigint | null>(null);
  const [wallet, setWallet] = useState<`0x${string}` | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refresh() {
    try {
      const client = getPublicClient();
      const { commerce, policy } = getErc8183Addresses();
      const raw = await client.readContract({ address: commerce, abi: AGENTIC_COMMERCE_ABI, functionName: "getJob", args: [jobId] });
      const decoded = decodeJobTuple(raw as Record<string, unknown>);
      setJob(decoded);

      const paymentToken = (await client.readContract({ address: commerce, abi: AGENTIC_COMMERCE_ABI, functionName: "paymentToken" })) as `0x${string}`;
      const [decimals, symbol] = await Promise.all([
        client.readContract({ address: paymentToken, abi: MINIMAL_ERC20_ABI, functionName: "decimals" }) as Promise<number>,
        client.readContract({ address: paymentToken, abi: MINIMAL_ERC20_ABI, functionName: "symbol" }) as Promise<string>,
      ]);
      setTokenDecimals(decimals);
      setTokenSymbol(symbol);

      const window_ = (await client.readContract({ address: policy, abi: OPTIMISTIC_POLICY_ABI, functionName: "disputeWindow" })) as bigint;
      setDisputeWindow(window_);
    } catch {
      setLoadError("Could not read this job from BSC Testnet. It may not exist, or the RPC is unreachable.");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIdStr]);

  async function runAction(action: "settle" | "claimRefund" | "cancel") {
    if (!wallet || !job) return;
    setActionError(null);
    setBusy(action);
    try {
      const intent =
        action === "settle" ? buildSettleTx(job.id) : action === "claimRefund" ? buildClaimRefundTx(job.id) : buildCancelOpenTx(job.id);
      const hash = await sendTransaction(wallet, intent);
      const client = getPublicClient();
      await client.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Transaction failed.");
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">{loadError}</div>;
  if (!job) return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">Loading job #{jobIdStr}…</div>;

  const isClient = wallet && wallet.toLowerCase() === job.client.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const settleEligible =
    job.status === JobStatus.SUBMITTED && disputeWindow !== null && now >= Number(job.submittedAt) + Number(disputeWindow);
  const canDispute = job.status === JobStatus.SUBMITTED && disputeWindow !== null && now < Number(job.submittedAt) + Number(disputeWindow);
  const canCancel = job.status === JobStatus.OPEN;
  const canRefund = job.status === JobStatus.REJECTED || job.status === JobStatus.EXPIRED;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Job #{jobIdStr}</h1>
        <WalletConnect onConnected={setWallet} />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <StatusBadge status={job.status} />
          <span className="text-xs text-muted-foreground">BSC Testnet</span>
        </div>
        <p className="mt-4 text-sm">{job.description || "No description."}</p>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <Field label="Budget" value={tokenDecimals !== null ? `${formatUnits(job.budget, tokenDecimals)} ${tokenSymbol}` : "—"} />
          <Field label="Provider" value={short(job.provider)} />
          <Field label="Client" value={short(job.client)} />
          <Field label="Deadline" value={new Date(Number(job.expiredAt) * 1000).toLocaleString()} />
        </dl>

        {actionError && <p className="mt-4 text-xs text-danger">{actionError}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          {isClient && canCancel && (
            <ActionButton label="Cancel job" busy={busy === "cancel"} onClick={() => runAction("cancel")} />
          )}
          {canDispute && isClient && (
            <p className="text-xs text-muted-foreground">
              Within the dispute window — this app doesn&apos;t yet expose a dispute UI (evidence review is out of
              Phase 5 scope).
            </p>
          )}
          {settleEligible && (
            <ActionButton label="Settle (release payment)" busy={busy === "settle"} onClick={() => runAction("settle")} />
          )}
          {isClient && canRefund && (
            <ActionButton label="Claim refund" busy={busy === "claimRefund"} onClick={() => runAction("claimRefund")} />
          )}
        </div>
      </div>
    </div>
  );
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const color =
    status === JobStatus.COMPLETED
      ? "bg-success/10 text-success"
      : status === JobStatus.REJECTED || status === JobStatus.EXPIRED
        ? "bg-danger/10 text-danger"
        : "bg-accent/10 text-accent";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{jobStatusLabel(status)}</span>;
}

function ActionButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
    >
      {busy ? "Confirming…" : label}
    </button>
  );
}
