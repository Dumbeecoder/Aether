import Link from "next/link";
import type { AgentProfile } from "@/lib/agents";

export function HireCTA({ agent }: { agent: AgentProfile }) {
  const hireable = agent.chainId === 97;

  return (
    <section className="my-10 rounded-xl border border-border bg-surface px-8 py-14 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">Ready to put {agent.name} to work?</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        You set the maximum budget, {agent.name} works within it, and every transaction is signed
        from your own wallet — Aether never holds your funds or your keys.
      </p>
      <div className="mt-6">
        {hireable ? (
          <Link
            href={`/hire/${agent.slug}`}
            className="inline-block rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Hire {agent.name}
          </Link>
        ) : (
          <button
            className="inline-block rounded-lg border border-border px-6 py-3 text-sm text-muted-foreground"
            disabled
            aria-disabled="true"
            title="Hiring is BSC Testnet only in this phase — this agent is indexed from a different chain"
          >
            Hire {agent.name}
          </button>
        )}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        You control the permissions and approve every transaction.
      </p>
    </section>
  );
}
