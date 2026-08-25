# Aether — Implementation Plan

## 0. Research findings (Phase 0 — corrects the original spec)

The spec assumes a pure Next.js/TypeScript stack talking to a JS BNB Agent SDK.
That SDK doesn't exist. As of Aug 2026:

- **BNBAgent SDK (`pip install bnbagent`) is Python-only.** It provides
  `ERC8004Agent` (identity registration) and `ERC8183Client` / a FastAPI
  `create_erc8183_app()` (job lifecycle: negotiate → createJob → registerJob →
  setBudget → fund → submit → settle/dispute → claimRefund).
- ERC-8004 and ERC-8183 are **independent** — ERC-8004 gives discovery/identity,
  ERC-8183 handles escrowed job commerce. A provider doesn't need an ERC-8004
  identity to accept ERC-8183 jobs, but Aether requires it for discoverability.
- Contracts are live on both networks (read via any EVM client, e.g. viem —
  no SDK required for *reading*):

  | Contract | BSC Testnet (97) | BSC Mainnet (56) |
  |---|---|---|
  | Identity Registry (ERC-8004) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
  | AgenticCommerce (APEX) | `0xa206c0517b6371c6638cd9e4a42cc9f02a33b0de` | `0xea4daa3100a767e86fded867729ae7446476eba6` |
  | EvaluatorRouter | `0xd7d36d66d2f1b608a0f943f722d27e3744f66f25` | `0x51895229e12f9876011789b04f8698af06ccd6da` |
  | OptimisticPolicy | `0x4f4678d4439fec812ac7674bb3efb4c8f5fb78a6` | `0x9c01845705b3078aa2e8cff7520a6376fd766de5` |

  Payment token is read at runtime from `commerce.paymentToken()` — do not hardcode it.
- ERC-8004 registration is gas-sponsored on testnet via MegaFuel paymaster.
- Job lifecycle is `OPEN → FUNDED → SUBMITTED → COMPLETED/REJECTED/EXPIRED`, with
  **optimistic settlement**: silence past the dispute window = approve; `settle()`
  is permissionless (anyone can call it once a verdict exists) — Aether needs its
  own settle-poller, the SDK does not run one.
- x402 payment signing in the SDK is policy-gated by design (`SigningPolicy`) —
  EIP-2612 `Permit` / Permit2 batch signing is denylisted by default to prevent
  agents being tricked into unbounded approvals. Aether's own permission layer
  (Section 13 of the spec) should mirror this allow/deny philosophy rather than
  reinvent it.

### Architectural consequence
Aether becomes a **two-service system**, not one:

1. **Next.js app** (`apps/web`) — marketplace UI, Supabase-backed API routes,
   read-only chain queries via viem, user-side wallet txs (hire flow: the user's
   own wallet calls `createJob`/`fund` directly — no server signing needed there).
2. **Python worker** (`apps/worker`) — uses `bnbagent` for: (a) the ERC-8004
   indexer/poller that syncs on-chain agent identities into Supabase, (b) running
   Aether's own reference agents as ERC-8183 providers, (c) the settle-poller that
   calls `router.settle(jobId)` once dispute windows elapse.

This keeps user funds under user wallet control at all times (spec Section 23,
rule 4) — the worker never holds user private keys, only the keys for Aether's
own demo agents.

## 1. Monorepo structure

```
aether/
  apps/
    web/                 # Next.js 15, TS, Tailwind, shadcn/ui
    worker/               # Python: indexer, reference agents, settle-poller
  packages/
    types/                # shared TS types (generated from DB schema)
  supabase/
    migrations/
  scripts/
    seed/
  IMPLEMENTATION_PLAN.md
```

## 2. Database (Supabase Postgres)
Schema as specified in the brief (agents, agent_capabilities, agent_protocols,
agent_endpoints, agent_performance, agent_transactions, agent_reviews,
agent_tasks, users, hire_sessions, permissions, payments), plus:
- `chain_id` everywhere agent-scoped, since testnet/mainnet agents coexist.
- `agents.data_source` enum (`onchain` | `seeded`) so seeded/demo agents are
  always visibly labeled per spec Section 6/Section 28 Phase 2.
