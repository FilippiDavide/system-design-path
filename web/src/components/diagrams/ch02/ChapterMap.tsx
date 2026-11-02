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
    name: "Case study",
    tag: "social timeline",
    color: "var(--neon-1)",
    points: [
      "Pull: query with two joins, polling every 5 s",
      "Push: fan-out on write into each follower's mailbox",
      "The cached timeline is a materialized view",
      "Celebrity: hybrid push + pull, merged at read time",
    ],
  },
  {
    name: "Performance",
    tag: "measure it",
    color: "var(--neon-2)",
    points: [
      "Response time vs throughput",
      "Queueing, overload, retry storms",
      "Percentiles and tail latency",
      "SLOs and SLAs",
    ],
  },
  {
    name: "Reliability",
    tag: "fault tolerance",
    color: "var(--neon-3)",
    points: [
      "Fault vs failure",
      "Hardware faults: frequent but independent",
      "Software faults: rare but correlated",
      "Humans: blameless postmortems",
    ],
  },
  {
    name: "Scalability",
    tag: "a set of questions",
    color: "var(--neon-4)",
    points: [
      "Understanding load: the parameters that grow",
      "Shared memory / shared disk / shared nothing",
      "One order of magnitude at a time",
    ],
  },
  {
    name: "Maintainability",
    tag: "most of the cost",
    color: "var(--neon-5)",
    points: ["Operability: easy to keep running", "Simplicity: easy to understand", "Evolvability: easy to change"],
  },
];

/**
 * Chapter map: the root node ("nonfunctional requirements") plus the
 * five branches of the mindmap, one neon per branch. Tapping a branch
 * reveals the topics the chapter covers on it; on phones only the open
 * branch shows its topics.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="MAP" title="five branches of nonfunctional requirements" scroll={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line">
        <div className="bg-ink text-surface p-4 sm:p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-70">root</p>
          <p className="font-dot text-2xl font-bold leading-tight mt-1">Nonfunctional requirements</p>
          <p className="mt-3 text-sm leading-snug opacity-80">
            &ldquo;Fast, reliable, scalable, maintainable&rdquo; are requirements too, but they stay vague until you
            define them in a measurable way.
          </p>
        </div>
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
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold leading-tight">{b.name}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 truncate">
                    {b.tag}
                  </span>
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
