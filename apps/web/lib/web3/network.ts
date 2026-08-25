import { env } from "../env";

/**
 * Two networks are supported: BSC Testnet (97) and BSC Mainnet (56).
 * `NEXT_PUBLIC_CHAIN` — set at deploy/build time, defaults to
 * "bsc-testnet" — is the ONLY thing that selects which one is active.
 * There is no runtime toggle, no user-facing switch, and nothing in this
 * app writes to `process.env` — so "accidentally end up in mainnet mode"
 * isn't something a bug elsewhere in the codebase can cause. Wallet
 * network switches (see wallet.ts) still always require the user's
 * explicit approval in their wallet extension, regardless of which
 * network this deployment targets.
 *
 * This is a hobby/hackathon project, not an audited production financial
 * system (explicit project decision, 2026-08) — the mainnet contract
 * addresses below were supplied directly by the project owner and are
 * NOT independently bytecode-verified against an audit artifact by
 * Claude. If that changes, update this comment.
 *
 * Design note on *when* a missing contract address throws: chain
 * metadata (chain id, RPC, explorer, display name — used by every page
 * just to render a public client or a badge) is always safe to compute
 * and NEVER throws. Only the actual contract addresses (needed solely by
 * the hire flow / job routes / wallet.ts) are validated, and only lazily,
 * the first time something actually tries to use them — not at module
 * import time. Validating eagerly at import time sounds safer but isn't:
 * every route in a Next.js app transitively imports this module during
 * the production build's page-data-collection step, so an eager throw
 * here doesn't just fail cleanly for the one route that needed the
 * address — it takes down the entire build, including pages that never
 * touch a contract address at all.
 */

export type ChainKey = "bsc-testnet" | "bsc-mainnet";

export interface Erc8183Addresses {
  commerce: `0x${string}`;
  router: `0x${string}`;
  policy: `0x${string}`;
}

export interface NetworkConfig {
  key: ChainKey;
  chainId: number;
  chainHex: `0x${string}`;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorerUrl: string;
  isMainnet: boolean;
}

function requireAddress(value: string | undefined, name: string): `0x${string}` {
  if (!value || !value.startsWith("0x")) {
    throw new Error(
      `Missing/invalid ${name} for the active network (NEXT_PUBLIC_CHAIN=${env.NEXT_PUBLIC_CHAIN}) — ` +
        `set it in .env.local. Hiring is disabled without it, not silently pointed at a different network's contract.`
    );
  }
  return value as `0x${string}`;
}

// --- Chain metadata: safe, no env requirement beyond an optional RPC
// override, never throws. Every page can import ACTIVE_NETWORK freely. ---

const TESTNET_CONFIG: NetworkConfig = {
  key: "bsc-testnet",
  chainId: 97,
  chainHex: "0x61",
  chainName: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrl: env.NEXT_PUBLIC_RPC_URL ?? "https://data-seed-prebsc-1-s1.binance.org:8545",
  blockExplorerUrl: "https://testnet.bscscan.com",
  isMainnet: false,
};

// BSC Mainnet — RPC/addresses supplied by the project owner (2026-08).
const MAINNET_DEFAULTS = {
  rpcUrl: "https://bsc-dataseed.bnbchain.org",
  erc8004Registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  commerce: "0xEa4DAa3100A767e86FDed867729ae7446476EBA6",
  router: "0x51895229E12F9876011789B04f8698af06cCD6DA",
  policy: "0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5",
} as const;

const MAINNET_CONFIG: NetworkConfig = {
  key: "bsc-mainnet",
  chainId: 56,
  chainHex: "0x38",
  chainName: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrl: env.NEXT_PUBLIC_RPC_URL_MAINNET ?? MAINNET_DEFAULTS.rpcUrl,
  blockExplorerUrl: "https://bscscan.com",
  isMainnet: true,
};

const CHAIN_METADATA: Record<ChainKey, NetworkConfig> = {
  "bsc-testnet": TESTNET_CONFIG,
  "bsc-mainnet": MAINNET_CONFIG,
};

/** The single source of truth for which network this deployment targets.
 * Safe to import anywhere — never throws, since it carries no contract
 * addresses. Selected only by `NEXT_PUBLIC_CHAIN` at build time. */
export const ACTIVE_NETWORK: NetworkConfig = CHAIN_METADATA[env.NEXT_PUBLIC_CHAIN];

export const SUPPORTED_CHAIN_ID = ACTIVE_NETWORK.chainId;
export const SUPPORTED_CHAIN_HEX = ACTIVE_NETWORK.chainHex;

/** Wallet-facing chain params for `wallet_addEthereumChain`, matching
 * whichever network is active — never a mix of one network's chain ID
 * with another's RPC/explorer. */
