"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";

interface Branch {
  title: string;
  tag: string;
  color: string;
  points: string[];
}

const BRANCHES: Branch[] = [
  {
    title: "Relational vs document",
    tag: "tables · JSON",
    color: "var(--neon-1)",
    points: [
      "Impedance mismatch, ORMs, the N+1 query",
      "One-to-many: a tree with locality",
      "Normalization: IDs never change, text does",
      "Many-to-many: join tables, secondary indexes",
      "Star and snowflake for analytics",
      "Schema-on-write vs schema-on-read",
    ],
  },
  {
    title: "Graphs",
    tag: "vertices · edges",
    color: "var(--neon-2)",
    points: [
      "Property graph, Cypher, WITHIN*0..",
      "Triple stores, RDF, SPARQL",
      "Datalog: recursive rules",
      "GraphQL: not a graph database",
    ],
  },
  {
    title: "Event sourcing and CQRS",
    tag: "immutable log",
    color: "var(--neon-3)",
    points: ["The event log is the truth; commands are validated into events", "Materialized views, recomputable from scratch"],
  },
  {
    title: "DataFrames and matrices",
    tag: "analytics · ML",
    color: "var(--neon-4)",
    points: ["Pandas, R, Spark: a sequence of commands on your copy", "One-hot encoding, sparse matrices, linear algebra"],
  },
];

/**
 * Chapter map as four families of data models. Each card is one
 * branch of the mindmap; tapping a card reveals the topics it covers.
 * The question that ties them together sits in the caption.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure
      label="MAP"
      title="four families of data models"
      scroll={false}
      caption="The model decides how you write the code and how you think about the problem. One question picks the family: what relationships are there in my data, and how do I query them?"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
        {BRANCHES.map((b, i) => {
          const isOpen = open === i;
          return (
            <button
              key={b.title}
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="text-left bg-surface p-4 sm:p-5 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-dot text-2xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-sm leading-tight">{b.title}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">{b.tag}</span>
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
