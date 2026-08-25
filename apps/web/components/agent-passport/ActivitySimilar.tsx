import Link from "next/link";
import type { AgentListItem } from "@/lib/agents";
import type { AgentActivityItem } from "@/lib/jobs";
import { CATEGORY_LABELS } from "@/lib/agents";
import { ScoreRing, AgentAvatar } from "@/components/home/ScoreRing";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivitySection({ items }: { items: AgentActivityItem[] }) {
  return (
    <section className="py-10">
      <h2 className="mb-5 text-xl font-semibold tracking-tight">Recent Activity</h2>
      <div className="rounded-xl border border-border bg-surface">
        {items.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No recorded hire activity for this agent yet.
          </div>
        ) : (
          <ul>
            {items.map((item, i) => (
              <li
                key={item.id}
                className={`flex items-center justify-between gap-4 px-6 py-4 ${
                  i < items.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div>
                  <div className="text-sm font-medium capitalize">{item.status}</div>
                  {item.description && (
                    <div className="mt-0.5 text-sm text-muted-foreground">{item.description}</div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function SimilarAgents({ agents }: { agents: AgentListItem[] }) {
  if (agents.length === 0) return null;

  return (
    <section className="py-10">
      <h2 className="mb-5 text-xl font-semibold tracking-tight">Similar Agents</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {agents.map((agent) => (
          <div key={agent.slug} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <AgentAvatar seed={agent.slug} name={agent.name} size={40} />
              <div>
                <div className="text-sm font-semibold">{agent.name}</div>
                <div className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[agent.category ?? "other"]}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <ScoreRing score={agent.score.status === "scored" ? agent.score.score : null} size={26} />
                <span className="text-sm font-medium">
                  {agent.score.status === "scored" ? agent.score.score : "New"}
                </span>
              </div>
              <Link href={`/agents/${agent.slug}`} className="text-xs font-medium text-accent hover:underline">
                View Passport →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
