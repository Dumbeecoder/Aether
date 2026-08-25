import type { AgentProfile } from "./agents";

/**
 * Produces a plain-language "why this one" explanation from real score
 * components only — no LLM call. Spec Section 11 asks for an "AI
 * explanation," but Phase 4 is explicitly where the AI provider
 * abstraction and NL search get wired in; calling an LLM here without that
 * abstraction in place would mean hardcoding to one provider, which the
 * spec's own AI section prohibits. This rules-based version satisfies the
 * actual requirement underneath the ask — "explain the recommendation using
 * only real data, never invent" — and can be swapped for an LLM-phrased
 * version in Phase 4 without changing what data backs it.
 */
export function explainRecommendation(agents: AgentProfile[]): string | null {
  const scored = agents.filter((a) => a.score.status === "scored");
  if (scored.length < 2) return null;

  const sorted = [...scored].sort((a, b) => (b.score.score ?? 0) - (a.score.score ?? 0));
  const top = sorted[0];
  const runnerUp = sorted[1];
  if (!top || !runnerUp) return null;
  const gap = (top.score.score ?? 0) - (runnerUp.score.score ?? 0);

  const topComponents = top.score.components.filter((c) => c.value !== null);
  const strongest = [...topComponents].sort((a, b) => (b.value as number) - (a.value as number))[0];

  const reasons: string[] = [];
  if (strongest) {
    reasons.push(`the strongest ${strongest.label.toLowerCase()} (${Math.round(strongest.value as number)}/100)`);
  }
  if (top.identityVerified && top.endpointVerified) {
    reasons.push("a fully verified identity and endpoint");
  }
  if (top.performance && runnerUp.performance && top.performance.totalTasks > runnerUp.performance.totalTasks) {
    reasons.push(`a larger track record (${top.performance.totalTasks} vs ${runnerUp.performance.totalTasks} tasks)`);
  }

  const reasonText = reasons.length > 0 ? reasons.join(" and ") : "a higher overall Aether Score";

  // Audit fix (Phase 3.1): nothing upstream strips seeded/demo fixtures out
  // of a comparison request, so a demo agent could legitimately "win" a
  // comparison against a real one. The recommendation sentence itself must
  // say so — a caveat buried in a table column is easy to miss right where
  // a hiring decision would be made.
  const seededNote = top.dataSource === "seeded" ? " Note: this is a seeded/demo agent, not a real on-chain agent." : "";

  return gap > 0
    ? `${top.name} is recommended: it has ${reasonText}, ${gap} points ahead of ${runnerUp.name}.${seededNote}`
    : `${top.name} and ${runnerUp.name} are effectively tied on Aether Score — compare the breakdown below for the deciding factor that matters most for your task.${seededNote}`;
}
