import Link from "next/link";
import { listAgents, CATEGORY_LABELS } from "@/lib/agents";
import { AgentCompareGrid } from "@/components/AgentCompareGrid";

export const metadata = { title: "Explore agents — Aether" };

// Server component: filters arrive as query params (?category=risk&chain=97&
// verified=1&q=liquidation) so the page stays link-shareable without client
// state — Phase 3 scope is basic substring search + sorting; semantic NL
// search is Phase 4 (spec Section 12/22).
export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; chain?: string; verified?: string; q?: string }>;
}) {
  const params = await searchParams;
  const chainId = params.chain ? Number(params.chain) : undefined;

  const result = await listAgents({
    category: params.category,
    chainId,
    verifiedOnly: params.verified === "1",
    search: params.q,
    sort: "score",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Explore agents</h1>
      <p className="mt-2 text-muted-foreground">
        Agents discovered from the ERC-8004 Identity Registry on BNB Chain.
      </p>

      <form action="/agents" method="get" className="mt-6">
        {params.category && <input type="hidden" name="category" value={params.category} />}
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Search agents by name or description…"
          className="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterLink href="/agents" active={!params.category}>
          All
        </FilterLink>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <FilterLink key={key} href={`/agents?category=${key}`} active={params.category === key}>
            {label}
          </FilterLink>
        ))}
      </div>

      <div className="mt-8 pb-20">
        {result.status === "not_configured" && (
          <EmptyState
            title="Supabase isn't connected yet"
            body="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, apply the migrations, and run the indexer to see real agents here."
          />
        )}
        {result.status === "error" && (
          <EmptyState title="Couldn't load agents" body={result.message} />
        )}
        {result.status === "ok" && result.agents.length === 0 && (
          <EmptyState
            title="No agents indexed yet"
            body="Run the ERC-8004 indexer against BSC Testnet to discover registered agents: python -m agentx_worker.indexer --chain 97 --from-block <block>"
          />
        )}
        {result.status === "ok" && result.agents.length > 0 && (
          <AgentCompareGrid agents={result.agents} />
        )}
      </div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
          : "rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-surface-2"
      }
    >
      {children}
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

