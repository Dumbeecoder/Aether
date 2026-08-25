import { createPublicClient, http, defineChain } from "viem";
import { AGENTIC_COMMERCE_ABI } from "./abis";
import { getErc8183Addresses, ACTIVE_NETWORK } from "./network";
import { decodeJobTuple, type OnChainJob } from "./erc8183";

/** Tracks whichever network `ACTIVE_NETWORK` resolves to (BSC Testnet or
 * BSC Mainnet) — never hardcoded to one, so a client built for mainnet
 * doesn't accidentally read testnet state or vice versa. */
export const activeChain = defineChain({
  id: ACTIVE_NETWORK.chainId,
  name: ACTIVE_NETWORK.chainName,
  nativeCurrency: ACTIVE_NETWORK.nativeCurrency,
  rpcUrls: {
    default: { http: [ACTIVE_NETWORK.rpcUrl] },
  },
  blockExplorers: {
    default: { name: ACTIVE_NETWORK.isMainnet ? "BscScan" : "BscScan Testnet", url: ACTIVE_NETWORK.blockExplorerUrl },
  },
  testnet: !ACTIVE_NETWORK.isMainnet,
});

export function getPublicClient() {
  return createPublicClient({ chain: activeChain, transport: http() });
}

/**
 * Reads a job directly from the chain — used server-side (API route) to
 * verify a client's claim about a job before writing anything to
 * Supabase, and client-side on the job status page. Never trust a
 * client-submitted job snapshot; this is the one source of truth.
 */
export async function readJobFromChain(jobId: bigint): Promise<OnChainJob | null> {
  const { commerce } = getErc8183Addresses();
  const client = getPublicClient();
  try {
    const result = await client.readContract({
      address: commerce,
      abi: AGENTIC_COMMERCE_ABI,
      functionName: "getJob",
      args: [jobId],
    });
    return decodeJobTuple(result as Record<string, unknown>);
  } catch {
    return null;
  }
}
