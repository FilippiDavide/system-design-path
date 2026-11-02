"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";

interface Branch {
  title: string;
  question: string;
  color: string;
  points: string[];
}

const BRANCHES: Branch[] = [
  {
    title: "What it is and when",
    question: "Should I shard at all?",
    color: "var(--neon-1)",
    points: [
      "Shard + replica: each record in one shard, each shard copied",
      "Only at large scale: for data and writes, not for reads",
      "Multitenancy: one tenant per shard, cell-based architecture",
    ],
  },
  {
    title: "Key-value sharding",
    question: "Which shard gets this record?",
    color: "var(--neon-2)",
    points: [
      "Key range: ordered, range scans, hot spots",
      "Hash: uniform, no range queries",
      "mod N: no · fixed shards · hash range, consistent hashing",
      "Hot keys: isolate, or append random digits",
      "Rebalancing: automatic or manual",
    ],
  },
  {
    title: "Request routing",
    question: "Which node holds that shard?",
    color: "var(--neon-3)",
    points: [
      "Any node forwards · routing tier · informed client",
      "The map lives in ZooKeeper, etcd, Raft, or gossip",
    ],
  },
  {
    title: "Secondary indexes",
    question: "Search without the partition key?",
    color: "var(--neon-4)",
    points: [
      "Local (document-partitioned): easy write, read everywhere",
      "Global (term-partitioned): easy read, write everywhere",
    ],
  },
];

/**
 * Chapter map: the central node "Sharding" and its four branches,
 * each one answering a question. Tap a card to open its topics.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="MAP" title="three questions and one complication" scroll={false}>
      <div className="border border-line bg-surface">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <span className="font-dot text-2xl font-bold leading-none">Sharding</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2">
            split the data, spread the writes
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line">
          {BRANCHES.map((br, i) => {
            const isOpen = open === i;
            return (
              <button
                key={br.title}
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="text-left bg-surface p-4 sm:p-5 hover:bg-surface-2 transition-colors"
                style={{ boxShadow: `inset 4px 0 0 ${br.color}` }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-dot text-2xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight">{br.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{br.question}</p>
                  </div>
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
      </div>
    </Figure>
  );
}
