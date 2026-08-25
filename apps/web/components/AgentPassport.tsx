import Link from "next/link";
import type { AgentListItem } from "@/lib/agents";
import { CATEGORY_LABELS } from "@/lib/agents";

export function CategoryPill({ category }: { category: string | null }) {
  const label = CATEGORY_LABELS[category ?? "other"] ?? "Other";
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-muted-foreground">
      {label}
    </span>
  );
}

/** Compact card for the /agents grid. */
export function AgentListCard({ agent }: { agent: AgentListItem }) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="block rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent/50 hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold tracking-tight">{agent.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {agent.description ?? "No description provided."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {agent.score.status === "scored" && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {agent.score.score}
            </span>
          )}
          {agent.identityVerified && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
              Identity ✓
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <CategoryPill category={agent.category} />
        <span className="text-xs text-muted-foreground">
          {agent.dataSource === "seeded" ? "Seeded (demo)" : "On-chain"}
        </span>
      </div>
    </Link>
  );
}
