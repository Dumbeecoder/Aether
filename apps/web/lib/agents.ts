import { getSupabaseReadClient } from "./supabase";
import { computeAetherScore, type AetherScoreResult, type ScoreInputs } from "./scoring";

export type AgentCategory = "monitoring" | "trading" | "risk" | "yield" | "pancakeswap" | "other";

export interface AgentListItem {
  id: string;
  agentId: string;
  chainId: number;
  slug: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  category: string | null;
  identityVerified: boolean;
  endpointVerified: boolean;
  performanceVerified: boolean;
  dataSource: "onchain" | "seeded";
  score: AetherScoreResult;
}

export interface AgentEndpointRow {
  endpoint: string;
  endpointType: string;
  healthStatus: string; // online | degraded | offline | unknown
  lastChecked: string | null;
  responseTimeMs: number | null;
}

export interface AgentCapabilityRow {
  capability: string;
  provenance: string;
}

export interface AgentProfile extends AgentListItem {
  walletAddress: string;
  ownerWallet: string | null;
  identityRegistry: string | null;
  registrationTxHash: string | null;
  registrationBlock: number | null;
  registrationTimestamp: string | null;
  agentUri: string | null;
  capabilities: AgentCapabilityRow[];
  protocols: string[];
  endpoints: AgentEndpointRow[];
  performance: {
    totalTasks: number;
    successRate: number | null;
  } | null;
}

/** Distinguishes "Supabase isn't configured" from "configured but empty" so
 * the page can show the right empty state instead of one generic message. */
export type ListAgentsResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ok"; agents: AgentListItem[] };

export interface AgentFilters {
  category?: string;
  chainId?: number;
  verifiedOnly?: boolean;
  /** Plain substring match against name/description — Phase 3 scope is
   * basic text search only; semantic/NL search is Phase 4 (spec Section 12/22). */
  search?: string;
  sort?: "score" | "recent";
}

const LIST_SELECT =
  "id,agent_id,chain_id,slug,name,description,avatar_url,category,identity_verified," +
  "endpoint_verified,performance_verified,data_source,registration_timestamp,last_indexed_at," +
  "agent_performance(total_tasks,successful_tasks,average_execution_time)," +
  "agent_endpoints(health_status)";

function buildScoreInputs(row: Record<string, unknown>): ScoreInputs {
  const perfRows = (row.agent_performance as Record<string, unknown>[] | null) ?? [];
  const perf = perfRows[0];
  const endpointRows = (row.agent_endpoints as Record<string, unknown>[] | null) ?? [];

  return {
    identityVerified: Boolean(row.identity_verified),
    endpointVerified: Boolean(row.endpoint_verified),
    performanceVerified: Boolean(row.performance_verified),
    registrationTimestamp: (row.registration_timestamp as string | null) ?? null,
    lastIndexedAt: (row.last_indexed_at as string | null) ?? null,
    endpointHealthStatuses: endpointRows.map((e) => (e.health_status as string) ?? "unknown"),
    performance: perf
      ? {
          totalTasks: (perf.total_tasks as number) ?? 0,
          successfulTasks: (perf.successful_tasks as number | null) ?? null,
          averageExecutionTimeSeconds: (perf.average_execution_time as number | null) ?? null,
        }
      : null,
  };
}

function mapRowToListItem(row: Record<string, unknown>): AgentListItem {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    chainId: row.chain_id as number,
    slug: row.slug as string,
    name: (row.name as string) ?? `Agent #${row.agent_id}`,
    description: (row.description as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    category: (row.category as string | null) ?? "other",
    identityVerified: Boolean(row.identity_verified),
    endpointVerified: Boolean(row.endpoint_verified),
    performanceVerified: Boolean(row.performance_verified),
    dataSource: (row.data_source as "onchain" | "seeded") ?? "onchain",
    score: computeAetherScore(buildScoreInputs(row)),
  };
}

