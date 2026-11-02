"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";

interface Axis {
  a: string;
  b: string;
  color: string;
  points: string[];
}

const AXES: Axis[] = [
  {
    a: "Operational",
    b: "Analytical",
    color: "var(--neon-1)",
    points: [
      "OLTP: point queries, latest state",
      "OLAP: aggregates, history",
      "Data warehouse + ETL",
      "Data lake, sushi principle",
      "System of record vs derived data",
    ],
  },
  {
    a: "Cloud",
    b: "Self-hosting",
    color: "var(--neon-2)",
    points: [
      "Build or buy",
      "Spectrum: bespoke → SaaS",
      "Cloud native: separate storage and compute, multitenancy",
      "Ops: capacity planning → cost planning",
    ],
  },
  {
    a: "Distributed",
    b: "Single node",
    color: "var(--neon-3)",
    points: [
      "9 reasons to distribute",
      "Costs: network, retries, debugging, consistency",
      "Microservices and serverless",
      "Cloud vs HPC",
    ],
  },
  {
    a: "Business",
    b: "Society",
    color: "var(--neon-4)",
    points: ["GDPR, right to be forgotten", "Data minimization", "Immutability vs deletion"],
  },
];

/**
 * Chapter map as four trade-off axes. Each card is one axis with its
 * two poles; tapping a card reveals the topics the chapter covers on it.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="MAP" title="four axes of trade-offs" scroll={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
        {AXES.map((ax, i) => {
          const isOpen = open === i;
          return (
            <button
              key={ax.a}
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="text-left bg-surface p-4 sm:p-5 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-dot text-2xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                  <span>{ax.a}</span>
                  <span className="flex-1 h-px bg-ink relative">
                    <span
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                      style={{ background: ax.color }}
                    />
                  </span>
                  <span>{ax.b}</span>
                </span>
              </div>
              <ul className={`mt-3 space-y-1 text-sm leading-snug ${isOpen ? "" : "hidden sm:block sm:opacity-60"}`}>
                {ax.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ax.color }} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </Figure>
  );
}