- pgvector column on `agents` for semantic search (Section 8), added once
  embeddings are wired up — not required for Phase 1.

## 3. Phased delivery (unchanged ordering from spec, Section 28)
- **Phase 1 (this session):** repo scaffold, Next.js app, Supabase schema +
  migration, env config, design tokens, health-check API route.
- **Phase 2:** ERC-8004 indexer (Python), ingestion into Supabase, endpoint
  health checks, categories, agent profile pages.
- **Phase 3:** search/filters/Aether Score/ranking/comparison UI.
- **Phase 4:** NL search (LLM → structured filter, no fabricated agents).
- **Phase 5:** hire flow — user wallet calls ERC-8183 directly via viem;
  permission screen enforced client + server-side before any tx is proposed.
- **Phase 6:** 1–3 real reference agents run by the Python worker as ERC-8183
  providers (monitoring, PancakeSwap, risk/health-factor).
- **Phase 7:** Agent Advantage benchmarks, clearly labeled Live/Testnet/Simulation.
- **Phase 8:** Altana investigation, isolated behind a `PermissionProvider`
  interface so it's swappable.
- **Phase 9:** polish, accessibility, SEO, demo reliability.

## 4. Risks
- BNBAgent SDK is pre-1.0 ("active development, breaking changes") — pin the
  exact version in `apps/worker/pyproject.toml` and re-check the CHANGELOG
  before each phase that touches it.
- No JS SDK means any *write* action from the Next.js server (not the user's
  own wallet) must proxy through the Python worker's internal API — adds one
  more network hop; keep the worker API minimal and internal-only (not public).
- Optimistic settlement means "task completed" in the UI should reflect
  on-chain status (`SUBMITTED` vs `COMPLETED`), not just "provider replied" —
  avoid overstating completion before the dispute window closes.

## 4a. Phase 1 status: COMPLETE

Verified locally: `npm run typecheck`, `npm run lint`, `npm run build` (web)
and `pytest`, `ruff check .` (worker) all pass with zero errors. `bnbagent==0.3.6`
installs cleanly from PyPI. See chat for the full Phase 1 report (files,
deps, env vars, commands, security notes, Phase 2 plan) per Section 45.

Explicitly NOT built in Phase 1 (per Section 33 instructions): ERC-8004
indexer, AI search, ERC-8183 hiring, payments, PancakeSwap, Altana, any
on-chain reads/writes. Next.js `/api/health` and worker `/health` do not
touch Supabase or the chain — a green check here doesn't imply either is
reachable yet.

## 4b. Phase 2 status: COMPLETE

ERC-8004 indexer built against the pinned `bnbagent==0.3.6` package's actual
ABI and `NETWORKS` config (not assumed) — see chat for the full report.
Verified: our watched-event/function ABI subset is byte-identical to the one
bundled in the installed package. Key correction from the original plan:
`ipfs://` is NOT a supported agentURI scheme in the current SDK — only
`data:application/json;base64,...` and `http(s)://` are — so the resolver
only implements those two, with SSRF protection mirroring the SDK's own
`parse_agent_uri`. No `totalSupply`/`tokenByIndex` on the registry (not
ERC-721-Enumerable), which confirms event-log scanning is the only way to
discover agents — an ID-range loop was never viable.

Known limitation: this sandbox's network egress does not include BSC RPC
or Supabase, so a live testnet indexing run could not be executed here.
The indexer is unit/mock-tested (idempotency, SSRF, malformed-event
resilience) but needs a live `--dry-run` against real BSC Testnet in an
environment with RPC access to confirm end-to-end.

## 4c. Phase 3 status: COMPLETE