export async function listAgents(filters: AgentFilters = {}): Promise<ListAgentsResult> {
  const client = getSupabaseReadClient();
  if (!client) return { status: "not_configured" };

  let query = client
    .from("agents")
    .select(LIST_SELECT)
    .order("last_indexed_at", { ascending: false, nullsFirst: false });

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.chainId) query = query.eq("chain_id", filters.chainId);
  if (filters.verifiedOnly) query = query.eq("identity_verified", true);
  if (filters.search) {
    const term = filters.search.replace(/[%_]/g, "");
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error } = await query.returns<Record<string, unknown>[]>();
  if (error) return { status: "error", message: error.message };

  let agents = (data ?? []).map(mapRowToListItem);

  if (filters.sort === "score") {
    // Scored agents first (highest score first), "New" agents after —
    // never interleave a fabricated tiebreak between the two groups.
    agents = agents.sort((a, b) => {
      if (a.score.status === "scored" && b.score.status === "scored") {
        return (b.score.score ?? 0) - (a.score.score ?? 0);
      }
      if (a.score.status === "scored") return -1;
      if (b.score.status === "scored") return 1;
      return 0;
    });
  }

  return { status: "ok", agents };
}

export type GetAgentResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "not_found" }
  | { status: "ok"; agent: AgentProfile };

export async function getAgentBySlug(slug: string): Promise<GetAgentResult> {
  const client = getSupabaseReadClient();
  if (!client) return { status: "not_configured" };

  const { data: agentRow, error: agentError } = await client
    .from("agents")
    .select(
      "id,agent_id,chain_id,slug,name,description,avatar_url,category,identity_verified," +
        "endpoint_verified,performance_verified,data_source,wallet_address,owner_wallet," +
        "identity_registry,registration_tx_hash,registration_block,registration_timestamp," +
        "last_indexed_at,agent_uri"
    )
    .eq("slug", slug)
    .maybeSingle()
    .returns<Record<string, unknown>>();

  if (agentError) return { status: "error", message: agentError.message };
  if (!agentRow) return { status: "not_found" };

  const [{ data: capRows }, { data: protocolRows }, { data: endpointRows }, { data: perfRow }] = await Promise.all([
    client.from("agent_capabilities").select("capability,provenance").eq("agent_id", agentRow.id),
    client.from("agent_protocols").select("protocol").eq("agent_id", agentRow.id),
    client
      .from("agent_endpoints")
      .select("endpoint,endpoint_type,health_status,last_checked,response_time_ms")
      .eq("agent_id", agentRow.id),
    client
      .from("agent_performance")
      .select("total_tasks,successful_tasks,success_rate,average_execution_time")
      .eq("agent_id", agentRow.id)
      .maybeSingle(),
  ]);

  const endpoints = (endpointRows ?? []).map((r) => ({
    endpoint: r.endpoint as string,
    endpointType: r.endpoint_type as string,
    healthStatus: (r.health_status as string) ?? "unknown",
    lastChecked: (r.last_checked as string | null) ?? null,
    responseTimeMs: (r.response_time_ms as number | null) ?? null,
  }));

  const score = computeAetherScore({
    identityVerified: Boolean(agentRow.identity_verified),
    endpointVerified: Boolean(agentRow.endpoint_verified),
    performanceVerified: Boolean(agentRow.performance_verified),
    registrationTimestamp: (agentRow.registration_timestamp as string | null) ?? null,
    lastIndexedAt: (agentRow.last_indexed_at as string | null) ?? null,
    endpointHealthStatuses: endpoints.map((e) => e.healthStatus),
    performance: perfRow
      ? {
          totalTasks: (perfRow.total_tasks as number) ?? 0,
          successfulTasks: (perfRow.successful_tasks as number | null) ?? null,
          averageExecutionTimeSeconds: (perfRow.average_execution_time as number | null) ?? null,
        }
      : null,
  });

  const agent: AgentProfile = {
    ...mapRowToListItem(agentRow as Record<string, unknown>),
    score,
    walletAddress: agentRow.wallet_address as string,
    ownerWallet: (agentRow.owner_wallet as string | null) ?? null,
    identityRegistry: (agentRow.identity_registry as string | null) ?? null,
    registrationTxHash: (agentRow.registration_tx_hash as string | null) ?? null,
    registrationBlock: (agentRow.registration_block as number | null) ?? null,
    registrationTimestamp: (agentRow.registration_timestamp as string | null) ?? null,
    agentUri: (agentRow.agent_uri as string | null) ?? null,
    capabilities: (capRows ?? []).map((r) => ({
      capability: r.capability as string,
      provenance: r.provenance as string,
    })),
    protocols: (protocolRows ?? []).map((r) => r.protocol as string),
    endpoints,
    performance:
      // Performance is only shown once real measured data exists — a row
      // with total_tasks === 0 is "insufficient data", not a zero score.
      perfRow && (perfRow.total_tasks as number) > 0
        ? {
            totalTasks: perfRow.total_tasks as number,
            successRate: (perfRow.success_rate as number | null) ?? null,
          }
        : null,
  };

  return { status: "ok", agent };
}

