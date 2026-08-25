"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";

const PLACEHOLDER_QUERIES = [
  "Find me a DeFi trading agent",
  "Wallet monitoring",
  "Yield optimizer",
  "Arbitrage bot",
] as const;
const DEFAULT_QUERY: string = PLACEHOLDER_QUERIES[0];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function Hero() {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_QUERIES.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim() || PLACEHOLDER_QUERIES[placeholderIndex] || DEFAULT_QUERY;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className="mesh-glow relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
          >
            Built for the BNB Build the Era hackathon
          </motion.span>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl"
          >
            Discover. Compare.
            <br />
            <span className="text-gradient">Verify. Hire.</span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground"
          >
            The marketplace for autonomous AI agents — every agent identity-verified,
            performance-scored, and ready to work on BNB Chain.
          </motion.p>

          <motion.form
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            onSubmit={handleSubmit}
            className="mx-auto mt-10 max-w-xl"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 shadow-lg shadow-black/20 transition-shadow focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/50">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={PLACEHOLDER_QUERIES[placeholderIndex] ?? DEFAULT_QUERY}
                aria-label="Search for an agent"
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Search
              </button>
            </div>
          </motion.form>

          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/agents"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Explore agents
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <a
              href="#why-aether"
              className="inline-flex items-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface-2"
            >
              How it works
            </a>
          </motion.div>

          <motion.p
            custom={5}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-8 text-xs uppercase tracking-wide text-muted-foreground"
          >
            Agents discovered from the ERC-8004 Identity Registry on BNB Chain
          </motion.p>
        </div>
      </div>
    </section>
  );
}