Built: modular `computeAetherScore` (weights match spec Section 9 exactly;
missing components are excluded and remaining weights renormalized, never
defaulted); basic substring search + score-sorted `/agents`; `/rankings`
(Agent Arena leaderboard with category tabs, scored vs "New" agents kept in
separate sections); `/compare` (2–3 agents side by side, plus a
**deterministic, non-LLM** recommendation generated only from real score
components — a real AI-provider-backed explanation is deferred to Phase 4,
where the AI provider abstraction actually gets built, rather than
hardcoding to one model early). Agent Passport now shows the real score and
an auditable component breakdown instead of a hardcoded "New".

Explicit scope decision: `cost_efficiency` (5% weight) is permanently
"insufficient data" until Phase 5, because the ERC-8004 registration schema
this indexer parses (Phase 2 finding) has no pricing field, and no ERC-8183
job settlement exists yet to derive real prices from.

## 4d. Phase 3.1 audit status: COMPLETE (no new features, per instruction)

Full audit report delivered in chat. Summary of what changed:
- **Fixed a real NaN bug**: corrupted `successfulTasks > totalTasks` data
  propagated NaN through the Wilson bound into the final score. Fixed with
  input clamping + a defense-in-depth clamp on every component value.
- **Fixed a real provenance leak**: seeded/demo agents were not excluded
  from `/rankings` or flagged in `/compare` — nothing in scoring.ts or the
  page code checked `data_source`. Added `lib/rankings.ts` to partition
  seeded agents out of the ranked leaderboard entirely, and a caveat in the
  `/compare` recommendation sentence when the "winning" agent is seeded.
- **Fixed a real dedup bug**: `/compare?agents=a,a,a` rendered the same
  agent three times with a duplicate React key. Fixed with
  `dedupeAndCapSlugs`, enforced at the data-layer function, not just the page.
- **Confirmed, not fixed** (explicitly out of scope for this audit turn):
  no `/api/agents` route exists — marketplace pages call `lib/agents.ts`
  directly as server components; no pagination exists anywhere, so result
  sets are fully loaded every request. Not an active problem today (near-zero
  real indexed data) but flagged for before real production traffic.
- **Confirmed, not fixed at the time**: sample-size confidence was only
  applied to the `performance` component (10% weight, via Wilson bound), not
  to `task_success_rate` (20% weight, raw rate) — a 1-task 100%-success
  agent still got full marks on the larger-weighted component. **Resolved in
  Phase 3.2** (see below) — the two components were merged into one
  Wilson-only `verified_task_performance` at 30%.

## 4e. Phase 3.2 status: COMPLETE — scoring revision

Replaced `task_success_rate` (20%, raw rate) + `performance` (10%,
Wilson-adjusted) with a single `verified_task_performance` component (30%,
Wilson lower bound only — the raw rate is never scored on its own). Full
formula and rationale in `docs/SCORING.md`. Confirmed with tests using real
computed values: 1/1 → 20.7, 10/10 → 72.3, 100/100 → 96.3, 900/1000 → 88.0,
1783/1842 → 95.9 — monotonically increasing at fixed/near-fixed raw rates,
and a large sample at a lower raw rate still outscores a tiny sample at a
higher one. All Phase 3.1 corrupted-data protections (NaN, negative
totalTasks, clamping) re-verified intact under the new formula.

## 4e. Phase 3.2 status: COMPLETE

Scoring model revised after the Phase 3.1 audit finding (double-counting).
Full writeup: `docs/SCORING.md`. Summary:

- Merged `task_success_rate` + `performance` into one component,
  `verified_task_performance` (Wilson lower bound only — the raw rate is
  never scored on its own anywhere).
- Removed `capability_match` from this score's weight table entirely (not
  just excluded) — it's a query-dependent concept and belongs to a future,
  separate Match Score (Phase 4), not a permanently-null slot in a
  query-independent score. Documented the "Aether Score vs Match Score"
  split explicitly.
- Added `data_confidence`, a genuinely outcome-independent sample-size
  measure. **Found and fixed a real bug during this phase's own
  validation**: the first implementation derived confidence from the Wilson
  interval's width, which secretly depended on the success rate too (at a
  100% rate the interval collapses for any `n`), breaking monotonicity and
  contradicting its own "regardless of the outcome" doc comment. Replaced
  with a pure function of sample size (`n / (n + 20)`), verified via a
  regression test that same-`n`-different-outcome inputs now produce
  identical confidence.
