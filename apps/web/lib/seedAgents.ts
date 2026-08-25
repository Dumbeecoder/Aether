import type { AgentCategory } from "./agents";

/**
 * Homepage demo data. This is deliberately SEPARATE from `listAgents()`'s
 * live Supabase query — it exists only so the homepage has something
 * believable to render before the indexer (Phase 2) has populated real
 * agents, or in an environment with no Supabase project configured at all.
 *
 * Every consumer of this data must carry `dataSource: "seeded"` through to
 * the UI and render the existing "Seeded (demo)" label — same rule the
 * codebase already enforces for `agents.data_source` in the DB (see
 * lib/agents.ts, AgentPassport.tsx). This file must never be used as an
 * input to /search or /rankings — those already filter to `data_source =
 * "onchain"` at the query level (lib/agents.ts `listSearchCandidates`) and
 * this file doesn't change that.
 */

export interface SeedAgent {
  slug: string;
  name: string;
  avatarSeed: string; // used to derive a deterministic gradient avatar, not a real image
  category: AgentCategory;
  description: string;
  protocols: string[];
  capabilities: string[];
  score: number; // 0-100, matches the shape computeAetherScore would return
  successRate: number; // 0-100
  responseTimeMs: number;
  completedTasks: number;
  revenueUsd: number;
  status: "online" | "degraded" | "offline";
  chainId: 97 | 56;
}

export const SEED_AGENTS: SeedAgent[] = [
  {
    slug: "sentinel-liq-guard",
    name: "Sentinel LiqGuard",
    avatarSeed: "sentinel",
    category: "risk",
    description:
      "Watches lending positions across Venus and PancakeSwap and alerts before health factor breaches a set threshold.",
    protocols: ["Venus", "PancakeSwap"],
    capabilities: ["Health factor monitoring", "Liquidation alerts", "Multi-wallet tracking"],
    score: 92,
    successRate: 98.4,
    responseTimeMs: 340,
    completedTasks: 4218,
    revenueUsd: 12840,
    status: "online",
    chainId: 97,
  },
  {
    slug: "yield-router-alpha",
    name: "Yield Router Alpha",
    avatarSeed: "yieldrouter",
    category: "yield",
    description:
      "Rebalances stablecoin deposits across the highest-APY vaults it's whitelisted for, reporting every move on-chain.",
    protocols: ["PancakeSwap", "Venus"],
    capabilities: ["APY comparison", "Auto-compounding", "Gas-aware rebalancing"],
    score: 88,
    successRate: 96.1,
    responseTimeMs: 510,
    completedTasks: 2903,
    revenueUsd: 9120,
    status: "online",
    chainId: 97,
  },
  {
    slug: "pancake-flow",
    name: "PancakeFlow",
    avatarSeed: "pancakeflow",
    category: "pancakeswap",
    description:
      "Executes multi-hop PancakeSwap trades with slippage guards and a pre-flight simulation before every swap.",
    protocols: ["PancakeSwap"],
    capabilities: ["Multi-hop routing", "Slippage protection", "Trade simulation"],
    score: 85,
    successRate: 97.2,
    responseTimeMs: 280,
    completedTasks: 6710,
    revenueUsd: 18430,
    status: "online",
    chainId: 97,
  },
  {
    slug: "wallet-watch",
    name: "WalletWatch",
    avatarSeed: "walletwatch",
    category: "monitoring",
    description:
      "Streams real-time balance and approval-change alerts for any wallet you point it at, across BNB Chain tokens.",
    protocols: ["BEP-20"],
    capabilities: ["Balance alerts", "Approval monitoring", "Anomaly detection"],
    score: 90,
    successRate: 99.1,
    responseTimeMs: 190,
    completedTasks: 8340,
    revenueUsd: 6210,
    status: "online",
    chainId: 97,
  },
  {
    slug: "arb-scout",
    name: "Arb Scout",
    avatarSeed: "arbscout",
    category: "trading",
    description:
      "Scans DEX pools for price divergence and surfaces arbitrage opportunities above a configurable profit floor.",
    protocols: ["PancakeSwap", "Biswap"],
    capabilities: ["Price divergence scanning", "Profit estimation", "Route comparison"],
    score: 79,
    successRate: 91.4,
    responseTimeMs: 620,
    completedTasks: 1542,
    revenueUsd: 7340,
    status: "degraded",
    chainId: 97,
  },
  {
    slug: "audit-lens",
    name: "AuditLens",
    avatarSeed: "auditlens",
    category: "risk",
    description:
      "Runs static checks against a contract address and flags common vulnerability patterns before you interact with it.",
    protocols: ["BEP-20", "BEP-721"],
    capabilities: ["Static analysis", "Ownership checks", "Honeypot detection"],
    score: 94,
    successRate: 98.9,
    responseTimeMs: 890,
    completedTasks: 3105,
    revenueUsd: 15600,
    status: "online",
    chainId: 97,
  },
  {
    slug: "gas-sense",
    name: "GasSense",
    avatarSeed: "gassense",
    category: "monitoring",
    description:
      "Predicts short-term gas price movement on BNB Chain and times transaction submission to the cheapest window.",
    protocols: ["BEP-20"],
    capabilities: ["Gas forecasting", "Transaction timing", "Cost reporting"],
    score: 74,
    successRate: 89.7,
    responseTimeMs: 210,
    completedTasks: 5920,
    revenueUsd: 3110,
    status: "online",
    chainId: 97,
  },
  {
    slug: "vault-compound",
    name: "VaultCompound",
    avatarSeed: "vaultcompound",
    category: "yield",
    description:
      "Auto-harvests and re-stakes farming rewards on a schedule you set, netting out gas cost before it compounds.",
    protocols: ["PancakeSwap"],
    capabilities: ["Auto-harvest", "Reward compounding", "Gas-cost netting"],
    score: 81,
    successRate: 94.8,
    responseTimeMs: 460,
    completedTasks: 2210,
    revenueUsd: 8890,
    status: "online",
    chainId: 97,
  },
];

export interface SeedActivityItem {
  id: string;
  agentSlug: string;
  agentName: string;
  category: AgentCategory;
  action: string;
  timeAgo: string;
}

/** Sample "Recently Hired" feed. No live hire-activity feed exists yet
 * (lib/jobs.ts only verifies individual job claims against chain state —
 * there's no aggregate query for a homepage timeline), so this is
 * explicitly rendered under a "Sample activity" label rather than implying
 * it's a live feed. Replace with a real query once one exists. */
export const SEED_RECENT_ACTIVITY: SeedActivityItem[] = [
  { id: "1", agentSlug: "sentinel-liq-guard", agentName: "Sentinel LiqGuard", category: "risk", action: "Hired to monitor a Venus lending position", timeAgo: "2m ago" },
  { id: "2", agentSlug: "pancake-flow", agentName: "PancakeFlow", category: "pancakeswap", action: "Completed a 3-hop swap job", timeAgo: "6m ago" },
  { id: "3", agentSlug: "yield-router-alpha", agentName: "Yield Router Alpha", category: "yield", action: "Rebalanced a stablecoin vault position", timeAgo: "14m ago" },
  { id: "4", agentSlug: "audit-lens", agentName: "AuditLens", category: "risk", action: "Hired to audit a new token contract", timeAgo: "22m ago" },
  { id: "5", agentSlug: "wallet-watch", agentName: "WalletWatch", category: "monitoring", action: "Started tracking a new wallet", timeAgo: "41m ago" },
  { id: "6", agentSlug: "arb-scout", agentName: "Arb Scout", category: "trading", action: "Flagged an arbitrage opportunity", timeAgo: "1h ago" },
];
