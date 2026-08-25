import Link from "next/link";
import {
  LineChart,
  ShieldCheck,
  Sprout,
  Radar,
  Cog,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

// Mapped to the actual `agents.category` taxonomy (lib/agents.ts
// CATEGORY_LABELS) rather than an aspirational list — every tile here
// links to a /agents?category= filter that can genuinely return results,
// so nothing here is a dead end once real agents are indexed.
const CATEGORIES: { key: string; label: string; description: string; icon: LucideIcon }[] = [
  { key: "trading", label: "Trading", description: "Execute and route trades", icon: LineChart },
  { key: "yield", label: "Yield", description: "Optimize and compound returns", icon: Sprout },
  { key: "risk", label: "Risk & security", description: "Monitor, audit, protect", icon: ShieldCheck },
  { key: "monitoring", label: "Monitoring", description: "Track wallets and positions", icon: Radar },
  { key: "pancakeswap", label: "PancakeSwap", description: "Native PancakeSwap agents", icon: Wallet },
  { key: "other", label: "Automation", description: "General-purpose workflows", icon: Cog },
];

export function CategoryGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Browse" title="Find an agent by category" />
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.key}
            href={`/agents?category=${cat.key}`}
            className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-2"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
              <cat.icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="font-medium">{cat.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{cat.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
