"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentListItem } from "@/lib/agents";
import { AgentListCard } from "./AgentPassport";

const MAX_COMPARE = 3;

/** Wraps the agent grid with compare checkboxes and a sticky action bar.
 * Client-only because selection is ephemeral UI state, not something that
 * needs to survive a refresh — no localStorage needed for this. */
export function AgentCompareGrid({ agents }: { agents: AgentListItem[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();

  function toggle(slug: string) {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_COMPARE) return prev; // spec Section 11: side-by-side, keep it to a readable few
      return [...prev, slug];
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div key={agent.id} className="relative">
            <label className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-surface/90 px-2 py-1 text-xs backdrop-blur">
              <input
                type="checkbox"
                checked={selected.includes(agent.slug)}
                onChange={() => toggle(agent.slug)}
                disabled={!selected.includes(agent.slug) && selected.length >= MAX_COMPARE}
                aria-label={`Select ${agent.name} for comparison`}
              />
              Compare
            </label>
            <AgentListCard agent={agent} />
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2 shadow-lg">
            <span className="text-sm text-muted-foreground">
              {selected.length} selected{selected.length === 1 ? " — pick at least 2" : ""}
            </span>
            <button
              className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground disabled:opacity-40"
              disabled={selected.length < 2}
              onClick={() => router.push(`/compare?agents=${selected.join(",")}`)}
            >
              Compare
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
