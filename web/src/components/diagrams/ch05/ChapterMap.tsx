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
    name: "Compatibility",
    tag: "two directions",
    color: "var(--neon-1)",
    points: [
      "Backward: new code reads old data",
      "Forward: old code reads new data",
      "Unknown fields must be preserved",
    ],
  },
  {
    name: "Formats",
    tag: "bytes on the wire",
    color: "var(--neon-2)",
    points: [
      "Language-specific: never",
      "JSON, XML, CSV and binary variants",
      "Protocol Buffers: numeric tags",
      "Avro: writer's schema and reader's schema",
      "The merits of schemas",
    ],
  },
  {
    name: "Dataflow",
    tag: "three paths",
    color: "var(--neon-3)",
    points: [
      "Databases: data outlives code",
      "Services: REST, RPC, discovery",
      "Durable execution, workflows",
      "Events: brokers, actors",
    ],
  },
];

/**
 * Chapter map: the root "Encoding and evolution" with its three
 * branches. One card per branch, a neon per branch; tapping a card
 * reveals its topics on small screens.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="MAP" title="compatibility · formats · dataflow" scroll={false}>
      <div className="border border-line bg-surface">
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-b border-line">
          <span className="flex gap-1">
            {BRANCHES.map((b) => (
              <span key={b.name} className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
            ))}
          </span>
          <span className="font-dot text-xl font-bold tracking-wider">Encoding and evolution</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line">
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
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight">{b.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{b.tag}</p>
                  </div>
                  <span className="ml-auto w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
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
      </div>
    </Figure>
  );
}
