import type { ReactNode } from "react";
import type { AgentProfile } from "@/lib/agents";
import { CopyableValue } from "./CopyableValue";

function VerificationDetailRow({
  facet,
  verified,
  verifiedNote,
  unverifiedNote,
}: {
  facet: string;
  verified: boolean;
  verifiedNote: string;
  unverifiedNote: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border">
      <div>
        <div className="text-sm font-medium">{facet}</div>
        <div className={`mt-0.5 text-xs ${verified ? "text-success" : "text-muted-foreground"}`}>
          {verified ? `✓ ${verifiedNote}` : unverifiedNote}
        </div>
      </div>
    </div>
  );
}

export function TrustPanel({ agent }: { agent: AgentProfile }) {
  const explorerBase = `https://${agent.chainId === 97 ? "testnet." : ""}bscscan.com`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-base font-semibold">Verification</h2>
        <VerificationDetailRow
          facet="Identity"
          verified={agent.identityVerified}
          verifiedNote="Read directly from the ERC-8004 registry event"
          unverifiedNote="Not yet confirmed on-chain"
        />
        <VerificationDetailRow
          facet="Endpoint"
          verified={agent.endpointVerified}
          verifiedNote="Confirmed by an independent health probe"
          unverifiedNote="Not yet independently checked"
        />
        <VerificationDetailRow
          facet="Performance"
          verified={agent.performanceVerified}
          verifiedNote="Computed from measured task outcomes"
          unverifiedNote="Not enough measured task data yet"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-base font-semibold">On-chain Identity</h2>
        {agent.dataSource === "seeded" ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-xs text-muted-foreground">
            This is a seeded demo agent — it has no real on-chain registration to display.
          </p>
        ) : (
          <div className="space-y-0 text-sm">
            <IdRow k="Chain" v={agent.chainId === 97 || agent.chainId === 56 ? "BNB Chain" : String(agent.chainId)} />
            <IdRow k="Network" v={agent.chainId === 97 ? "BSC Testnet" : agent.chainId === 56 ? "BSC Mainnet" : "Unknown"} />
            <IdRow k="Agent ID" v={`#${agent.agentId}`} />
            <IdRow
              k="Wallet"
              node={<CopyableValue value={agent.walletAddress} display={truncate(agent.walletAddress)} />}
            />
            {agent.identityRegistry && (
              <IdRow
                k="Registry"
                node={
                  <a
                    href={`${explorerBase}/address/${agent.identityRegistry}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    ERC-8004
                  </a>
                }
              />
            )}
            {agent.registrationTxHash && (
              <IdRow
                k="Registration tx"
                node={
                  <a
                    href={`${explorerBase}/tx/${agent.registrationTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    {truncate(agent.registrationTxHash)}
                  </a>
                }
              />
            )}
            {agent.registrationBlock !== null && <IdRow k="Registration block" v={agent.registrationBlock.toLocaleString()} />}
            {agent.registrationTimestamp && (
              <IdRow k="Registered" v={new Date(agent.registrationTimestamp).toLocaleDateString()} />
            )}
          </div>
        )}
      </div>

      {agent.score.status === "scored" && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-base font-semibold">Aether Score Breakdown</h2>
          <div className="space-y-4">
            {agent.score.components.map((c) => (
              <div key={c.key}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span>{c.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.value !== null ? Math.round(c.value) : "—"} · {Math.round(c.weight * 100)}% weight
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  {c.value !== null && (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                      style={{ width: `${Math.min(100, Math.max(0, c.value))}%` }}
                    />
                  )}
                </div>
                {c.note && <p className="mt-1.5 text-xs text-muted-foreground">{c.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function truncate(v: string) {
  return v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;
}

function IdRow({ k, v, node }: { k: string; v?: string; node?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{k}</span>
      {node ?? <span className="font-mono text-xs">{v}</span>}
    </div>
  );
}
