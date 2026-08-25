import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAgentBySlug, getSimilarAgents, CATEGORY_LABELS } from "@/lib/agents";
import { getAgentActivity } from "@/lib/jobs";
import { PassportHero } from "@/components/agent-passport/PassportHero";
import { PerformancePanel } from "@/components/agent-passport/PerformancePanel";
import { TrustPanel } from "@/components/agent-passport/TrustPanel";
import { ActivitySection, SimilarAgents } from "@/components/agent-passport/ActivitySimilar";
import { HireCTA } from "@/components/agent-passport/HireCTA";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getAgentBySlug(slug);
  if (result.status !== "ok") return { title: "Agent" };
  const { agent } = result;
  const categoryLabel = CATEGORY_LABELS[agent.category ?? "other"];
  return {
    title: agent.name,
    description: agent.description ?? `${categoryLabel} agent on Aether.`,
    openGraph: {
      title: `${agent.name} — Aether`,
      description: agent.description ?? `${categoryLabel} agent on Aether.`,
    },
  };
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getAgentBySlug(slug);

  if (result.status === "not_found") notFound();

  if (result.status === "not_configured") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-medium">Supabase isn&apos;t connected yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Agent profiles need a configured Supabase project to load real data.
        </p>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-medium">Couldn&apos;t load this agent</p>
        <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  const { agent } = result;

  const [similarAgents, activityResult] = await Promise.all([
    getSimilarAgents(agent.category, agent.slug),
    getAgentActivity(agent.id),
  ]);
  const activityItems = activityResult.status === "ok" ? activityResult.items : [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <PassportHero agent={agent} />

      <div className="grid grid-cols-1 gap-6 pb-6 lg:grid-cols-[1.5fr_1fr]">
        <PerformancePanel agent={agent} />
        <TrustPanel agent={agent} />
      </div>

      <ActivitySection items={activityItems} />
      <SimilarAgents agents={similarAgents} />
      <HireCTA agent={agent} />
    </div>
  );
}
