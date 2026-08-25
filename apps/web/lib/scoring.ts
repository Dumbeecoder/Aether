/**
 * Aether Score — transparent, modular, 0-100. This is the general
 * marketplace-wide trust/usefulness score. It intentionally does NOT
 * depend on any particular search query — see "Aether Score vs Match
 * Score" below. Full plain-English writeup: docs/SCORING.md.
 *
 * Phase 3.2 revision (after the Phase 3.1 audit found two real problems):
 *
 * 1. DOUBLE COUNTING — Phase 3 scored `task_success_rate` (raw rate, 20%)
 *    and `performance` (Wilson-adjusted rate, 10%) as two separate
 *    components computed from the exact same successfulTasks/totalTasks
 *    pair. A 1/1 agent got full marks on the larger, unadjusted component
 *    regardless of how little evidence backed it. Fixed by merging them
 *    into ONE component, `verified_task_performance`, computed only from
 *    the Wilson lower bound. The raw rate is never scored on its own.
 *
 * 2. CAPABILITY MATCH DOESN'T BELONG HERE — `capability_match` is a
 *    relevance score against a *specific search query* (Match Score). It
 *    was previously listed inside this general score at a permanent 25%
 *    weight, always null, always renormalized away. That's not "missing
 *    data," it's a category error: this function computes a query-
 *    independent score, so a query-dependent concept can't live in it at
 *    all. Removed entirely. Phase 4's search ranking will combine this
 *    Aether Score with a separately-computed Match Score, not smuggle
 *    match-relevance into the general trust score.
 *
 * ## Aether Score vs Match Score
 *
 *   Aether Score  — "is this agent generally trustworthy/useful?"
 *                    Computed here. Independent of any query.
 *   Match Score   — "does this agent fit THIS request?"
 *                    NOT implemented yet (Phase 4 — natural-language
 *                    search). Will be a separate function/number that a
 *                    future ranking step combines with this one.
 *
 * ## Sample size as a first-class concept
 *
 * Two distinct statistics are derived from the successfulTasks/totalTasks
 * pair, deliberately kept independent so they can't collapse into the same
 * number (an earlier version of this fix tried deriving both from the
 * Wilson interval's lower and upper bounds, but that formula secretly
 * depended on the outcome too: at a 100% raw rate the interval's upper
 * bound is exactly 1 for *any* sample size, which collapsed "confidence"
 * onto "performance" and even made confidence dip when the rate moved off
 * an extreme — the opposite of "regardless of what the rate turned out to
 * be." Caught by the monotonicity test in scoring.test.ts.):
 *
 *   verified_task_performance — "what's a statistically safe estimate of
 *     the true success rate?" → Wilson lower bound (depends on both n and
 *     the outcome, as it should — a bad track record should score low).
 *   data_confidence           — "how much evidence exists, independent of
 *     whether it was good or bad?" → a saturating function of sample size
 *     alone (`n / (n + K)`), never touching successes/failures. Guaranteed
 *     strictly increasing in n, with no dependence on the outcome.
 *
 * Together they mean a 1/1 agent is penalized twice, correctly: a modest
 * performance number AND a near-zero confidence number — never one
 * arbitrary "small sample penalty" bolted on top of a single figure.
 */

export interface ScoreInputs {
  identityVerified: boolean;
  endpointVerified: boolean;
  performanceVerified: boolean;
  registrationTimestamp: string | null;
  lastIndexedAt: string | null;
  endpointHealthStatuses: string[]; // e.g. ["online", "offline"]
  performance: {
    totalTasks: number;
    successfulTasks: number | null;
    averageExecutionTimeSeconds: number | null;
  } | null;
}

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number; // 0-1, fraction of the base score
  value: number | null; // 0-100, or null if insufficient data
  note?: string;
}

export interface AetherScoreResult {
  status: "new" | "scored";
  score: number | null; // 0-100, only present when status === "scored"
  components: ScoreComponent[];
}

