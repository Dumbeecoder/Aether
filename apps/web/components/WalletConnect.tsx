"use client";

import { useEffect, useState } from "react";
import { connectWallet, ensureActiveNetwork, NoWalletFoundError } from "@/lib/web3/wallet";

export function WalletConnect({
  onConnected,
}: {
  onConnected: (address: `0x${string}`) => void;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const addr = await connectWallet();
      await ensureActiveNetwork();
      setAddress(addr);
      onConnected(addr);
    } catch (err) {
      setError(err instanceof NoWalletFoundError ? err.message : err instanceof Error ? err.message : "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    // Auto-detect an already-connected account (no popup) so returning
    // users don't have to click Connect again every render.
    if (typeof window === "undefined" || !window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list[0]) {
          setAddress(list[0]);
          onConnected(list[0] as `0x${string}`);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (address) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm">
        <span className="h-2 w-2 rounded-full bg-success" />
        <span className="font-mono text-xs">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <span className="text-xs text-muted-foreground">BSC Testnet</span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
