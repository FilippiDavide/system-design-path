"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";

interface Branch {
  name: string;
  color: string;
  points: string[];
}

const BRANCHES: Branch[] = [
  {
    name: "Ethics",
    color: "var(--neon-1)",
    points: ["Not a checklist: interpretation, dialog, accountability", "Technology is not neutral in its use"],
  },
  {
    name: "Predictive analytics",
    color: "var(--neon-2)",
    points: [
      "Algorithmic prison: many \"no\" decisions, no appeal",
      "Bias: machine learning as money laundering for bias",
      "Accountability: who answers for the algorithm's mistake?",
      "Feedback loops: self-reinforcing, systems thinking",
    ],
  },
  {
    name: "Privacy and tracking",
    color: "var(--neon-3)",
    points: [
      "Surveillance: replace \"data\" with \"surveillance\"",
      "Consent not freely given: why, what, one-way",
      "Privacy = decision right, transferred to the company",
      "Data as uranium: toxic asset, all future governments",
      "Industrial Revolution: data as pollution",
    ],
  },
  {
    name: "Legislation and self-regulation",
    color: "var(--neon-4)",
    points: ["GDPR data minimization vs the big data philosophy", "Minimize what you collect, purge what you no longer need"],
  },
];

/**
 * Chapter map: the root idea in the middle, four branches around it.
 * Tapping a branch reveals the topics the chapter covers under it.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(1);
  return (
    <Figure label="MAP" title="four branches of one argument" scroll={false}>
      <div className="relative">
        <p className="sm:hidden mb-px border border-line bg-ink text-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-center">
          Doing the right thing
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
          {BRANCHES.map((br, i) => {
            const isOpen = open === i;
            return (
              <button
                key={br.name}
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="text-left bg-surface p-4 sm:p-5 hover:bg-surface-2 transition-colors min-h-[150px]"
              >
                <div className="flex items-center gap-3">
                  <span className="font-dot text-2xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: br.color }} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{br.name}</span>
                </div>
                <ul className={`mt-3 space-y-1 text-sm leading-snug ${isOpen ? "" : "hidden sm:block sm:opacity-60"}`}>
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
        {/* Root node, sitting on the crossing of the four cards. */}
        <span
          aria-hidden="true"
          className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-ink bg-ink text-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] whitespace-nowrap"
        >
          Doing the right thing
        </span>
      </div>
    </Figure>
  );
}
