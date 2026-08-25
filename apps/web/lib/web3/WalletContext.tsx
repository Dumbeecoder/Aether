"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { connectWallet, getCurrentChainId, NoWalletFoundError } from "./wallet";
import { SUPPORTED_CHAIN_HEX } from "./network";

/**
 * Site-wide "am I connected, and to what address" state for the header
 * button. This is a thin UI convenience layer only — it calls the exact
 * same `connectWallet()` from wallet.ts that the hire flow already uses
 * (same EIP-1193 `window.ethereum` boundary, same non-custodial model).
 * It does not touch transaction signing, budgets, or approvals — those
 * stay exactly as they were in HireAgentFlow.tsx.
 */
interface WalletContextValue {
  address: Address | null;
  chainId: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      setChainId(await getCurrentChainId());
    } catch (err) {
      // A missing wallet extension is an expected, common case — message
      // it plainly rather than as a generic error.
      setError(err instanceof NoWalletFoundError ? err.message : (err as Error).message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // EIP-1193 has no standard "disconnect" the app can force — this only
    // clears local UI state. The wallet extension itself stays connected
    // until the user revokes the site's permission there.
    setAddress(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress((accounts[0] as Address) ?? null);
    };
    const handleChainChanged = (...args: unknown[]) => {
      setChainId(args[0] as string);
    };
    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <WalletContext.Provider value={{ address, chainId, connecting, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}

export function isOnSupportedChain(chainId: string | null): boolean {
  return chainId !== null && chainId.toLowerCase() === SUPPORTED_CHAIN_HEX;
}
