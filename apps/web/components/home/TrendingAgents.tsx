import type { HomepageAgentCard } from "@/lib/homepageData";
import { AgentCard } from "./AgentCard";
import { SectionHeading } from "./SectionHeading";

export function TrendingAgents({ agents }: { agents: HomepageAgentCard[] }) {
  if (agents.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Trending"
        title="Top-ranked agents right now"
        description="Ranked by Aether Score — a transparent, auditable blend of verified identity, endpoint health, and measured task performance."
        cta={{ label: "View all agents", href: "/agents" }}
      />
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.slug} agent={agent} />
        ))}
      </div>
    </section>
  );
}
