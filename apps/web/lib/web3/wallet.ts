"use client";

import { SUPPORTED_CHAIN_HEX, ACTIVE_CHAIN_WALLET_PARAMS, ACTIVE_NETWORK } from "./network";
import type { TxIntent } from "./erc8183";

/**
 * CRITICAL SECURITY BOUNDARY: this file is the only place in the app that
 * talks to a wallet, and it only ever does so via the browser's injected
 * EIP-1193 provider (`window.ethereum` — MetaMask or equivalent). Aether
 * never sees a private key or seed phrase; every write here is
 * `eth_sendTransaction`, which the wallet extension itself prompts the
 * user to review and sign. There is no server-side signing path anywhere
 * in this app for user funds — the Python worker's own key handling
 * (apps/worker) is exclusively for Aether's own reference/demo agents
 * (Phase 6), never for a user's wallet.
 *
 * Network scope: which chain (BSC Testnet or BSC Mainnet) this deployment
 * targets is fixed by `NEXT_PUBLIC_CHAIN` at build time (see network.ts) —
 * this file never chooses a network itself, and a network switch prompt
 * (below) still always requires the user's own approval in their wallet.
 */

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export class NoWalletFoundError extends Error {
  constructor() {
    super("No wallet extension found. Install MetaMask or a compatible wallet to hire an agent.");
  }
}

export class WrongNetworkError extends Error {
  constructor() {
    super(`Please switch your wallet to ${ACTIVE_NETWORK.chainName} to continue.`);
  }
}

function getProvider(): Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) throw new NoWalletFoundError();
  return window.ethereum;
}

export async function connectWallet(): Promise<`0x${string}`> {
  const provider = getProvider();
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("Wallet did not return an address.");
  return address as `0x${string}`;
}

export async function getCurrentChainId(): Promise<string> {
  const provider = getProvider();
  return (await provider.request({ method: "eth_chainId" })) as string;
}

/**
 * Prompts a switch to whichever network this deployment targets
 * (`ACTIVE_NETWORK`, fixed by `NEXT_PUBLIC_CHAIN` — see network.ts).
 * Never a silent switch: `wallet_switchEthereumChain` and
 * `wallet_addEthereumChain` both require the user's explicit approval in
 * their wallet extension. This function can never target a different
 * network than the one this deployment was built for.
 */
export async function ensureActiveNetwork(): Promise<void> {
  const provider = getProvider();
  const currentChainId = await getCurrentChainId();
  if (currentChainId.toLowerCase() === SUPPORTED_CHAIN_HEX) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SUPPORTED_CHAIN_HEX }],
    });
  } catch (err) {
    // 4902 = chain not added to the wallet yet.
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [ACTIVE_CHAIN_WALLET_PARAMS],
      });
    } else {
      throw err;
    }
  }

  const confirmChainId = await getCurrentChainId();
  if (confirmChainId.toLowerCase() !== SUPPORTED_CHAIN_HEX) throw new WrongNetworkError();
}


/** Sends one transaction intent for the user's wallet to sign. Never
 * batches multiple contract calls into one signature — every step in the
 * hire flow (createJob, registerJob, setBudget, approve, fund) is its own
 * explicit prompt, so the user can see and stop at every step. */
export async function sendTransaction(from: `0x${string}`, intent: TxIntent): Promise<`0x${string}`> {
  const provider = getProvider();
  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to: intent.to, data: intent.data }],
  })) as string;
  return txHash as `0x${string}`;
}
