import Link from "next/link";
import { getAgentsBySlugs, dedupeAndCapSlugs, CATEGORY_LABELS } from "@/lib/agents";
import { explainRecommendation } from "@/lib/compare";

export const metadata = { title: "Compare agents — Aether" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ agents?: string }>;
}) {
  const params = await searchParams;
  const slugs = dedupeAndCapSlugs(
    (params.agents ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  if (slugs.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Compare agents</h1>
        <p className="mt-3 text-muted-foreground">
          Pick 2–3 agents from{" "}
          <Link href="/agents" className="text-accent hover:underline">
            Explore
          </Link>{" "}
          to compare them side by side.
        </p>
      </div>
    );
  }

  const agents = await getAgentsBySlugs(slugs);

  if (agents.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-muted-foreground">None of the requested agents could be found.</p>
      </div>
    );
  }

  const explanation = explainRecommendation(agents);

  const rows: { label: string; render: (a: (typeof agents)[number]) => React.ReactNode }[] = [
    {
      label: "Aether Score",
      render: (a) => (a.score.status === "scored" ? a.score.score : "New"),
    },
    { label: "Category", render: (a) => CATEGORY_LABELS[a.category ?? "other"] },
    {
      label: "Task success rate",
      render: (a) => (a.performance ? `${(a.performance.successRate ?? 0).toFixed(1)}%` : "Insufficient data"),
    },
    {
      label: "Tasks",
      render: (a) => (a.performance ? a.performance.totalTasks.toLocaleString() : "Insufficient data"),
    },
    { label: "Identity verified", render: (a) => (a.identityVerified ? "✓" : "—") },
    { label: "Endpoint verified", render: (a) => (a.endpointVerified ? "✓" : "—") },
    { label: "Performance verified", render: (a) => (a.performanceVerified ? "✓" : "—") },
    { label: "Cost", render: () => "Insufficient data" }, // no real pricing source until Phase 5 (ERC-8183)
    {
      // Audit fix (Phase 3.1): make provenance visible in the comparison
      // itself, not just on /agents — this is the page where a hiring
      // decision actually gets made.
      label: "Data source",
      render: (a) => (a.dataSource === "seeded" ? "Seeded (demo)" : "On-chain"),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Compare agents</h1>

      {explanation && (
        <div className="mt-6 rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm">
          {explanation}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Metric</th>
              {agents.map((a) => (
                <th key={a.id} className="px-4 py-3">
                  <Link href={`/agents/${a.slug}`} className="hover:text-accent">
                    {a.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">{row.label}</td>
                {agents.map((a) => (
                  <td key={a.id} className="px-4 py-3 font-mono">
                    {row.render(a)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Recommendation is generated from the Aether Score breakdown above — not an LLM. Natural-language
        explanations ship with AI search in a later phase.
      </p>
    </div>
  );
}
