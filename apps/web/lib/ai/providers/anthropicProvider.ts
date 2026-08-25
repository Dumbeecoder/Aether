import type { AIProvider, AgentSearchIntent } from "../types";
import { emptyIntent } from "../types";
import type { AgentCategory } from "../../agents";

const VALID_CATEGORIES: AgentCategory[] = ["monitoring", "trading", "risk", "yield", "pancakeswap", "other"];
const VALID_RISK = ["low", "medium", "high"] as const;

const SYSTEM_PROMPT = `You convert a user's natural-language request for an AI agent into structured search requirements for a marketplace. You do not know which agents exist — you only extract what the user is asking for.

Return ONLY a JSON object, no other text, matching exactly this shape:
{
  "category": one of "monitoring" | "trading" | "risk" | "yield" | "pancakeswap" | "other" | null,
  "capabilities": string[] (short lowercase phrases, empty array if unclear),
  "protocol": string | null (e.g. "PancakeSwap", "Venus"),
  "budget": number | null (USD, only if an explicit number is stated),
  "risk": "low" | "medium" | "high" | null
}

Use null for anything not clearly stated. Never guess a specific protocol or budget that wasn't mentioned.`;

interface AnthropicMessageResponse {
  content?: { type: string; text?: string }[];
}

function isValidCategory(value: unknown): value is AgentCategory {
  return typeof value === "string" && (VALID_CATEGORIES as string[]).includes(value);
}

function isValidRisk(value: unknown): value is "low" | "medium" | "high" {
  return typeof value === "string" && (VALID_RISK as readonly string[]).includes(value);
}

/** Defensive parse: an LLM response is untrusted input. Anything that
 * doesn't match the expected shape is dropped to null/empty rather than
 * passed through — a malformed or hallucinated field must never reach the
 * search/ranking layer. Exported for direct unit testing of this
 * boundary, independent of network mocking. */
export function parseIntentJson(raw: string): AgentSearchIntent {
  let parsed: unknown;
  try {
    // Models sometimes wrap JSON in a code fence despite instructions —
    // strip it defensively rather than failing the whole request.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return emptyIntent();
  }
  if (typeof parsed !== "object" || parsed === null) return emptyIntent();
  const p = parsed as Record<string, unknown>;

  return {
    category: isValidCategory(p.category) ? p.category : null,
    capabilities: Array.isArray(p.capabilities)
      ? p.capabilities.filter((c): c is string => typeof c === "string").slice(0, 10)
      : [],
    protocol: typeof p.protocol === "string" ? p.protocol : null,
    budget: typeof p.budget === "number" && Number.isFinite(p.budget) && p.budget > 0 ? p.budget : null,
    risk: isValidRisk(p.risk) ? p.risk : null,
  };
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    // Configurable rather than hardcoded — verify the current model catalog
    // at https://docs.claude.com before deploying; a specific model string
    // here would go stale independent of this app's own release cycle.
    private readonly model: string = "claude-haiku-4-5-20251001",
    // Phase 4.1 audit finding: the original fetch had no timeout, so a
    // hung provider request could hang the whole search request instead of
    // falling back. AbortController bounds it; resolveSearchIntent's
    // try/catch (lib/ai/index.ts) treats an abort the same as any other
    // provider failure and falls back to the keyword provider.
    private readonly timeoutMs: number = 10_000
  ) {}

  async parseAgentSearchIntent(query: string): Promise<AgentSearchIntent> {
    if (!query.trim()) return emptyIntent();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: query }],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Audit finding (item 8): never forward the raw response body in the
      // thrown error — it could contain provider-side error detail we
      // don't want surfaced. Only the HTTP status is included, and even
      // that never reaches the client (resolveSearchIntent swallows it and
      // shows a generic "fallback used" message instead).
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as AnthropicMessageResponse;
    const text = data.content?.find((c) => c.type === "text")?.text;
    if (!text) return emptyIntent();

    return parseIntentJson(text);
  }
}
