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
    name: "Why",
    tag: "the goal",
    color: "var(--neon-5)",
    points: ["Latency, availability, read throughput", "Replication is not backup"],
  },
  {
    name: "Single-leader",
    tag: "one node writes",
    color: "var(--neon-1)",
    points: [
      "Synchronous vs asynchronous",
      "New followers, object storage",
      "Failover and its troubles",
      "Log: statement, WAL, logical",
    ],
  },
  {
    name: "Replication lag",
    tag: "three guarantees",
    color: "var(--neon-3)",
    points: ["Read-your-writes", "Monotonic reads", "Consistent prefix"],
  },
  {
    name: "Multi-leader",
    tag: "several nodes write",
    color: "var(--neon-2)",
    points: [
      "Geo-distributed, topologies",
      "Sync engine, local-first",
      "Conflicts: avoid, LWW, manual, automatic",
      "CRDTs and OT",
    ],
  },
  {
    name: "Leaderless",
    tag: "any replica writes",
    color: "var(--neon-4)",
    points: [
      "Quorum w + r > n",
      "Read repair, hinted handoff, anti-entropy",
      "Happens-before, version vector",
    ],
  },
];

/**
 * Chapter map: the "why" on top, then the three replication families
 * plus the lag anomalies that cut across them. Tap a card to expand
 * its topics on a phone; on wider screens every card is readable and
 * the tapped one is emphasised.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(1);
  return (
    <Figure label="FIG 01" title="chapter map · three families, one trade-off" scroll={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
        {BRANCHES.map((br, i) => {
          const isOpen = open === i;
          return (
            <button
              key={br.name}
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className={`text-left bg-surface p-4 sm:p-5 hover:bg-surface-2 transition-colors ${
                i === 0 ? "sm:col-span-2" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-dot text-2xl font-bold leading-none">{String(i).padStart(2, "0")}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: br.color }} />
                <span className="font-semibold">{br.name}</span>
                <span className="flex-1 h-px bg-line-soft" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">{br.tag}</span>
              </div>
              <ul
                className={`mt-3 text-sm leading-snug ${
                  i === 0 ? "sm:flex sm:gap-6 space-y-1 sm:space-y-0" : "space-y-1"
                } ${isOpen ? "" : "hidden sm:block sm:opacity-60"}`}
              >
                {br.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: br.color }} />
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
