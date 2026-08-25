import type { AIProvider, AgentSearchIntent } from "./types";
import { KeywordFallbackProvider } from "./providers/keywordFallback";
import { AnthropicProvider } from "./providers/anthropicProvider";

function selectConfiguredProvider(): AIProvider {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const model = process.env.AI_PROVIDER_MODEL;
  if (apiKey) {
    return model ? new AnthropicProvider(apiKey, model) : new AnthropicProvider(apiKey);
  }
  return new KeywordFallbackProvider();
}

export interface IntentResult {
  intent: AgentSearchIntent;
  /** Which provider actually produced this intent — surfaced in the UI so
   * a keyword-parsed query is never presented as if an LLM understood it. */
  providerName: string;
  /** True when the configured provider (if any) failed and we fell back. */
  usedFallback: boolean;
}

/**
 * Resolves intent for a search query, never letting an AI provider failure
 * (network error, rate limit, malformed response) break search entirely —
 * falls back to the deterministic keyword provider and says so.
 */
export async function resolveSearchIntent(query: string): Promise<IntentResult> {
  const primary = selectConfiguredProvider();

  if (primary instanceof KeywordFallbackProvider) {
    const intent = await primary.parseAgentSearchIntent(query);
    return { intent, providerName: primary.name, usedFallback: false };
  }

  try {
    const intent = await primary.parseAgentSearchIntent(query);
    return { intent, providerName: primary.name, usedFallback: false };
  } catch (err) {
    // Server-side only (Next.js server console — never sent to the
    // client/browser). Log only the error's own message/name, never the
    // raw response body or the query text verbatim with any header/secret
    // context — this.apiKey never appears in a thrown Error in the first
    // place (see anthropicProvider.ts), so there's nothing to redact here,
    // but keep this minimal on principle rather than logging the whole
    // error object.
    console.error("[ai] provider failed, falling back to keyword search:", err instanceof Error ? err.message : "unknown error");
    const fallback = new KeywordFallbackProvider();
    const intent = await fallback.parseAgentSearchIntent(query);
    return { intent, providerName: fallback.name, usedFallback: true };
  }
}
