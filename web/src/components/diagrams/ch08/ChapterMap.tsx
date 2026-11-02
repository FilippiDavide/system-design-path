"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";

interface Branch {
  name: string;
  tag: string;
  color: string;
  points: string[];
}

const BRANCHES: Branch[] = [
  {
    name: "ACID",
    tag: "what is promised",
    color: "var(--neon-1)",
    points: [
      "Atomicity = abortability",
      "Consistency: the application's invariants",
      "Isolation: ideally serializability",
      "Durability: nothing is perfect, stack the risk reductions",
    ],
  },
  {
    name: "Weak levels",
    tag: "what slips through",
    color: "var(--neon-2)",
    points: [
      "Read committed: no dirty reads, no dirty writes",
      "Snapshot isolation, MVCC: readers never block writers",
      "Lost update: atomic op, lock, detection, compare-and-set",
      "Write skew and phantoms",
    ],
  },
  {
    name: "Serializability",
    tag: "three ways to pay",
    color: "var(--neon-3)",
    points: [
      "Actual serial execution, stored procedures",
      "Two-phase locking, predicate and index-range locks",
      "SSI: optimistic, abort at commit",
    ],
  },
  {
    name: "Distributed",
    tag: "many nodes, one outcome",
    color: "var(--neon-4)",
    points: [
      "Atomic commitment, two-phase commit",
      "Coordinator crash: participants in doubt",
      "Heterogeneous XA",
      "Exactly-once with idempotence instead",
    ],
  },
];

/**
 * Chapter map: the central "Transactions" node and its four branches,
 * one neon each. Tap a branch to open its topics on a phone; on wider
 * screens all four are visible at once.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="FIG 01" title="chapter map · four branches" scroll={false}>
      <div className="flex items-center gap-3 mb-px px-4 py-3 border border-line bg-surface">
        <span className="font-dot text-2xl font-bold leading-none">Transactions</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          all or nothing · as if alone · not lost
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line border-t-0">
        {BRANCHES.map((b, i) => {
          const isOpen = open === i;
          return (
            <button
              key={b.name}
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="text-left bg-surface p-4 sm:p-5 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-dot text-2xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                <span className="flex-1 flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                  <span>{b.name}</span>
                  <span className="text-ink-2">· {b.tag}</span>
                </span>
              </div>
              <ul className={`mt-3 space-y-1 text-sm leading-snug ${isOpen ? "" : "hidden sm:block sm:opacity-60"}`}>
                {b.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: b.color }} />
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
