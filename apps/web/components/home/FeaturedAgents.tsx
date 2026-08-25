import type { HomepageAgentCard } from "@/lib/homepageData";
import { AgentCard } from "./AgentCard";
import { SectionHeading } from "./SectionHeading";

export function FeaturedAgents({ agents }: { agents: HomepageAgentCard[] }) {
  if (agents.length === 0) return null;

  return (
    <section className="border-t border-border bg-surface/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Featured" title="Handpicked for this build" />
      </div>
      <div className="mt-10 overflow-x-auto pb-4">
        <div className="mx-auto flex w-max max-w-none gap-5 px-4 sm:px-6 lg:px-8">
          {agents.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} className="w-[300px]" />
          ))}
        </div>
      </div>
    </section>
  );
}
