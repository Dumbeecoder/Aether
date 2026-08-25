import Link from "next/link";
import { listAgents, CATEGORY_LABELS } from "@/lib/agents";
import { partitionAgentsForRankings } from "@/lib/rankings";

export const metadata = { title: "Rankings — Aether" };

const CATEGORIES = ["trading", "yield", "risk", "monitoring", "pancakeswap"] as const;

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category = params.category && CATEGORIES.includes(params.category as (typeof CATEGORIES)[number])
    ? params.category
    : undefined;

  const result = await listAgents({ category, sort: "score" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Agent Arena</h1>
      <p className="mt-2 text-muted-foreground">Leaderboard across the marketplace, ranked by Aether Score.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/rankings"
          className={
            !category
              ? "rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
              : "rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-surface-2"
          }
        >
          All categories
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/rankings?category=${c}`}
            className={
              category === c
                ? "rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                : "rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-surface-2"
            }
          >
            {CATEGORY_LABELS[c]}
          </Link>
        ))}
      </div>

      {result.status !== "ok" && (
        <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {result.status === "not_configured"
              ? "Supabase isn't connected yet."
              : result.status === "error"
                ? result.message
                : "No agents found."}
          </p>
        </div>
      )}

      {result.status === "ok" && (
        <>
          {(() => {
            // Audit fix (Phase 3.1): seeded/demo fixtures must never sit in
            // the ranked leaderboard indistinguishable from real on-chain
            // agents — see lib/rankings.ts.
            const { ranked, freshOnchain, seeded } = partitionAgentsForRankings(result.agents);
            return (
              <>
                <div className="mt-8 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Aether Score</th>
                        <th className="px-4 py-3">Identity</th>
                        <th className="px-4 py-3">Endpoint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                            No scored agents yet — scoring requires at least one completed task.
                          </td>
                        </tr>
                      )}
                      {ranked.map((agent, i) => (
                        <tr key={agent.id} className="border-t border-border">
                          <td className="px-4 py-3 font-mono text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-3">
                            <Link href={`/agents/${agent.slug}`} className="hover:text-accent">
                              {agent.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {CATEGORY_LABELS[agent.category ?? "other"]}
                          </td>
                          <td className="px-4 py-3 font-mono">{agent.score.score}</td>
                          <td className="px-4 py-3">{agent.identityVerified ? "✓" : "—"}</td>
                          <td className="px-4 py-3">{agent.endpointVerified ? "✓" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {freshOnchain.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      New agents ({freshOnchain.length}) — not yet scored
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {freshOnchain.map((agent) => (
                        <Link
                          key={agent.id}
                          href={`/agents/${agent.slug}`}
                          className="rounded-full border border-border px-3 py-1 text-sm hover:bg-surface-2"
                        >
                          {agent.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {seeded.length > 0 && (
                  <div className="mt-8 rounded-lg border border-dashed border-border p-4">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Seeded / demo agents ({seeded.length}) — excluded from rankings
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      These are development fixtures, not real on-chain agents. They never appear in the
                      ranked leaderboard above regardless of score.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {seeded.map((agent) => (
                        <Link
                          key={agent.id}
                          href={`/agents/${agent.slug}`}
                          className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:bg-surface-2"
                        >
                          {agent.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
