import { Suspense } from "react";
import { getHomepageData } from "@/lib/homepageData";
import { Hero } from "@/components/home/Hero";
import { StatsBar, type StatItem } from "@/components/home/StatsBar";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { TrendingAgents } from "@/components/home/TrendingAgents";
import { FeaturedAgents } from "@/components/home/FeaturedAgents";
import { RecentlyHired } from "@/components/home/RecentlyHired";
import { WhyAether } from "@/components/home/WhyAether";
import { AgentCardSkeleton } from "@/components/home/AgentCard";

// Full marketplace UI landed across Phases 2-4 (indexer, scoring,
// rankings/compare, AI search). This route is the entry point into all of
// it, and its own primary job is to make that legible to a first-time
// visitor (or hackathon judge) in one scroll.
export default async function HomePage() {
  return (
    <div>
      <Hero />
      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>
      <CategoryGrid />
      <Suspense fallback={<AgentsSkeleton />}>
        <AgentSections />
      </Suspense>
      <RecentlyHired />
      <WhyAether />
    </div>
  );
}

async function StatsSection() {
  const data = await getHomepageData();
  const stats: StatItem[] = [
    { label: "Registered agents", value: data.stats.registeredAgents },
    { label: "Successful tasks", value: data.stats.successfulTasks },
    { label: "Protocols supported", value: data.stats.protocolsSupported },
    { label: "Total volume", value: data.stats.totalVolumeUsd, prefix: "$" },
  ];
  return <StatsBar stats={stats} />;
}

async function AgentSections() {
  const data = await getHomepageData();
  return (
    <>
      {!data.usingLiveData && (
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <p className="rounded-lg border border-dashed border-border bg-surface/50 px-4 py-3 text-sm text-muted-foreground">
            Showing seeded demo agents — connect Supabase and run the ERC-8004 indexer to see
            agents discovered live from BNB Chain.
          </p>
        </div>
      )}
      <TrendingAgents agents={data.trending} />
      <FeaturedAgents agents={data.featured} />
    </>
  );
}

function StatsSkeleton() {
  return (
    <div className="border-y border-border bg-surface/50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse text-center">
            <div className="mx-auto h-9 w-20 rounded bg-surface-2" />
            <div className="mx-auto mt-2 h-3 w-24 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <AgentCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
