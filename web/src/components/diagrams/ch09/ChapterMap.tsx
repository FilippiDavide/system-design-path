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
    name: "Partial failures",
    tag: "the premise",
    color: "var(--neon-5)",
    points: [
      "One machine: works or crashes, deterministic",
      "Many machines: some parts broken, others fine, nondeterministic",
      "The same operation sometimes succeeds, sometimes not, and you may not know which",
    ],
  },
  {
    name: "Unreliable networks",
    tag: "messages",
    color: "var(--neon-1)",
    points: [
      "Timeout: the only tool",
      "TCP is not enough",
      "Queues and unbounded delays",
      "Circuits vs packets",
    ],
  },
  {
    name: "Unreliable clocks",
    tag: "time",
    color: "var(--neon-2)",
    points: [
      "Time-of-day vs monotonic",
      "NTP, drift, leap seconds",
      "LWW and causality",
      "Confidence interval, TrueTime",
      "Process pauses, leases",
    ],
  },
  {
    name: "Knowledge and truth",
    tag: "reasoning",
    color: "var(--neon-3)",
    points: [
      "Quorum",
      "Locks, zombies, fencing tokens",
      "Byzantine",
      "System models",
      "Safety and liveness",
    ],
  },
  {
    name: "Testing",
    tag: "verification",
    color: "var(--neon-4)",
    points: ["Model checking, fault injection, DST", "The power of determinism"],
  },
];

/**
 * Chapter map: the central node (partial failures) and the four
 * branches that follow from it. Tapping a card reveals its topics; on
 * wider screens the closed cards stay readable but dimmed.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="MAP" title="trouble with distributed systems" scroll={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
        {BRANCHES.map((b, i) => {
          const isOpen = open === i;
          const first = i === 0;
          return (
            <button
              key={b.name}
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className={`flex flex-col text-left bg-surface p-4 sm:p-5 hover:bg-surface-2 transition-colors ${
                first ? "sm:col-span-2" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-dot text-2xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                  <span>{b.name}</span>
                  <span className="flex-1 h-px bg-ink relative">
                    <span
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                      style={{ background: b.color }}
                    />
                  </span>
                  <span className="text-ink-2">{b.tag}</span>
                </span>
              </div>
              <ul
                className={`mt-3 space-y-1 text-sm leading-snug ${
                  first ? "sm:grid sm:grid-cols-3 sm:gap-x-4 sm:space-y-0" : "sm:block"
                } ${isOpen ? "" : "hidden sm:opacity-60"}`}
              >
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
