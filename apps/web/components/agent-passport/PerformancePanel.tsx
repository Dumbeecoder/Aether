import type { AgentProfile } from "@/lib/agents";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg">{value}</div>
    </div>
  );
}

function avgResponseTime(agent: AgentProfile): string {
  const times = agent.endpoints
    .map((e) => e.responseTimeMs)
    .filter((t): t is number => t !== null);
  if (times.length === 0) return "Not measured yet";
  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  return `${Math.round(avg)}ms`;
}

function lastActive(agent: AgentProfile): string {
  const timestamps = agent.endpoints
    .map((e) => e.lastChecked)
    .filter((t): t is string => t !== null)
    .sort()
    .reverse();
  if (timestamps.length === 0) return "Not measured yet";
  return new Date(timestamps[0] as string).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PerformancePanel({ agent }: { agent: AgentProfile }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">Performance</h2>
          <span className="text-xs text-muted-foreground">
            {agent.performance ? "Measured, not self-reported" : "No measured data yet"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Stat
            label="Success rate"
            value={agent.performance?.successRate !== null && agent.performance?.successRate !== undefined
              ? `${agent.performance.successRate.toFixed(1)}%`
              : "Not measured yet"}
          />
          <Stat
            label="Completed tasks"
            value={agent.performance ? agent.performance.totalTasks.toLocaleString() : "Not measured yet"}
          />
          <Stat label="Avg. response" value={avgResponseTime(agent)} />
          <Stat label="Last active" value={lastActive(agent)} />
        </div>
        {/* No total volume / total earnings shown: the schema has no such
            columns today (agent_performance only tracks task counts and
            execution time), so surfacing them would mean inventing numbers.
            A real chart is skipped for the same reason — there's no
            historical time-series table behind these metrics, only a
            single current-state row per agent. */}
      </div>

      {agent.capabilities.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-base font-semibold">Capabilities</h2>
          <div className="flex flex-wrap gap-2">
            {agent.capabilities.map((c) => (
              <span
                key={c.capability}
                className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm"
                title={c.provenance === "onchain" ? "Read from the agent's on-chain metadata" : "Provided by the agent"}
              >
                {c.capability}
              </span>
            ))}
          </div>
        </div>
      )}

      {agent.protocols.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-base font-semibold">Supported Protocols</h2>
          <div className="flex flex-wrap gap-2">
            {agent.protocols.map((p) => (
              <span
                key={p}
                className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
