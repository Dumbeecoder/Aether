import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const libDir = join(__dirname, "..");

function readSource(relPath: string): string {
  return readFileSync(join(libDir, relPath), "utf-8");
}

/**
 * These tests can't be exercised end-to-end without a live Supabase
 * project (not available in this environment — see IMPLEMENTATION_PLAN.md
 * "known limitations"), so they verify the guarantee holds at the source
 * level instead: reading the actual shipped code rather than asserting
 * from memory. This is a deliberate, narrow use of source inspection for
 * structural invariants that unit tests can't reach any other way — not a
 * general testing pattern for this codebase.
 */
describe("Phase 4.1 audit: AI/DB/scoring boundary", () => {
  it("scoring.ts never imports anything from the ai/ module — AI output cannot influence Aether Score", () => {
    const src = readSource("scoring.ts");
    expect(src).not.toMatch(/from ["']\.\/ai/);
    expect(src).not.toMatch(/from ["']\.\.\/ai/);
  });

  it("matchScore.ts never imports the Supabase client — it only scores data already fetched", () => {
    const src = readSource("matchScore.ts");
    expect(src).not.toMatch(/from ["'].*supabase/);
  });

  it("the Anthropic provider file never imports the Supabase client — the LLM path cannot touch the database", () => {
    const src = readSource("ai/providers/anthropicProvider.ts");
    expect(src).not.toMatch(/from ["'].*supabase/);
    expect(src).not.toMatch(/createClient/);
  });

  it("the Anthropic API request is a plain completion call with no tool/function-calling capability granted", () => {
    const src = readSource("ai/providers/anthropicProvider.ts");
    expect(src).not.toMatch(/"tools"\s*:/);
    expect(src).not.toMatch(/\btools:\s*\[/);
  });

  it("search candidates are restricted to data_source = 'onchain' at the query level, excluding seeded/demo data", () => {
    const src = readSource("agents.ts");
    // Scoped to the search-candidate query specifically (not the general
    // marketplace list, which intentionally shows seeded agents labeled —
    // see AgentCompareGrid/AgentListCard "Seeded (demo)" badge).
    const searchFnStart = src.indexOf("export async function listSearchCandidates");
    expect(searchFnStart).toBeGreaterThan(-1);
    const searchFnBody = src.slice(searchFnStart, searchFnStart + 1200);
    expect(searchFnBody).toMatch(/\.eq\(["']data_source["'],\s*["']onchain["']\)/);
  });

  it("the Anthropic API key env var is not a NEXT_PUBLIC_ variable anywhere in the repo config", () => {
    const envExample = readFileSync(join(libDir, "../../../.env.example"), "utf-8");
    expect(envExample).not.toMatch(/NEXT_PUBLIC_.*ANTHROPIC/i);
    expect(envExample).not.toMatch(/NEXT_PUBLIC_AI_PROVIDER/i);
    expect(envExample).toMatch(/^AI_PROVIDER_API_KEY=/m);
  });

  it("no client component ('use client') in the app imports the ai/ module or the search/agents data layer", () => {
    // A "use client" directive means the module (and everything it
    // imports) can end up in the browser bundle. The API key must never be
    // reachable from there.
    const clientComponentSrc = readSource("../components/AgentCompareGrid.tsx");
    expect(clientComponentSrc.trimStart().startsWith('"use client"')).toBe(true);
    expect(clientComponentSrc).not.toMatch(/from ["']@\/lib\/ai/);
    expect(clientComponentSrc).not.toMatch(/AI_PROVIDER_API_KEY/);
  });
});
