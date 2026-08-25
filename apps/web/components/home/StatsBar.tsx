"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

export interface StatItem {
  label: string;
  value: number | null;
  prefix?: string;
  suffix?: string;
}

export function StatsBar({ stats }: { stats: StatItem[] }) {
  return (
    <section className="border-y border-border bg-surface/50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="text-center"
          >
            <div className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {stat.value !== null ? (
                <>
                  {stat.prefix}
                  <Counter value={stat.value} suffix={stat.suffix} />
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="mt-1.5 text-sm text-muted-foreground">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
