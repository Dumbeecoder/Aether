import { z } from "zod";

// Fail fast on missing/malformed config instead of surfacing cryptic
// runtime errors deep in a request handler. Only variables the web app
// actually needs are validated here — worker-only secrets never reach
// this file or the client bundle.
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CHAIN: z.enum(["bsc-testnet", "bsc-mainnet"]).default("bsc-testnet"),
  // BSC Testnet (unchanged — same var names as before mainnet support existed).
  NEXT_PUBLIC_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_ERC8004_REGISTRY: z.string().startsWith("0x").optional(),
  NEXT_PUBLIC_ERC8183_COMMERCE: z.string().startsWith("0x").optional(),
  NEXT_PUBLIC_ERC8183_ROUTER: z.string().startsWith("0x").optional(),
  NEXT_PUBLIC_ERC8183_POLICY: z.string().startsWith("0x").optional(),
  // BSC Mainnet — all optional. network.ts falls back to known-good
  // defaults if unset, but any of these can be overridden without
  // touching source (see network.ts MAINNET_DEFAULTS).
  NEXT_PUBLIC_RPC_URL_MAINNET: z.string().url().optional(),
  NEXT_PUBLIC_ERC8004_REGISTRY_MAINNET: z.string().startsWith("0x").optional(),
  NEXT_PUBLIC_ERC8183_COMMERCE_MAINNET: z.string().startsWith("0x").optional(),
  NEXT_PUBLIC_ERC8183_ROUTER_MAINNET: z.string().startsWith("0x").optional(),
  NEXT_PUBLIC_ERC8183_POLICY_MAINNET: z.string().startsWith("0x").optional(),
});

// Optional-with-warning rather than throw during Phase 1: Supabase/RPC
// aren't wired up to any route yet, so an empty .env shouldn't block
// `next dev`. Tighten to `.parse()` once Phase 2 introduces real reads.
export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_CHAIN: process.env.NEXT_PUBLIC_CHAIN,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_ERC8004_REGISTRY: process.env.NEXT_PUBLIC_ERC8004_REGISTRY,
  NEXT_PUBLIC_ERC8183_COMMERCE: process.env.NEXT_PUBLIC_ERC8183_COMMERCE,
  NEXT_PUBLIC_ERC8183_ROUTER: process.env.NEXT_PUBLIC_ERC8183_ROUTER,
  NEXT_PUBLIC_ERC8183_POLICY: process.env.NEXT_PUBLIC_ERC8183_POLICY,
  NEXT_PUBLIC_RPC_URL_MAINNET: process.env.NEXT_PUBLIC_RPC_URL_MAINNET,
  NEXT_PUBLIC_ERC8004_REGISTRY_MAINNET: process.env.NEXT_PUBLIC_ERC8004_REGISTRY_MAINNET,
  NEXT_PUBLIC_ERC8183_COMMERCE_MAINNET: process.env.NEXT_PUBLIC_ERC8183_COMMERCE_MAINNET,
  NEXT_PUBLIC_ERC8183_ROUTER_MAINNET: process.env.NEXT_PUBLIC_ERC8183_ROUTER_MAINNET,
  NEXT_PUBLIC_ERC8183_POLICY_MAINNET: process.env.NEXT_PUBLIC_ERC8183_POLICY_MAINNET,
});