- Real Agent A/B/C numbers computed by the actual module, not hand-waved:
  A → New (no score), B (1/1) → 45, C (1783/1842, 96.8%) → 88.
- Also found and fixed a **test-authoring bug** (not a scoring bug) during
  validation: `{ ...baseInputs, performanceVerified: true, ...withRecord(...) }`
  silently clobbered the override because `withRecord` itself spreads
  `baseInputs` (with `performanceVerified: false`) last. Fixed the spread
  order in two tests.

New weights (sum to 100%): verified_task_performance 30%, data_confidence
15%, reliability_activity 20%, onchain_reputation 10%, speed 5%, cost_efficiency
5%, security_verification 15%.

## 4f. Phase 4 status: COMPLETE

Note: the pasted Phase 4 spec was truncated mid-sentence at "AIProvider
└── parseAgentSearchIntent()" — sections beyond the objective/provider-
abstraction intro weren't received. Proceeded from the stated objective and
established Phase 1-3.2 patterns (provenance discipline, deterministic
scoring, no fabrication) rather than blocking on the missing text.

Built:
- `lib/ai/` — `AIProvider` interface (`types.ts`), a real `AnthropicProvider`
  (calls api.anthropic.com, model configurable via env, defensive parsing of
  untrusted LLM JSON output — invalid/hallucinated fields dropped, never
  passed through), and a `KeywordFallbackProvider` (deterministic, reuses
  the Python indexer's exact category taxonomy) used when no API key is
  configured or the AI provider fails at runtime. `resolveSearchIntent()`
  never lets an AI failure break search — falls back and says so in the UI.
- `lib/matchScore.ts` — deterministic Match Score (category/capability/
  protocol), fully separate from Aether Score per the "Aether Score vs
  Match Score" split from Phase 3.2's audit. The LLM only ever produces
  `AgentSearchIntent`; it never ranks agents.
- `lib/search.ts` — orchestration + a documented ranking rule (Match Score
  primary, Aether Score breaks near-ties within 5 points) that never
  computes one fabricated blended number from two differently-scaled scores.
- `/search` page — shows the parsed intent and which provider produced it
  before showing results, so a keyword-parsed query is never presented as
  if an LLM understood it.

Two real bugs found and fixed by this phase's own test suite before
shipping: (1) the first capability-match formula used symmetric Jaccard
similarity, which penalized an agent for having capabilities *beyond* what
was requested — backwards for "does this agent have what I need"; replaced
with an asymmetric query-coverage measure. (2) Two TS strict-mode nullability
gaps in the new UI/fallback-provider code, caught by typecheck.

## 4g. Phase 4.1 status: COMPLETE (audit only, per instruction)

Full report in chat. Three real issues found and fixed:
1. **No timeout on the Anthropic fetch call** — a hung provider request
   could hang the whole search request instead of falling back.
   Added an `AbortController`-based timeout (default 10s, configurable).
2. **`risk` and `budget` are parsed/validated but never actually consumed**
   by matching or ranking, despite `risk` being shown to the user as
   "understood." Not a security bug, but a truthfulness gap — added a
   `(not yet used in ranking)` note to the UI rather than building new
   filtering logic (which would be a scope violation for an audit).
3. **Keyword fallback displayed "Pancakeswap" instead of "PancakeSwap"** —
   functionally harmless (matching is case-insensitive) but wrong in the
   UI. Fixed with an explicit display-name map.

All boundary/provenance guarantees the audit set out to check were
confirmed correct on inspection, not just asserted — verified via 27 new
tests: prompt-injection resistance against the real parser (8 tests, using
adversarial payloads assuming a fully-compromised LLM), the exact
capability-coverage and ranking scenarios from the audit spec (regression
tests, not just assertions), provider-failure handling (timeout, non-ok
status, malformed response, no secret leakage), and structural
source-level checks (scoring.ts never imports ai/, matchScore.ts and the
Anthropic provider never import the Supabase client, no tool-use granted
to the LLM call, `NEXT_PUBLIC_*` never wraps the API key, the one client
component never imports the AI/search data layer).

Known limitation: no live Supabase or Anthropic API access in this
sandbox, so items 9/10 (search-quality sanity test) were run against
clearly-labeled synthetic audit fixtures through the real deterministic
ranking code, not real indexed production data.

## 4h. Phase 5 status: COMPLETE

Note: the pasted Phase 5 spec was truncated again, this time mid-way
through Section 3 (hiring flow) right after "[Hire Agent]". Proceeded from
the stated objective, the CRITICAL security principle, and Phase 0-4.1
established patterns.

### Phase 5 research findings (differ from earlier assumptions)
- `settle(jobId)` on the Router is genuinely **permissionless** — verified
  directly from the pinned SDK's own docstring. This means Aether needs
  **no backend keeper/settlement worker at all**: the job status page just
  exposes a "Settle" button once `submittedAt + disputeWindow` has elapsed,
  signed by whichever wallet clicks it (usually the client, but anyone
  legally could).
- The dispute mechanism is a **voter-quorum system**, not pure
  silence-approves as Phase 0 assumed: `OptimisticPolicy` has
  `dispute()`/`voteReject()`/`voteQuorum` — voters can only ever reject
  (no on-chain `voteApprove`), and undisputed jobs auto-approve once the
  window elapses. Dispute UI itself (evidence review) is out of Phase 5
  scope — the status page surfaces that a job is disputable but doesn't
  build a voting flow.
- `registerJob(jobId, policy)` on the Router is a **required, separate,
  client-signed step** between `createJob` and `fund` that the earlier
  plan hadn't accounted for — binds the whitelisted policy contract.
- `evaluator` and `hook` are always the Router address in the v1 deployment
  pattern — never a user choice, simplifying the hire form.
- The pinned SDK's own `create_job` has a documented foot-gun
  (bnb-chain/bnbagent-sdk#41): an `expiredAt` too close to `disputeWindow`
  makes `submit()` permanently revert. Ported the same pre-flight guard
  (`validateExpiry`, 24h safety buffer) into the browser-side flow.
- `commerce.complete()` is **evaluator-only** — this app never calls it
  directly; the only legitimate completion path is `router.settle()`.

### Security architecture
- `lib/web3/wallet.ts` is the only file that ever talks to a wallet, and
  only via the browser's injected EIP-1193 provider — every write is an
  explicit `eth_sendTransaction` the user's own wallet extension prompts
  them to sign. No batching — createJob/registerJob/setBudget/approve/fund
  are five separate signed transactions, not one bundled call.
- `buildApproveTx` uses **exact-amount approval**, deliberately diverging
  from the pinned SDK's own default "floor" pattern (which pads to ~100
  tokens to save gas across job streams) — consistent with this project's
  standing "never leave more standing allowance than necessary" stance.
- `app/api/jobs/route.ts` never trusts a client's claim about a job it
  created — it independently re-reads the job from the chain
  (`verifyJobMatchesClaim`, tested directly) before writing anything to
  Supabase, using a service-role client gated by the `server-only` package
  so it can never end up in a client bundle.
- Chain is hardcoded to 97 (BSC Testnet) in `lib/web3/network.ts` — no
  config path exists that could switch this into mainnet mode.

### Two real bugs found by this phase's own build/tests, fixed before shipping
1. `getJob`'s ABI declares named tuple components, so viem decodes it as an
   object (`{id, client, ...}`), not the positional array `decodeJobTuple`
   assumed — caught by `tsc`, not a runtime bug. Fixed to handle both shapes.
2. Test fixtures used a non-checksummed dummy address — viem correctly
   rejected it at encode time (a real safety property, not a bug).

## 5. Testing strategy
- Web: Vitest for scoring/ranking logic, Playwright for the hire-flow happy path.
- Worker: pytest against BSC Testnet using the SDK's own example flows
  (`examples/client/happy.py` pattern) before wiring into Aether's UI.
- Never run mainnet transactions in CI.
