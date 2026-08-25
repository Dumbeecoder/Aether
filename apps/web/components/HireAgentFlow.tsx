"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUnits, parseUnits, decodeEventLog, type Address } from "viem";
import { WalletConnect } from "./WalletConnect";
import {
  buildCreateJobTx,
  buildRegisterJobTx,
  buildSetBudgetTx,
  buildApproveTx,
  buildFundTx,
  validateExpiry,
} from "@/lib/web3/erc8183";
import { sendTransaction } from "@/lib/web3/wallet";
import { getPublicClient } from "@/lib/web3/publicClient";
import { getErc8183Addresses } from "@/lib/web3/network";
import { AGENTIC_COMMERCE_ABI, OPTIMISTIC_POLICY_ABI, MINIMAL_ERC20_ABI } from "@/lib/web3/abis";

const EXPIRY_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

type Step =
  | "connect"
  | "form"
  | "review"
  | "creating"
  | "registering"
  | "setting-budget"
  | "approving"
  | "funding"
  | "recording"
  | "done"
  | "error";

const STEP_LABELS: Partial<Record<Step, string>> = {
  creating: "Creating job (sign in your wallet)…",
  registering: "Binding the settlement policy (sign in your wallet)…",
  "setting-budget": "Setting budget (sign in your wallet)…",
  approving: "Approving token spend (sign in your wallet)…",
  funding: "Funding the job (sign in your wallet)…",
  recording: "Recording the job…",
};

export function HireAgentFlow({ agentSlug, agentName, agentWallet }: { agentSlug: string; agentName: string; agentWallet: Address }) {
  const router = useRouter();
  const [wallet, setWallet] = useState<Address | null>(null);
  const [description, setDescription] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [expiryDays, setExpiryDays] = useState(30);
  const [step, setStep] = useState<Step>("connect");
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<bigint | null>(null);

  function goToForm(addr: Address) {
    setWallet(addr);
    setStep("form");
  }

  async function runHireFlow() {
    if (!wallet) return;
    setError(null);

    try {
      const publicClient = getPublicClient();
      const { commerce, policy } = getErc8183Addresses();

      // Read live chain state right before acting on it — never assume a
      // cached value is still accurate (payment token, decimals, dispute
      // window, current allowance).
      const paymentToken = (await publicClient.readContract({
        address: commerce,
        abi: AGENTIC_COMMERCE_ABI,
        functionName: "paymentToken",
      })) as Address;
      const decimals = (await publicClient.readContract({
        address: paymentToken,
        abi: MINIMAL_ERC20_ABI,
        functionName: "decimals",
      })) as number;
      const disputeWindow = (await publicClient.readContract({
        address: policy,
        abi: OPTIMISTIC_POLICY_ABI,
        functionName: "disputeWindow",
      })) as bigint;

      const expiredAtUnixSeconds = Math.floor(Date.now() / 1000) + expiryDays * 86400;
      const expiryCheck = validateExpiry(expiredAtUnixSeconds, Number(disputeWindow));
      if (!expiryCheck.valid) {
        setError(expiryCheck.reason);
        setStep("form");
        return;
      }

      const budgetAmount = parseUnits(budgetInput, decimals);

      // Step 1: createJob
      setStep("creating");
      const createTx = buildCreateJobTx({ provider: agentWallet, expiredAtUnixSeconds, description });
      const createHash = await sendTransaction(wallet, createTx);
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

      let createdJobId: bigint | null = null;
      for (const log of createReceipt.logs) {
        if (log.address.toLowerCase() !== commerce.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi: AGENTIC_COMMERCE_ABI, data: log.data, topics: log.topics, eventName: "JobCreated" });
          createdJobId = decoded.args.jobId as bigint;
          break;
        } catch {
          continue; // not the event we're looking for — try the next log
        }
      }
      if (createdJobId === null) throw new Error("Job was created but its ID could not be read from the transaction log.");
      setJobId(createdJobId);

      // Step 2: registerJob (binds the settlement policy — must happen before fund)
      setStep("registering");
      const registerHash = await sendTransaction(wallet, buildRegisterJobTx(createdJobId));
      await publicClient.waitForTransactionReceipt({ hash: registerHash });

      // Step 3: setBudget
      setStep("setting-budget");
      const budgetHash = await sendTransaction(wallet, buildSetBudgetTx(createdJobId, budgetAmount));
      await publicClient.waitForTransactionReceipt({ hash: budgetHash });

      // Step 4: approve, only if current allowance is insufficient — and
      // only for the exact amount this job needs (see buildApproveTx).
      const currentAllowance = (await publicClient.readContract({
        address: paymentToken,
        abi: MINIMAL_ERC20_ABI,
        functionName: "allowance",
        args: [wallet, commerce],
      })) as bigint;
      if (currentAllowance < budgetAmount) {
        setStep("approving");
        const approveHash = await sendTransaction(wallet, buildApproveTx(paymentToken, commerce, budgetAmount));
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Step 5: fund
      setStep("funding");
      const fundHash = await sendTransaction(wallet, buildFundTx(createdJobId, budgetAmount));
      await publicClient.waitForTransactionReceipt({ hash: fundHash });

      // Step 6: record in Aether's own DB — the API route independently
      // re-reads the job from the chain before trusting any of this.
      setStep("recording");
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: createdJobId.toString(), txHash: createHash, clientWallet: wallet, agentSlug }),
      });

      setStep("done");
      router.push(`/tasks/${createdJobId.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong during the hire flow.");
      setStep("error");
    }
  }

  if (step === "connect") {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">Connect your wallet to hire {agentName}.</p>
        <div className="flex justify-center">
          <WalletConnect onConnected={goToForm} />
        </div>
      </div>
    );
  }

  if (step === "form" || step === "review") {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-semibold">Hire {agentName}</h2>
        <p className="mt-1 text-xs text-muted-foreground">BSC Testnet — no real funds are at risk.</p>

        <label className="mt-4 block text-sm">
          Task description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-surface-2 p-2 text-sm"
          />
        </label>

        <label className="mt-4 block text-sm">
          Budget
          <input
            type="text"
            inputMode="decimal"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-border bg-surface-2 p-2 text-sm"
          />
        </label>

        <div className="mt-4">
          <span className="block text-sm">Job deadline</span>
          <div className="mt-1 flex gap-2">
            {EXPIRY_PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => setExpiryDays(p.days)}
                className={
                  expiryDays === p.days
                    ? "rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
                    : "rounded-md border border-border px-3 py-1.5 text-xs"
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-danger">{error}</p>}

        <button
          onClick={runHireFlow}
          disabled={!description || !budgetInput}
          className="mt-6 w-full rounded-md bg-accent py-2 text-sm font-medium text-accent-foreground disabled:opacity-40"
        >
          Confirm &amp; hire
        </button>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/5 p-6">
        <p className="text-sm text-danger">{error}</p>
        {jobId !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Job #{jobId.toString()} was created on-chain before this step failed — check its status at{" "}
            <a href={`/tasks/${jobId.toString()}`} className="underline">
              /tasks/{jobId.toString()}
            </a>
            .
          </p>
        )}
        <button onClick={() => setStep("form")} className="mt-4 rounded-md border border-border px-3 py-1.5 text-sm">
          Try again
        </button>
      </div>
    );
  }

  // In-progress steps
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center">
      <p className="text-sm">{STEP_LABELS[step]}</p>
      {jobId !== null && <p className="mt-2 text-xs text-muted-foreground">Job #{jobId.toString()}</p>}
    </div>
  );
}

// Re-export for pages that need to format a raw budget amount consistently
// with what this component itself uses.
export { formatUnits };