/**
 * Weights for the base Aether Score. Redistributed after removing
 * `capability_match` (see file header) — rather than inflating
 * `verified_task_performance` further, the freed weight went mostly to
 * `security_verification` and `reliability_activity`: both are real,
 * always-available-once-indexed signals with zero missing-data risk, and
 * both are core to the product's "trust layer" premise (spec Section 7/8
 * of the master spec). `data_confidence` is new (see file header).
 */
const WEIGHTS = {
  verified_task_performance: 0.3,
  data_confidence: 0.15,
  reliability_activity: 0.2,
  onchain_reputation: 0.1,
  speed: 0.05,
  cost_efficiency: 0.05,
  security_verification: 0.15,
} as const;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60 * 24);
}

/** Wilson score interval lower bound (95% CI) — standard statistical
 * technique (Wilson, 1927), not an invented sample-size penalty. Used only
 * for `verified_task_performance`; sample-size confidence is computed
 * separately below by a formula that doesn't depend on the outcome. */
function wilsonLowerBound(successes: number, total: number): number {
  if (total <= 0) return 0;
  const z = 1.96;
  const p = successes / total;
  const denom = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return (centre - margin) / denom;
}

/** Sample-size confidence, independent of the outcome. A standard
 * hyperbolic-saturation curve (`n / (n + K)`) — the same shape used for
 * Bayesian pseudo-count smoothing — asymptotically approaching 100% as
 * evidence accumulates, never touching successes/failures at all. K=20 is
 * chosen so the curve has real separation across the sample sizes this
 * marketplace actually sees (a brand-new agent's first few tasks vs. an
 * established one with hundreds): n=1 → ~5%, n=20 → 50%, n=100 → ~83%,
 * n=1000 → ~98%. Not a magic-number penalty on the score — a monotonic
 * saturation constant on an evidence-volume measure that would otherwise
 * need one either way. */
const CONFIDENCE_HALF_SATURATION_TASKS = 20;
function dataConfidence(total: number): number {
  if (total <= 0) return 0;
  return (total / (total + CONFIDENCE_HALF_SATURATION_TASKS)) * 100;
}

/**
 * Computes the Aether Score for a single agent from data already sitting in
 * `agents`/`agent_endpoints`/`agent_performance`. Query-independent — see
 * "Aether Score vs Match Score" above. Used by the marketplace list,
 * /rankings, and /compare.
 */
