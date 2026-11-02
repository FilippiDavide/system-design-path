"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Group, Label, NEON } from "../primitives";

type Node = "write" | "wal" | "mt" | "s0" | "s1" | "s2" | "s3" | "read";

interface Step {
  title: string;
  text: string;
  lit: Node[];
}

const STEPS: Step[] = [
  {
    title: "1 · write",
    text: "A write goes into the memtable (a sorted in-memory tree) and, in parallel, is appended to a log on disk. The log exists only to rebuild the memtable after a crash.",
    lit: ["write", "wal", "mt"],
  },
  {
    title: "2 · flush",
    text: "When the memtable exceeds a few MB it is written out in one pass as a sorted SSTable: the newest segment. A fresh memtable starts and the log can be discarded.",
    lit: ["mt", "s0"],
  },
  {
    title: "3 · read",
    text: "A read checks the memtable first, then the segments from newest to oldest and stops at the first hit. Old or missing keys cost the most: that is what the Bloom filter is for.",
    lit: ["read", "mt", "s0", "s1", "s2"],
  },
  {
    title: "4 · compaction",
    text: "In the background, segments are merged like a mergesort: lowest key first, and when a key appears in several files only the most recent value survives. Tombstones drop deleted keys.",
    lit: ["s0", "s1", "s2", "s3"],
  },
];

/**
 * The LSM-tree write and read paths as a four-step walkthrough. Each
 * step lights up the parts of the engine that take part in it.
 */
export function LsmTree() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const on = (n: Node) => step.lit.includes(n);
  const acc = (n: Node, color: string) => (on(n) ? color : undefined);
  const arrow = (n: Node, color: "blue" | "magenta" | "green" | "orange") => (on(n) ? color : "soft");

  return (
    <Figure
      label="FIG 02"
      title="lsm-tree: memtable, segments, compaction"
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            <button
              type="button"
              onClick={() => setI((v) => Math.max(0, v - 1))}
              disabled={i === 0}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-surface">
              {step.title}
            </span>
            <button
              type="button"
              onClick={() => setI((v) => Math.min(STEPS.length - 1, v + 1))}
              disabled={i === STEPS.length - 1}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Next
            </button>
          </span>
          <span>{step.text}</span>
        </div>
      }
    >
      <Canvas w={780} h={330}>
        <Group x={190} y={30} w={190} h={280} label="RAM" />
        <Group x={410} y={30} w={350} h={280} label="disk · immutable segments" />

        {/* Write path */}
        <Box x={20} y={60} w={100} h={50} title="Write" accent={acc("write", NEON.blue)} />
        <Arrow pts={[120, 85, 210, 85]} color={arrow("write", "blue")} />
        <Box x={210} y={50} w={150} h={70} title="Memtable" sub={"sorted tree\nred-black, skip list"} accent={acc("mt", NEON.blue)} />
        <Arrow pts={[70, 110, 70, 230, 210, 230]} color={arrow("wal", "blue")} />
        <Cylinder x={210} y={200} w={150} h={60} title="Log on disk" sub="crash recovery only" accent={acc("wal", NEON.blue)} />

        {/* Flush */}
        <Arrow pts={[360, 85, 440, 85]} color={arrow("s0", "magenta")} label={"flush when\n> a few MB"} labelOffset={-24} />
        <Cylinder x={440} y={55} w={120} h={60} title="SSTable" sub="newest segment" accent={acc("s0", NEON.magenta)} />
        <Cylinder x={440} y={135} w={120} h={56} title="segment" sub="older" accent={acc("s1", NEON.magenta)} />
        <Cylinder x={440} y={211} w={120} h={56} title="segment" sub="oldest" accent={acc("s2", NEON.magenta)} />

        {/* Compaction */}
        <Arrow pts={[560, 85, 600, 85, 600, 170, 630, 170]} color={arrow("s3", "orange")} />
        <Arrow pts={[560, 163, 600, 163]} noHead color={arrow("s3", "orange")} />
        <Arrow pts={[560, 239, 600, 239, 600, 170]} noHead color={arrow("s3", "orange")} />
        <Cylinder x={630} y={135} w={115} h={70} title="merged" sub={"one value per key\ntombstones applied"} accent={acc("s3", NEON.orange)} />
        <Label x={687} y={225} lines={"merge + compaction\nin the background"} size={10} mono color={on("s3") ? NEON.orange : "var(--ink-2)"} />

        {/* Read path */}
        <Box x={20} y={270} w={100} h={40} title="Read" accent={acc("read", NEON.green)} />
        <Arrow pts={[120, 290, 285, 290, 285, 120]} dashed color={arrow("read", "green")} />
        <Label x={200} y={278} lines="1 · memtable" size={10} mono color={on("read") ? NEON.green : "var(--ink-2)"} />
        <Arrow pts={[120, 300, 400, 300, 400, 102, 440, 102]} dashed color={arrow("read", "green")} />
        <Arrow pts={[400, 163, 440, 163]} dashed color={arrow("read", "green")} />
        <Arrow pts={[400, 239, 440, 239]} dashed color={arrow("read", "green")} />
        <Label x={400} y={318} lines="2 · segments, newest first" size={10} mono color={on("read") ? NEON.green : "var(--ink-2)"} anchor="middle" />
      </Canvas>
    </Figure>
  );
}
