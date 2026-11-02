"use client";

import { useState } from "react";

const REASONS = [
  ["Inherent distribution", "several users on several devices"],
  ["Requests between cloud services", "data in one service, processing in another"],
  ["Fault tolerance / high availability", "redundancy"],
  ["Scalability", "data or computation beyond one machine"],
  ["Latency", "servers close to users around the world"],
  ["Elasticity", "scale with the load, pay for what you use"],
  ["Specialized hardware", "disks here, CPUs there, GPUs elsewhere"],
  ["Legal compliance", "data residency per jurisdiction"],
  ["Sustainability", "run jobs where renewable energy is"],
];

const COSTS = [
  "Partial failure: every call can time out without knowing whether it ran",
  "Slow network compared with an in-process call",
  "Hard to debug: you need observability",
  "Consistency across services becomes the application's problem",
];

/**
 * A checklist for the chapter's conclusion: distribute only for one of
 * the nine reasons, and know the four costs you sign up for.
 */
export function DistributeLab() {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const yes = picked.size > 0;

  return (
    <div className="border border-line grid md:grid-cols-[1fr_260px]">
      <ul className="divide-y divide-line-soft">
        {REASONS.map(([t, s], i) => {
          const on = picked.has(i);
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={on}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
              >
                <span className={`w-3.5 h-3.5 rounded-full border border-ink shrink-0 ${on ? "bg-neon-3 border-neon-3" : ""}`} />
                <span className="font-dot text-base font-bold w-6">{i + 1}</span>
                <span className="text-sm">
                  <span className="font-medium">{t}</span>
                  <span className="text-ink-2"> · {s}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <aside className="border-t md:border-t-0 md:border-l border-line-soft p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">verdict</p>
        <p className="font-dot text-2xl font-bold mt-1 leading-tight">
          {yes ? "DISTRIBUTE" : "STAY ON ONE NODE"}
        </p>
        <p className="mt-2 text-[12px] text-ink-2 leading-relaxed">
          {yes
            ? `${picked.size} reason${picked.size > 1 ? "s apply" : " applies"}. You accept all four costs:`
            : "No reason applies. A single machine with DuckDB, SQLite or PostgreSQL will likely beat a cluster, and it is far easier to debug."}
        </p>
        {yes && (
          <ul className="mt-3 space-y-1.5 text-[12px] leading-snug">
            {COSTS.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-neon-5 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
