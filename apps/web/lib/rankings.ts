import type { AgentListItem } from "./agents";

export interface RankingPartition {
  /** Real on-chain agents with a legitimate score — this is the only group
   * that should ever appear in a ranked leaderboard position (#1, #2, ...). */
  ranked: AgentListItem[];
  /** Real on-chain agents that exist but haven't completed a task yet. */
  freshOnchain: AgentListItem[];
  /** Seeded/demo fixtures — Phase 2 finding: nothing upstream (indexer,
   * scoring) strips or flags `data_source = 'seeded'`, so without this
   * partition a demo agent's score would sit in the same table as
   * real on-chain agents with no visual distinction. Kept entirely
   * separate here regardless of whether it has a score. */
  seeded: AgentListItem[];
}

export function partitionAgentsForRankings(agents: AgentListItem[]): RankingPartition {
  const seeded = agents.filter((a) => a.dataSource === "seeded");
  const onchain = agents.filter((a) => a.dataSource === "onchain");

  const ranked = onchain
    .filter((a) => a.score.status === "scored")
    .sort((a, b) => (b.score.score ?? 0) - (a.score.score ?? 0));

  const freshOnchain = onchain.filter((a) => a.score.status === "new");

  return { ranked, freshOnchain, seeded };
}