export const ACTIVE_CHAIN_WALLET_PARAMS = {
  chainId: ACTIVE_NETWORK.chainHex,
  chainName: ACTIVE_NETWORK.chainName,
  nativeCurrency: ACTIVE_NETWORK.nativeCurrency,
  rpcUrls: [ACTIVE_NETWORK.rpcUrl],
  blockExplorerUrls: [ACTIVE_NETWORK.blockExplorerUrl],
};

// --- Contract addresses: validated LAZILY, only when actually called.
// Never invoked at module scope anywhere in this codebase — only from
// inside request handlers / wallet.ts functions, at the moment they're
// actually needed. This is what makes "fail clearly rather than silently
// fall back" safe: the failure is scoped to the one feature that needed
// the address, not the entire build. ---

export function getErc8183Addresses(): Erc8183Addresses {
  if (ACTIVE_NETWORK.key === "bsc-mainnet") {
    return {
      commerce: requireAddress(
        env.NEXT_PUBLIC_ERC8183_COMMERCE_MAINNET ?? MAINNET_DEFAULTS.commerce,
        "NEXT_PUBLIC_ERC8183_COMMERCE_MAINNET"
      ),
      router: requireAddress(
        env.NEXT_PUBLIC_ERC8183_ROUTER_MAINNET ?? MAINNET_DEFAULTS.router,
        "NEXT_PUBLIC_ERC8183_ROUTER_MAINNET"
      ),
      policy: requireAddress(
        env.NEXT_PUBLIC_ERC8183_POLICY_MAINNET ?? MAINNET_DEFAULTS.policy,
        "NEXT_PUBLIC_ERC8183_POLICY_MAINNET"
      ),
    };
  }
  return {
    commerce: requireAddress(env.NEXT_PUBLIC_ERC8183_COMMERCE, "NEXT_PUBLIC_ERC8183_COMMERCE"),
    router: requireAddress(env.NEXT_PUBLIC_ERC8183_ROUTER, "NEXT_PUBLIC_ERC8183_ROUTER"),
    policy: requireAddress(env.NEXT_PUBLIC_ERC8183_POLICY, "NEXT_PUBLIC_ERC8183_POLICY"),
  };
}

export function getErc8004Registry(): `0x${string}` {
  if (ACTIVE_NETWORK.key === "bsc-mainnet") {
    return requireAddress(
      env.NEXT_PUBLIC_ERC8004_REGISTRY_MAINNET ?? MAINNET_DEFAULTS.erc8004Registry,
      "NEXT_PUBLIC_ERC8004_REGISTRY_MAINNET"
    );
  }
  return requireAddress(env.NEXT_PUBLIC_ERC8004_REGISTRY, "NEXT_PUBLIC_ERC8004_REGISTRY");
}

/** Exposed only for tests that need to build a config for a network that
 * ISN'T the active one (e.g. asserting the mainnet defaults are correct
 * while NEXT_PUBLIC_CHAIN=bsc-testnet in the test environment). Not used
 * anywhere in application code — application code always goes through
 * ACTIVE_NETWORK / getErc8183Addresses() / getErc8004Registry(). */
export const NETWORKS: Record<ChainKey, () => Erc8183Addresses> = {
  "bsc-testnet": () => ({
    commerce: requireAddress(env.NEXT_PUBLIC_ERC8183_COMMERCE, "NEXT_PUBLIC_ERC8183_COMMERCE"),
    router: requireAddress(env.NEXT_PUBLIC_ERC8183_ROUTER, "NEXT_PUBLIC_ERC8183_ROUTER"),
    policy: requireAddress(env.NEXT_PUBLIC_ERC8183_POLICY, "NEXT_PUBLIC_ERC8183_POLICY"),
  }),
  "bsc-mainnet": () => ({
    commerce: requireAddress(
      env.NEXT_PUBLIC_ERC8183_COMMERCE_MAINNET ?? MAINNET_DEFAULTS.commerce,
      "NEXT_PUBLIC_ERC8183_COMMERCE_MAINNET"
    ),
    router: requireAddress(
      env.NEXT_PUBLIC_ERC8183_ROUTER_MAINNET ?? MAINNET_DEFAULTS.router,
      "NEXT_PUBLIC_ERC8183_ROUTER_MAINNET"
    ),
    policy: requireAddress(
      env.NEXT_PUBLIC_ERC8183_POLICY_MAINNET ?? MAINNET_DEFAULTS.policy,
      "NEXT_PUBLIC_ERC8183_POLICY_MAINNET"
    ),
  }),
};

export const CHAIN_KEY_TO_ID: Record<ChainKey, number> = {
  "bsc-testnet": TESTNET_CONFIG.chainId,
  "bsc-mainnet": MAINNET_CONFIG.chainId,
};

export const MAINNET_ERC8004_REGISTRY_DEFAULT = MAINNET_DEFAULTS.erc8004Registry;
