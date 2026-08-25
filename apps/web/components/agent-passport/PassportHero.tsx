"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { AgentProfile } from "@/lib/agents";
import { CATEGORY_LABELS } from "@/lib/agents";
import { ScoreRing, AgentAvatar } from "@/components/home/ScoreRing";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/** Endpoint health rolls up to a single online/offline dot for the hero —
 * "unknown" (no endpoints indexed yet) deliberately doesn't render as
 * either state, since we don't actually know. */
function deriveStatus(agent: AgentProfile): "online" | "degraded" | "offline" | "unknown" {
  if (agent.endpoints.length === 0) return "unknown";
  if (agent.endpoints.some((e) => e.healthStatus === "online")) return "online";
  if (agent.endpoints.some((e) => e.healthStatus === "degraded")) return "degraded";
  if (agent.endpoints.every((e) => e.healthStatus === "offline")) return "offline";
  return "unknown";
}

export function PassportHero({ agent }: { agent: AgentProfile }) {
  const status = deriveStatus(agent);

  return (
    <section className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-14">
      <div>
        <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AI Agent
          </span>
        </motion.div>

        <motion.div
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-3 flex items-center gap-4"
        >
          <AgentAvatar seed={agent.slug} name={agent.name} size={56} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{agent.name}</h1>
            <span className="text-sm text-accent">{CATEGORY_LABELS[agent.category ?? "other"]}</span>
          </div>
        </motion.div>

        <motion.p
          custom={2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-5 max-w-xl text-base text-muted-foreground"
        >
          {agent.description ?? "No description provided."}
        </motion.p>

        <motion.div
          custom={3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-5 flex flex-wrap items-center gap-2"
        >
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground">
            {CATEGORY_LABELS[agent.category ?? "other"]}
          </span>
          {agent.dataSource === "seeded" && (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs text-warning">
              Seeded — demo data, not a live on-chain agent
            </span>
          )}
        </motion.div>

        <motion.div
          custom={4}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-5 flex flex-wrap items-center gap-4 text-sm"
        >
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "online"
                  ? "bg-success"
                  : status === "degraded"
                    ? "bg-warning"
                    : status === "offline"
                      ? "bg-danger"
                      : "bg-muted-foreground"
              }`}
            />
            <span className="text-muted-foreground">
              {status === "online"
                ? "Online"
                : status === "degraded"
                  ? "Degraded"
                  : status === "offline"
                    ? "Offline"
                    : "No endpoint health data yet"}
            </span>
          </span>
          <span className="text-muted-foreground">
            {agent.dataSource === "seeded" ? "Seeded data" : "On-chain data"}
          </span>
        </motion.div>

        <motion.div
          custom={5}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-8 flex flex-wrap gap-3"
        >
          {agent.chainId === 97 ? (
            <Link
              href={`/hire/${agent.slug}`}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Hire Agent
            </Link>
          ) : (
            <button
              className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted-foreground"
              disabled
              aria-disabled="true"
              title="Hiring is BSC Testnet only in this phase — this agent is indexed from a different chain"
            >
              Hire Agent
            </button>
          )}
          <Link
            href={`/compare?agents=${agent.slug}`}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface-2"
          >
            Compare
          </Link>
        </motion.div>
      </div>

      <motion.div
        custom={2}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="rounded-xl border border-border bg-surface p-8"
      >
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Aether Score
        </div>
        <div className="mt-6 flex justify-center">
          <ScoreRing score={agent.score.status === "scored" ? agent.score.score : null} size={168} />
        </div>
        <div className="mt-6 space-y-2">
          <VerifyRow label="Identity Verified" verified={agent.identityVerified} />
          <VerifyRow label="Endpoint Verified" verified={agent.endpointVerified} />
          <VerifyRow label="Performance Verified" verified={agent.performanceVerified} />
        </div>
        <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          Verification status is based on independently observed data — never the agent&apos;s own
          claims about itself.
        </p>
      </motion.div>
    </section>
  );
}

function VerifyRow({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm">
      <span>{label}</span>
      <span className={verified ? "text-success" : "text-muted-foreground"}>
        {verified ? "✓" : "—"}
      </span>
    </div>
  );
}
