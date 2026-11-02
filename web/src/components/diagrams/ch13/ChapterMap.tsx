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
    name: "Data integration",
    tag: "one log, many views",
    color: "var(--neon-1)",
    points: [
      "Derived data vs distributed transactions",
      "Limits of total ordering",
      "Causality",
      "Batch + stream: kappa",
    ],
  },
  {
    name: "Unbundling",
    tag: "the database, inside out",
    color: "var(--neon-2)",
    points: [
      "Federated: unifying reads",
      "Unbundled: unifying writes",
      "Loose coupling",
      "Code = derivation function",
      "Write path and read path",
      "All the way to the client",
      "Reads are events",
    ],
  },
  {
    name: "Correctness",
    tag: "integrity without 2PC",
    color: "var(--neon-3)",
    points: [
      "End-to-end argument",
      "Request ID",
      "Uniqueness: consensus, but sharded",
      "Multishard without 2PC",
      "Timeliness vs integrity",
      "Loose constraints, apologies",
      "Trust but verify",
    ],
  },
];

/**
 * Chapter map: the root idea (an ordered log with idempotent consumers)
 * and the three essays that grow out of it. Tapping a branch reveals
 * the topics it covers; on wide screens all three stay visible.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="MAP" title="one idea, three essays" scroll={false}>
      <div className="border border-line bg-surface">
        <div className="px-4 py-3 border-b border-line text-center">
          <p className="font-semibold">Philosophy of streaming systems</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
            ordered event log + idempotent consumers
          </p>
          <div className="mt-3 flex justify-center gap-10">
            {BRANCHES.map((b) => (
              <span key={b.name} className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line">
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
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold leading-tight">{b.name}</span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 leading-snug">
                      {b.tag}
                    </span>
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                </div>
                <ul className={`mt-3 space-y-1 text-sm leading-snug ${isOpen ? "" : "hidden md:block md:opacity-60"}`}>
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
      </div>
    </Figure>
  );
}
