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
    name: "OLTP engines",
    tag: "store one record, find it again",
    color: "var(--neon-1)",
    points: [
      "Append-only log + in-memory hash index",
      "SSTable, memtable, LSM-tree: compaction, Bloom filter",
      "B-tree: fixed pages, WAL, page split",
      "LSM vs B-tree: write amplification, latency",
      "Secondary, clustered, covering indexes",
      "In-memory databases",
    ],
  },
  {
    name: "Analytics",
    tag: "scan millions of rows, few columns",
    color: "var(--neon-2)",
    points: [
      "Cloud warehouse: engine, format, table, catalog",
      "Column-oriented storage",
      "Bitmap compression, run-length encoding",
      "Sort order by whole row",
      "Query compilation or vectorization",
      "Materialized views, data cube",
    ],
  },
  {
    name: "Multidimensional indexes",
    tag: "several conditions at once",
    color: "var(--neon-3)",
    points: [
      "Concatenated index vs R-tree, space-filling curve",
      "Inverted index, postings list, n-grams",
      "Vector embeddings: flat, IVF, HNSW",
    ],
  },
];

/**
 * Chapter map as three branches around one question: how does a
 * database store what it is given and find it again? Tapping a card
 * reveals the topics the chapter covers on that branch.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="FIG 01" title="storage and retrieval · three branches" scroll={false}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line border border-line">
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
                <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{b.name}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{b.tag}</p>
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
    </Figure>
  );
}
