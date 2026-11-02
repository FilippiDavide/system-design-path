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
    name: "Transmitting events",
    tag: "producer → broker → consumer",
    color: "var(--neon-1)",
    points: [
      "Direct messaging: UDP multicast, ZeroMQ, webhooks",
      "AMQP/JMS brokers: ack, redelivery, dead letter queue",
      "Log-based brokers: partitions, offsets, replay",
    ],
  },
  {
    name: "Databases and streams",
    tag: "a database is a stream",
    color: "var(--neon-2)",
    points: [
      "Dual write: no",
      "Change data capture",
      "Log compaction",
      "Outbox pattern",
      "State = integral of the events",
      "Limits of immutability",
    ],
  },
  {
    name: "Processing",
    tag: "operators over unbounded input",
    color: "var(--neon-3)",
    points: [
      "CEP, analytics, materialized views",
      "Event time vs processing time",
      "Stragglers and windows",
      "Joins: stream-stream, stream-table, table-table",
      "Fault tolerance: microbatch, checkpoint, transactions, idempotence",
    ],
  },
];

/**
 * Chapter map: the central "stream processing" node and its three
 * branches. On a phone only the tapped branch is expanded; on wider
 * screens every branch is visible and tapping just emphasises one.
 */
export function ChapterMap() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Figure label="MAP" title="three branches" scroll={false}>
      <div className="border border-line bg-surface">
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-b border-line">
          <span className="w-2.5 h-2.5 rounded-full bg-ink" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Stream processing</span>
          <span className="w-2.5 h-2.5 rounded-full bg-ink" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line">
          {BRANCHES.map((br, i) => {
            const isOpen = open === i;
            return (
              <button
                key={br.name}
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="text-left bg-surface p-4 sm:p-5 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-dot text-2xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: br.color }} />
                  <span className="font-semibold text-sm leading-tight">{br.name}</span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{br.tag}</p>
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