export function computeAetherScore(inputs: ScoreInputs): AetherScoreResult {
  const rawTotalTasks = inputs.performance?.totalTasks ?? 0;

  if (rawTotalTasks <= 0) {
    // No fabricated number for a fresh agent, regardless of how "verified"
    // everything else is. `<= 0` (not `=== 0`) so a corrupted negative
    // total_tasks value can't slip past this gate into the scored branch.
    return { status: "new", score: null, components: [] };
  }

  // Defensive clamp against database corruption: successful_tasks should
  // never exceed total_tasks, but if it does (a bad write, a race, manual
  // SQL) the Wilson bound below would take sqrt() of a negative number and
  // produce NaN, poisoning the entire weighted average. The DB doesn't
  // enforce this with a CHECK constraint, so it's enforced here.
  const totalTasks = rawTotalTasks;
  const successful = Math.max(0, Math.min(inputs.performance?.successfulTasks ?? 0, totalTasks));
  const performanceLowerBound = wilsonLowerBound(successful, totalTasks);

  const rawComponents: ScoreComponent[] = [
    {
      key: "verified_task_performance",
      label: "Verified task performance",
      weight: WEIGHTS.verified_task_performance,
      value: performanceLowerBound * 100,
      note:
        "Wilson lower bound (95% CI) of successful/total — NOT the raw rate. " +
        "A 1/1 agent scores low here despite a 100% raw rate; the bound " +
        "tightens toward the raw rate as the sample size grows.",
    },
    {
      key: "data_confidence",
      label: "Data confidence",
      weight: WEIGHTS.data_confidence,
      value: dataConfidence(totalTasks),
      note:
        "How much evidence exists, independent of whether it was good or bad " +
        "(pure function of sample size — never reads successes/failures). " +
        "1/1 has almost no evidence; 1000+ tasks has strong evidence.",
    },
    {
      key: "reliability_activity",
      label: "Reliability / activity",
      weight: WEIGHTS.reliability_activity,
      value: computeReliability(inputs),
    },
    {
      key: "onchain_reputation",
      label: "Onchain reputation",
      weight: WEIGHTS.onchain_reputation,
      value: computeReputationProxy(inputs.registrationTimestamp),
      note: "Proxy: time since registration. No review/reputation data source exists yet.",
    },
    {
      key: "speed",
      label: "Speed",
      weight: WEIGHTS.speed,
      value: computeSpeedScore(inputs.performance?.averageExecutionTimeSeconds ?? null),
    },
    {
      key: "cost_efficiency",
      label: "Cost efficiency",
      weight: WEIGHTS.cost_efficiency,
      value: null,
      note: "No real settled task pricing exists until ERC-8183 hiring ships (Phase 5).",
    },
    {
      key: "security_verification",
      label: "Security / verification",
      weight: WEIGHTS.security_verification,
      value: computeVerificationScore(inputs),
    },
  ];

  // Defense-in-depth clamp: every component value is forced into [0,100] or
  // treated as missing (null) if it isn't a finite number. A bug in any
  // single `compute*` helper (NaN, Infinity, out-of-range) can only ever
  // remove that one component from the average — via the same
  // renormalization path as genuinely-missing data — and can never corrupt
  // or blow past the bound of the final aggregate score.
  const components: ScoreComponent[] = rawComponents.map((c) => ({
    ...c,
    value:
      c.value === null || !Number.isFinite(c.value)
        ? null
        : Math.max(0, Math.min(100, c.value)),
  }));

  const available = components.filter((c) => c.value !== null);
  const availableWeight = available.reduce((sum, c) => sum + c.weight, 0);

  if (availableWeight === 0) {
    return { status: "new", score: null, components };
  }

  const weightedSum = available.reduce((sum, c) => sum + (c.value as number) * c.weight, 0);
  const score = weightedSum / availableWeight;

  return { status: "scored", score: Math.round(Math.max(0, Math.min(100, score))), components };
}

function computeReliability(inputs: ScoreInputs): number | null {
  if (inputs.endpointHealthStatuses.length === 0) return null;
  const onlineFraction =
    inputs.endpointHealthStatuses.filter((s) => s === "online").length /
    inputs.endpointHealthStatuses.length;

  const indexedDaysAgo = daysSince(inputs.lastIndexedAt);
  // Freshness decays over 7 days from "fully fresh" to "stale but not zero" —
  // an indexer that hasn't re-checked in a week shouldn't silently keep
  // reporting an agent as reliable.
  const freshness =
    indexedDaysAgo === null ? 0.5 : Math.max(0.3, 1 - Math.min(indexedDaysAgo, 7) / 7);

  return onlineFraction * freshness * 100;
}

function computeReputationProxy(registrationTimestamp: string | null): number | null {
  const days = daysSince(registrationTimestamp);
  if (days === null) return null;
  const CAP_DAYS = 90; // full marks once an identity has existed 90+ days
  return Math.min(100, (days / CAP_DAYS) * 100);
}

function computeSpeedScore(avgSeconds: number | null): number | null {
  if (avgSeconds === null || avgSeconds <= 0) return null;
  const CEILING_SECONDS = 30; // reference ceiling: 30s+ scores ~0, near-instant scores ~100
  return Math.max(0, 100 - (avgSeconds / CEILING_SECONDS) * 100);
}

function computeVerificationScore(inputs: ScoreInputs): number {
  // Deterministic and always available (booleans, never missing) — this is
  // one of the components that's real for every indexed agent from day one.
  return (
    (inputs.identityVerified ? 40 : 0) +
    (inputs.endpointVerified ? 30 : 0) +
    (inputs.performanceVerified ? 30 : 0)
  );
}
