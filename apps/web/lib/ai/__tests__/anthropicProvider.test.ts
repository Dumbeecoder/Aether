import { describe, expect, it } from "vitest";
import { parseIntentJson } from "../providers/anthropicProvider";

describe("parseIntentJson", () => {
  it("parses a well-formed response", () => {
    const intent = parseIntentJson(
      JSON.stringify({
        category: "risk",
        capabilities: ["liquidation_protection"],
        protocol: "Venus",
        budget: 500,
        risk: "low",
      })
    );
    expect(intent).toEqual({
      category: "risk",
      capabilities: ["liquidation_protection"],
      protocol: "Venus",
      budget: 500,
      risk: "low",
    });
  });

  it("strips a markdown code fence the model added despite instructions", () => {
    const intent = parseIntentJson('```json\n{"category":"trading","capabilities":[],"protocol":null,"budget":null,"risk":null}\n```');
    expect(intent.category).toBe("trading");
  });

  it("drops an invalid/hallucinated category rather than passing it through", () => {
    const intent = parseIntentJson(
      JSON.stringify({ category: "made-up-category", capabilities: [], protocol: null, budget: null, risk: null })
    );
    expect(intent.category).toBeNull();
  });

  it("drops a hallucinated risk level outside the enum", () => {
    const intent = parseIntentJson(
      JSON.stringify({ category: null, capabilities: [], protocol: null, budget: null, risk: "extreme" })
    );
    expect(intent.risk).toBeNull();
  });

  it("rejects a negative or non-finite budget rather than passing it through", () => {
    const negative = parseIntentJson(
      JSON.stringify({ category: null, capabilities: [], protocol: null, budget: -50, risk: null })
    );
    expect(negative.budget).toBeNull();

    const infinite = parseIntentJson('{"category":null,"capabilities":[],"protocol":null,"budget":Infinity,"risk":null}');
    // Infinity isn't valid JSON — JSON.parse throws, so this must fail safe to empty intent.
    expect(infinite.category).toBeNull();
  });

  it("returns an empty intent for malformed JSON rather than throwing", () => {
    const intent = parseIntentJson("not json at all { broken");
    expect(intent).toEqual({ category: null, capabilities: [], protocol: null, budget: null, risk: null });
  });

  it("returns an empty intent for a JSON array or primitive, not just objects", () => {
    expect(parseIntentJson("[1,2,3]").category).toBeNull();
    expect(parseIntentJson("null").category).toBeNull();
    expect(parseIntentJson('"just a string"').category).toBeNull();
  });

  it("filters non-string entries out of a capabilities array instead of failing entirely", () => {
    const intent = parseIntentJson(
      JSON.stringify({ category: null, capabilities: ["real", 123, null, "also real"], protocol: null, budget: null, risk: null })
    );
    expect(intent.capabilities).toEqual(["real", "also real"]);
  });

  it("caps capabilities at 10 entries to bound downstream match-score cost", () => {
    const many = Array.from({ length: 50 }, (_, i) => `cap${i}`);
    const intent = parseIntentJson(
      JSON.stringify({ category: null, capabilities: many, protocol: null, budget: null, risk: null })
    );
    expect(intent.capabilities).toHaveLength(10);
  });
});

// --- Phase 4.1 audit: provider failure modes ---
import { AnthropicProvider } from "../providers/anthropicProvider";

describe("AnthropicProvider failure handling", () => {
  it("aborts and throws when the provider hangs past the configured timeout", async () => {
    const originalFetch = global.fetch;
    global.fetch = ((_url: string, init?: RequestInit) => {
      // Simulate a hung request: never resolves on its own, only rejects
      // when the AbortController's signal fires — exactly what a real
      // fetch does when aborted.
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }) as typeof fetch;

    try {
      const provider = new AnthropicProvider("fake-key", "fake-model", 20); // 20ms timeout
      await expect(provider.parseAgentSearchIntent("find me a risk agent")).rejects.toThrow();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("throws (not silently returns) on a non-ok HTTP status, without leaking the response body", async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () =>
      new Response(JSON.stringify({ error: { message: "secret internal detail" } }), {
        status: 500,
      })) as typeof fetch;

    try {
      const provider = new AnthropicProvider("fake-key");
      await expect(provider.parseAgentSearchIntent("test")).rejects.toThrow(/Anthropic API error: 500/);
      // The thrown error's message must never contain the raw response body.
      try {
        await provider.parseAgentSearchIntent("test");
      } catch (err) {
        expect((err as Error).message).not.toContain("secret internal detail");
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns an empty intent (not a throw) for a malformed/unexpected 200 response shape", async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => new Response(JSON.stringify({ unexpected: "shape" }), { status: 200 })) as typeof fetch;

    try {
      const provider = new AnthropicProvider("fake-key");
      const intent = await provider.parseAgentSearchIntent("test");
      expect(intent.category).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("never includes the API key in a thrown error message", async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => new Response("", { status: 401 })) as typeof fetch;

    try {
      const provider = new AnthropicProvider("sk-ant-super-secret-key-do-not-leak");
      try {
        await provider.parseAgentSearchIntent("test");
        expect.unreachable();
      } catch (err) {
        expect((err as Error).message).not.toContain("sk-ant-super-secret-key-do-not-leak");
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});
