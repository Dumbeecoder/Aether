import { listAgents, CATEGORY_LABELS, type AgentListItem } from "./agents";
import { SEED_AGENTS, type SeedAgent } from "./seedAgents";

/** Common shape both a live `AgentListItem` and a `SeedAgent` can be
 * normalized into, so homepage components render one type regardless of
 * where the data came from — but `dataSource` always travels with it, so
 * the UI can still be honest about which is which. */
export interface HomepageAgentCard {
  slug: string;
  name: string;
  avatarSeed: string;
  category: string;
  description: string;
  score: number | null; // null → "New", matches existing AetherScoreResult semantics
  successRate: number | null;
  responseTimeMs: number | null;
  completedTasks: number | null;
  status: "online" | "degraded" | "offline" | "unknown";
  dataSource: "onchain" | "seeded";
  chainId: number;
  hireable: boolean;
}

function fromSeed(agent: SeedAgent): HomepageAgentCard {
  return {
    slug: agent.slug,
    name: agent.name,
    avatarSeed: agent.avatarSeed,
    category: agent.category,
    description: agent.description,
    score: agent.score,
    successRate: agent.successRate,
    responseTimeMs: agent.responseTimeMs,
    completedTasks: agent.completedTasks,
    status: agent.status,
    dataSource: "seeded",
    chainId: agent.chainId,
    hireable: agent.chainId === 97,
  };
}

function fromLive(agent: AgentListItem): HomepageAgentCard {
  return {
    slug: agent.slug,
    name: agent.name,
    avatarSeed: agent.slug,
    category: agent.category ?? "other",
    description: agent.description ?? "No description provided.",
    score: agent.score.status === "scored" ? agent.score.score : null,
    successRate: null, // not embedded in the list query today; profile page has it
    responseTimeMs: null,
    completedTasks: null,
    status: "unknown",
    dataSource: agent.dataSource,
    chainId: agent.chainId,
    hireable: agent.chainId === 97,
  };
}

export interface HomepageData {
  trending: HomepageAgentCard[];
  featured: HomepageAgentCard[];
  usingLiveData: boolean;
  stats: {
    registeredAgents: number;
    successfulTasks: number | null;
    protocolsSupported: number | null;
    totalVolumeUsd: number | null;
  };
  categories: { key: string; label: string; count: number }[];
}

/** Assembles everything the homepage needs in one place. Tries the real
 * `listAgents()` query first; only falls back to seed data when Supabase
 * isn't configured, errors, or genuinely has nothing indexed yet — never
 * mixes the two in the same section, so a section is either all-live or
 * all-demo, and callers can label it accordingly. */
export async function getHomepageData(): Promise<HomepageData> {
  const result = await listAgents({ sort: "score" });

  if (result.status === "ok" && result.agents.length > 0) {
    const cards = result.agents.map(fromLive);
    return {
      trending: cards.slice(0, 6),
      featured: cards.slice(0, 8),
      usingLiveData: true,
      stats: computeStats(result.agents),
      categories: computeCategoryCounts(result.agents.map((a) => a.category ?? "other")),
    };
  }

  const cards = SEED_AGENTS.map(fromSeed);
  return {
    trending: cards.slice(0, 6),
    featured: cards,
    usingLiveData: false,
    stats: {
      registeredAgents: SEED_AGENTS.length,
      successfulTasks: SEED_AGENTS.reduce((sum, a) => sum + a.completedTasks, 0),
      protocolsSupported: new Set(SEED_AGENTS.flatMap((a) => a.protocols)).size,
      totalVolumeUsd: SEED_AGENTS.reduce((sum, a) => sum + a.revenueUsd, 0),
    },
    categories: computeCategoryCounts(SEED_AGENTS.map((a) => a.category)),
  };
}

function computeStats(agents: AgentListItem[]) {
  return {
    registeredAgents: agents.length,
    // Not available from listAgents' select today — null (rendered as "—"),
    // never a fabricated 0, which would read as "measured and zero."
    successfulTasks: null,
    protocolsSupported: null,
    totalVolumeUsd: null,
  };
}

function computeCategoryCounts(categories: string[]) {
  const counts = new Map<string, number>();
  for (const c of categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  return Object.keys(CATEGORY_LABELS)
    .filter((k) => k !== "other")
    .map((key) => ({ key, label: CATEGORY_LABELS[key] ?? key, count: counts.get(key) ?? 0 }));
}
