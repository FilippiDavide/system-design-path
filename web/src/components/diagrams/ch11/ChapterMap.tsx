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
    name: "What it is",
    tag: "immutable in, from scratch out",
    color: "var(--neon-1)",
    points: [
      "Immutable input, output regenerated from scratch",
      "Human fault tolerance, time travel",
      "Throughput, not latency",
    ],
  },
  {
    name: "Unix",
    tag: "one machine, pipes",
    color: "var(--neon-2)",
    points: ["awk, sort, uniq", "Sort vs in-memory hash", "Spill to disk like an LSM-tree"],
  },
  {
    name: "Distributed OS",
    tag: "filesystem, scheduler, programs",
    color: "var(--neon-3)",
    points: [
      "DFS and object stores",
      "Orchestrator: executor, resource manager, scheduler",
      "Workflow scheduler, DAG of jobs",
      "Faults and preemption, spot instances",
    ],
  },
  {
    name: "Models",
    tag: "how a job is expressed",
    color: "var(--neon-4)",
    points: [
      "MapReduce: map, sort, reduce",
      "Dataflow engines: Spark, Flink",
      "Shuffle: hash by key, sort, merge",
      "Sort-merge join, group by",
      "SQL, distributed DataFrames",
    ],
  },
  {
    name: "Use cases",
    tag: "where freshness does not matter",
    color: "var(--neon-5)",
    points: ["ETL, analytics, machine learning", "Serving derived data through a stream"],
  },
];

/**
 * Chapter map: one central node ("a batch job reads immutable input and
 * regenerates its output") with five branches around it. Tapping a
 * branch card reveals the topics the chapter covers on it.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="FIG 01" title="batch processing · five branches" scroll={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line">
        <div className="bg-ink text-surface p-4 sm:p-5 flex flex-col justify-between gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">root</span>
          <div>
            <p className="font-dot text-3xl font-bold leading-none">Batch processing</p>
            <p className="mt-3 text-sm leading-snug text-surface/80">
              Read immutable input, regenerate the output from scratch, no side effects. Wrong result?
              Fix the code and rerun.
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em]">
            {BRANCHES.map((b, i) => (
              <li key={b.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                {String(i + 1).padStart(2, "0")}
              </li>
            ))}
          </ul>
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
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                    {b.name}
                  </span>
                  <span className="block font-mono text-[10px] text-ink-2 leading-snug">{b.tag}</span>
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
