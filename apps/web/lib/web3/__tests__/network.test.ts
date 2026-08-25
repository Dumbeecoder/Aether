import { describe, expect, it, vi } from "vitest";
import { SUPPORTED_CHAIN_ID, SUPPORTED_CHAIN_HEX, getErc8183Addresses, NETWORKS, ACTIVE_NETWORK } from "../network";

describe("network selection (NEXT_PUBLIC_CHAIN is the only gate)", () => {
  it("defaults to BSC Testnet (chain 97) when NEXT_PUBLIC_CHAIN isn't set to mainnet", () => {
    expect(SUPPORTED_CHAIN_ID).toBe(97);
    expect(ACTIVE_NETWORK.isMainnet).toBe(false);
  });

  it("the hex chain id used for wallet_switchEthereumChain matches the decimal one", () => {
    expect(parseInt(SUPPORTED_CHAIN_HEX, 16)).toBe(SUPPORTED_CHAIN_ID);
  });

  it("reads contract addresses from env, never a hardcoded literal in this module", () => {
    const addrs = getErc8183Addresses();
    expect(addrs.commerce).toBe(process.env.NEXT_PUBLIC_ERC8183_COMMERCE);
    expect(addrs.router).toBe(process.env.NEXT_PUBLIC_ERC8183_ROUTER);
    expect(addrs.policy).toBe(process.env.NEXT_PUBLIC_ERC8183_POLICY);
  });

  it("throws only when the address is actually requested, not merely on import", async () => {
    // Chain metadata (ACTIVE_NETWORK) must stay safe to import even with
    // no contract addresses configured at all — this is the exact bug
    // that broke `npm run build` during development: eagerly validating
    // addresses at module-import time took down every route, not just
    // the one that needed the address. This test guards that regression.
    const original = process.env.NEXT_PUBLIC_ERC8183_COMMERCE;
    delete process.env.NEXT_PUBLIC_ERC8183_COMMERCE;
    try {
      vi.resetModules();
      const fresh = await import("../network");
      // Importing the module and reading chain metadata must not throw.
      expect(() => fresh.ACTIVE_NETWORK.chainId).not.toThrow();
      expect(fresh.ACTIVE_NETWORK.chainId).toBe(97);
      // Only calling the function that actually needs the address throws.
      expect(() => fresh.getErc8183Addresses()).toThrow(/NEXT_PUBLIC_ERC8183_COMMERCE/);
    } finally {
      process.env.NEXT_PUBLIC_ERC8183_COMMERCE = original;
    }
  });
});

describe("mainnet network config (available, but never active unless NEXT_PUBLIC_CHAIN=bsc-mainnet)", () => {
  it("builds a self-contained BSC Mainnet (chain 56) address set from its own defaults", () => {
    const mainnet = NETWORKS["bsc-mainnet"]();
    expect(mainnet.commerce).toBe("0xEa4DAa3100A767e86FDed867729ae7446476EBA6");
    expect(mainnet.router).toBe("0x51895229E12F9876011789B04f8698af06cCD6DA");
    expect(mainnet.policy).toBe("0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5");
  });

  it("mainnet and testnet configs never share a contract address", () => {
    const testnet = NETWORKS["bsc-testnet"]();
    const mainnet = NETWORKS["bsc-mainnet"]();
    expect(testnet.commerce.toLowerCase()).not.toBe(mainnet.commerce.toLowerCase());
    expect(testnet.router.toLowerCase()).not.toBe(mainnet.router.toLowerCase());
    expect(testnet.policy.toLowerCase()).not.toBe(mainnet.policy.toLowerCase());
  });

  it("an env override for a mainnet address wins over the built-in default", async () => {
    process.env.NEXT_PUBLIC_ERC8183_COMMERCE_MAINNET = "0x1234567890123456789012345678901234567890";
    try {
      vi.resetModules();
      const fresh = await import("../network");
      const mainnet = fresh.NETWORKS["bsc-mainnet"]();
      expect(mainnet.commerce).toBe("0x1234567890123456789012345678901234567890");
    } finally {
      delete process.env.NEXT_PUBLIC_ERC8183_COMMERCE_MAINNET;
    }
  });

  it("building a mainnet config when NEXT_PUBLIC_CHAIN is still bsc-testnet works (used for previews/tests only)", () => {
    expect(ACTIVE_NETWORK.isMainnet).toBe(false); // sanity: still testnet here
    expect(() => NETWORKS["bsc-mainnet"]()).not.toThrow();
  });
});
