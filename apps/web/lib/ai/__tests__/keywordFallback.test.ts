import { describe, expect, it } from "vitest";
import { KeywordFallbackProvider } from "../providers/keywordFallback";

const provider = new KeywordFallbackProvider();

describe("KeywordFallbackProvider", () => {
  it("extracts risk category from a liquidation-protection query", async () => {
    const intent = await provider.parseAgentSearchIntent(
      "Find me an agent that protects my lending position from liquidation"
    );
    expect(intent.category).toBe("risk");
  });

  it("extracts pancakeswap category, taking precedence over yield keywords", async () => {
    const intent = await provider.parseAgentSearchIntent("optimize my PancakeSwap liquidity yield");
    expect(intent.category).toBe("pancakeswap");
  });

  it("extracts protocol mentions with correct display capitalization", async () => {
    const intent = await provider.parseAgentSearchIntent("swap on PancakeSwap for me");
    expect(intent.protocol).toBe("PancakeSwap");
  });

  it("extracts risk tolerance from 'safe'", async () => {
    const intent = await provider.parseAgentSearchIntent("I want a safe, conservative agent");
    expect(intent.risk).toBe("low");
  });

  it("never invents a budget — no number extraction without an LLM", async () => {
    const intent = await provider.parseAgentSearchIntent("find me an agent for $500");
    expect(intent.budget).toBeNull();
  });

  it("returns an empty intent for an unrelated or empty query", async () => {
    const empty = await provider.parseAgentSearchIntent("");
    expect(empty.category).toBeNull();
    expect(empty.capabilities).toEqual([]);

    const unrelated = await provider.parseAgentSearchIntent("what's the weather today");
    expect(unrelated.category).toBeNull();
  });

  it("is case-insensitive", async () => {
    const intent = await provider.parseAgentSearchIntent("LIQUIDATION PROTECTION PLEASE");
    expect(intent.category).toBe("risk");
  });
});
