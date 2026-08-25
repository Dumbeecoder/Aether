import Link from "next/link";
import { runAgentSearch } from "@/lib/search";
import { CATEGORY_LABELS, type SearchCandidate } from "@/lib/agents";

export const metadata = { title: "Search — Aether" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  if (!query) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="mt-3 text-muted-foreground">
          Describe what you want an agent to do, e.g. &ldquo;find me a safe agent that protects my
          lending position.&rdquo;
        </p>
      </div>
    );
  }

  const result = await runAgentSearch(query);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">&ldquo;{query}&rdquo;</h1>

      {result.status === "not_configured" && (
        <p className="mt-4 text-muted-foreground">Supabase isn&apos;t connected yet.</p>
      )}
      {result.status === "error" && <p className="mt-4 text-muted-foreground">{result.message}</p>}

      {result.status === "ok" && (
        <>
          {/* Transparency (spec Section 1 / 3): show exactly what was
              understood and by what, before showing results — the AI
              never silently decides which agents to show. */}
          <div className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Understood as {result.usedFallback && <span>(AI unavailable — keyword fallback used)</span>}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              <IntentField label="Category" value={result.intent.category ? (CATEGORY_LABELS[result.intent.category] ?? result.intent.category) : null} />
              <IntentField
                label="Capabilities"
                value={result.intent.capabilities.length ? result.intent.capabilities.join(", ") : null}
              />
              <IntentField label="Protocol" value={result.intent.protocol} />
              <IntentField label="Risk" value={result.intent.risk ?? null} note="not yet used in ranking" />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              Parsed by: {result.providerName}. Ranking below is computed deterministically from the
              marketplace database — the AI never selects or ranks agents itself.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {result.results.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No agents found
                  {result.intent.category ? ` in ${CATEGORY_LABELS[result.intent.category]}` : ""}.
                </p>
              </div>
            )}
            {result.results.slice(0, 10).map(({ candidate, match }) => (
              <div key={candidate.id} className="relative">
                {match.status === "matched" && (
                  <div className="absolute right-4 top-4 z-10 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                    {match.score}% match
                  </div>
                )}
                <Link href={`/agents/${candidate.slug}`} className="block">
                  <AgentPassportSummary candidate={candidate} />
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function IntentField({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        {value ?? "—"}
        {value && note && <span className="ml-1 text-xs text-muted-foreground">({note})</span>}
      </dd>
    </div>
  );
}

// Compact result card for a search-results context — deliberately not the
// full Agent Passport (which needs the richer AgentProfile shape fetched
// per-agent); this renders straight from the SearchCandidate the ranking
// already computed, avoiding an extra fetch per result.
function AgentPassportSummary({ candidate }: { candidate: SearchCandidate }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/50">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold tracking-tight">{candidate.name}</h3>
        <span className="text-xs text-muted-foreground">
          {candidate.score.status === "scored" ? `Aether Score ${candidate.score.score}` : "New agent"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
        {candidate.description ?? "No description provided."}
      </p>
    </div>
  );
}
