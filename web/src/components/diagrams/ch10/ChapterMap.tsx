"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { NEON } from "../primitives";

interface Branch {
  title: string;
  tag: string;
  color: string;
  points: string[];
}

const BRANCHES: Branch[] = [
  {
    title: "Linearizability",
    tag: "one copy, atomic ops",
    color: NEON.blue,
    points: [
      "A single copy, atomic operations",
      "Recency guarantee",
      "Not serializability",
      "Needed for: locks, uniqueness, cross-channel",
      "Who provides it and who doesn't",
      "CAP and its real cost",
    ],
  },
  {
    title: "IDs and logical clocks",
    tag: "unique, ordered, not linearizable",
    color: NEON.magenta,
    points: [
      "Autoincrement, UUID, Snowflake",
      "Lamport, hybrid logical clock",
      "Vector clock",
      "Linearizable ID generator",
    ],
  },
  {
    title: "Consensus",
    tag: "agreeing with faults",
    color: NEON.green,
    points: [
      "FLP",
      "The equivalent faces",
      "Shared log, state machine replication",
      "Epochs and two rounds of voting",
      "Costs",
      "Coordination service",
    ],
  },
];

/**
 * Chapter map: a root node and the three branches of the mindmap, one
 * neon per branch. Tapping a branch reveals its topics on narrow screens.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="MAP" title="three branches: a definition, an approximation, a solution" scroll={false}>
      <div className="flex flex-col items-center">
        <span className="border border-ink bg-surface px-4 py-2 font-semibold text-sm">Consistency and consensus</span>
        <span className="w-px h-5 bg-ink" aria-hidden />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border border-line">
        {BRANCHES.map((b, i) => {
          const isOpen = open === i;
          return (
            <button
              key={b.title}
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex flex-col justify-start text-left bg-surface p-4 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-dot text-2xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                <span className="font-semibold text-sm">{b.title}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{b.tag}</p>
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