const MAX_COMPARE_AGENTS = 3;

/** Pure helper so this invariant is unit-testable without a live Supabase
 * client. Dedupe happens before the cap, not after, so `[a,a,a,b,c,d]`
 * yields `[a,b,c]` rather than capping at 3 duplicates of `a`. */
export function dedupeAndCapSlugs(slugs: string[], max = MAX_COMPARE_AGENTS): string[] {
  return Array.from(new Set(slugs)).slice(0, max);
}

export async function getAgentsBySlugs(slugs: string[]): Promise<AgentProfile[]> {
  // Audit fix (Phase 3.1): enforce dedupe + max count here too, not just in
  // the /compare page — this is the actual data-layer entry point, and a
  // future caller (an API route, another page) shouldn't have to
  // remember to re-implement the same guard.
  const uniqueCapped = dedupeAndCapSlugs(slugs);
  const results = await Promise.all(uniqueCapped.map((s) => getAgentBySlug(s)));
  return results
    .filter((r): r is Extract<GetAgentResult, { status: "ok" }> => r.status === "ok")
    .map((r) => r.agent);
}

export interface SearchCandidate extends AgentListItem {
  capabilities: string[];
  protocols: string[];
}

export type ListSearchCandidatesResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ok"; candidates: SearchCandidate[] };

const SEARCH_SELECT =
  LIST_SELECT +
  ",agent_capabilities(capability)," +
  "agent_protocols(protocol)";

/**
 * Candidate pool for AI-parsed search (Phase 4). Narrows at the database
 * level by category when the intent parser was confident enough to extract
 * one — an unset category means "search everything," same as browsing
 * /agents with no filter. Capabilities/protocols are embedded here (unlike
 * the base `listAgents`/`LIST_SELECT`) because Match Score needs them;
 * the plain marketplace list doesn't, so it stays lighter.
 */
export async function listSearchCandidates(
  category: AgentCategory | null
): Promise<ListSearchCandidatesResult> {
  const client = getSupabaseReadClient();
  if (!client) return { status: "not_configured" };

  let query = client.from("agents").select(SEARCH_SELECT);
  if (category) query = query.eq("category", category);
  // Only real on-chain agents are eligible for search results — the same
  // provenance rule /rankings enforces (Phase 3.1 finding: seeded/demo
  // fixtures must never be presented as legitimate marketplace results).
  query = query.eq("data_source", "onchain");

  const { data, error } = await query.returns<Record<string, unknown>[]>();
  if (error) return { status: "error", message: error.message };

  const candidates: SearchCandidate[] = (data ?? []).map((row) => ({
    ...mapRowToListItem(row),
    capabilities: ((row.agent_capabilities as Record<string, unknown>[] | null) ?? []).map(
      (c) => c.capability as string
    ),
    protocols: ((row.agent_protocols as Record<string, unknown>[] | null) ?? []).map(
      (p) => p.protocol as string
    ),
  }));

  return { status: "ok", candidates };
}

export const CATEGORY_LABELS: Record<string, string> = {
  monitoring: "Monitoring",
  trading: "Trading",
  risk: "Risk",
  yield: "Yield",
  pancakeswap: "PancakeSwap",
  other: "Other",
};

/** "Similar agents" for the passport page — same category, ranked by the
 * existing Aether Score sort in `listAgents`. Deliberately not a new
 * ranking algorithm: it's the marketplace list filtered and capped. */
export async function getSimilarAgents(
  category: string | null,
  excludeSlug: string,
  limit = 3
): Promise<AgentListItem[]> {
  const result = await listAgents({ category: category ?? undefined, sort: "score" });
  if (result.status !== "ok") return [];
  return result.agents.filter((a) => a.slug !== excludeSlug).slice(0, limit);
}
