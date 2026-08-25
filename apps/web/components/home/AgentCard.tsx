import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/agents";
import type { HomepageAgentCard } from "@/lib/homepageData";
import { ScoreRing, AgentAvatar } from "./ScoreRing";

const STATUS_STYLES: Record<HomepageAgentCard["status"], string> = {
  online: "bg-success/10 text-success",
  degraded: "bg-warning/10 text-warning",
  offline: "bg-danger/10 text-danger",
  unknown: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<HomepageAgentCard["status"], string> = {
  online: "Online",
  degraded: "Degraded",
  offline: "Offline",
  unknown: "Status unknown",
};

export function AgentCard({ agent, className = "" }: { agent: HomepageAgentCard; className?: string }) {
  return (
    <div
      className={`group relative flex flex-col rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_8px_30px_-12px_hsl(var(--accent)/0.25)] ${className}`}
    >
      <Link href={`/agents/${agent.slug}`} className="flex flex-1 flex-col focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <AgentAvatar seed={agent.avatarSeed} name={agent.name} />
            <div>
              <h3 className="font-semibold leading-tight tracking-tight">{agent.name}</h3>
              <span className="text-xs text-muted-foreground">
                {CATEGORY_LABELS[agent.category] ?? "Other"}
              </span>
            </div>
          </div>
          <ScoreRing score={agent.score} />
        </div>

        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{agent.description}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
          <div>
            <div className="text-muted-foreground">Success rate</div>
            <div className="mt-0.5 font-mono text-sm">
              {agent.successRate !== null ? `${agent.successRate.toFixed(1)}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Response time</div>
            <div className="mt-0.5 font-mono text-sm">
              {agent.responseTimeMs !== null ? `${agent.responseTimeMs}ms` : "—"}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[agent.status]}`}>
            {STATUS_LABELS[agent.status]}
          </span>
          {agent.dataSource === "seeded" && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              Demo data
            </span>
          )}
        </div>
      </Link>

      <div className="mt-4 flex gap-2">
        {agent.hireable ? (
          <Link
            href={`/hire/${agent.slug}`}
            className="flex-1 rounded-md bg-accent px-3 py-2 text-center text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Hire agent
          </Link>
        ) : (
          <button
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
            disabled
            aria-disabled="true"
            title="Hiring is BSC Testnet only in this phase"
          >
            Hire agent
          </button>
        )}
        <Link
          href={`/compare?agents=${agent.slug}`}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
        >
          Compare
        </Link>
      </div>
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-surface-2" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-surface-2" />
          <div className="h-3 w-1/3 rounded bg-surface-2" />
        </div>
        <div className="h-11 w-11 rounded-full bg-surface-2" />
      </div>
      <div className="mt-4 h-3 w-full rounded bg-surface-2" />
      <div className="mt-2 h-3 w-4/5 rounded bg-surface-2" />
      <div className="mt-5 h-9 w-full rounded bg-surface-2" />
    </div>
  );
}
