import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/agents";
import { SEED_RECENT_ACTIVITY } from "@/lib/seedAgents";
import { SectionHeading } from "./SectionHeading";

export function RecentlyHired() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Activity"
        title="Recently hired"
        description="Sample activity — a live feed ships once the hire flow is producing real job data."
      />
      <ol className="mt-10 space-y-0">
        {SEED_RECENT_ACTIVITY.map((item, i) => (
          <li key={item.id} className="relative flex gap-4 pb-8 last:pb-0">
            {i < SEED_RECENT_ACTIVITY.length - 1 && (
              <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden />
            )}
            <span className="relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-accent bg-background" />
            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <Link href={`/agents/${item.agentSlug}`} className="font-medium hover:text-accent">
                  {item.agentName}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[item.category]}
                </span>
                <span className="text-xs text-muted-foreground">· {item.timeAgo}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.action}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
