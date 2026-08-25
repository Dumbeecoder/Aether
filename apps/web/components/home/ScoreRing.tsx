/** The one signature motif reused across the homepage: an agent's Aether
 * Score rendered as a conic-gradient arc rather than a flat badge. Ties the
 * homepage's visual language directly to the product's actual mechanism
 * (every agent has a transparent, auditable score) instead of decoration
 * for its own sake. `score === null` renders an open dashed ring — "New,"
 * matching the existing AetherScoreResult "new" status semantics. */
export function ScoreRing({ score, size = 44 }: { score: number | null; size?: number }) {
  const pct = score ?? 0;
  const stroke = size * 0.11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="score-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--accent))" />
            <stop offset="100%" stopColor="hsl(var(--accent-2))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
        />
        {score !== null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#score-ring-gradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted-foreground) / 0.5)"
            strokeWidth={stroke * 0.6}
            strokeDasharray="2 4"
          />
        )}
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono font-medium tabular-nums"
        style={{ fontSize: size * 0.28 }}
      >
        {score !== null ? score : "—"}
      </span>
    </div>
  );
}

const AVATAR_GRADIENTS: [string, string][] = [
  ["45 93% 58%", "254 70% 65%"],
  ["142 60% 45%", "254 70% 65%"],
  ["45 93% 58%", "0 72% 55%"],
  ["199 89% 58%", "254 70% 65%"],
  ["254 70% 65%", "320 70% 60%"],
];

const DEFAULT_GRADIENT: [string, string] = ["45 93% 58%", "254 70% 65%"];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}

/** Deterministic gradient "avatar" derived from the agent's slug — no
 * external image dependency (nothing to lazy-load-fail on), same identity
 * every render. Initials give it just enough specificity per agent. */
export function AgentAvatar({ seed, name, size = 44 }: { seed: string; name: string; size?: number }) {
  const gradient = AVATAR_GRADIENTS[hashSeed(seed) % AVATAR_GRADIENTS.length] ?? DEFAULT_GRADIENT;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white/90"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        backgroundImage: `linear-gradient(135deg, hsl(${gradient[0]}), hsl(${gradient[1]}))`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
