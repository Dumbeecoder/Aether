"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet, isOnSupportedChain } from "@/lib/web3/WalletContext";
import { ACTIVE_NETWORK } from "@/lib/web3/network";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Deliberately NOT subtle — this is the one thing on every page that
 * tells someone whether a click could move real funds. Mainnet renders
 * with a warning color and explicit "real funds" language; testnet
 * renders muted. These two states must never be visually interchangeable. */
function NetworkBadge() {
  if (ACTIVE_NETWORK.isMainnet) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-danger">
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
        Mainnet · real funds
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      Testnet
    </span>
  );
}

export function SiteHeader() {
  const { address, chainId, connecting, error, connect, disconnect } = useWallet();
  const [showError, setShowError] = useState(false);

  async function handleClick() {
    if (address) {
      disconnect();
      return;
    }
    setShowError(false);
    await connect();
    setShowError(true);
  }

  const wrongChain = address !== null && !isOnSupportedChain(chainId);

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:opacity-90">
            <span className="text-accent">A</span>ether
          </Link>
          <NetworkBadge />
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/agents" className="hover:text-foreground">
            Explore
          </Link>
          <Link href="/rankings" className="hover:text-foreground">
            Rankings
          </Link>
          <Link href="/agents?category=pancakeswap" className="hover:text-foreground">
            PancakeSwap
          </Link>
          {/* "Submit Agent" has no backing route yet — agents are only
              discovered via the ERC-8004 indexer today, so this is left as
              plain text rather than linking somewhere that doesn't exist. */}
          <span className="cursor-default text-muted-foreground/60" title="Coming soon">
            Submit Agent
          </span>
        </nav>
        <div className="relative">
          <button
            onClick={handleClick}
            disabled={connecting}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-2 transition-colors disabled:opacity-60"
          >
            {connecting
              ? "Connecting…"
              : address
                ? wrongChain
                  ? "Wrong network"
                  : truncate(address)
                : "Connect Wallet"}
          </button>
          {showError && error && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-md border border-border bg-surface p-3 text-xs text-danger shadow-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
