"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Group, Label, NEON } from "../primitives";

interface Stop {
  name: string;
  derived: string;
  writeWork: number;
  readWork: number;
  note: string;
}

/** Where the boundary between the two paths sits, for full-text search. */
const STOPS: Stop[] = [
  {
    name: "No index",
    derived: "nothing precomputed",
    writeWork: 1,
    readWork: 5,
    note: "Writes are free: the document is appended and nothing is derived. Every read is a grep over all documents.",
  },
  {
    name: "Index + query cache",
    derived: "inverted index\n+ common queries",
    writeWork: 3,
    readWork: 2,
    note: "Each write also updates the index and refreshes the cached answers it touches. A read is an index lookup; a popular query is served from the cache, which is a materialized view.",
  },
  {
    name: "Precompute everything",
    derived: "every possible answer",
    writeWork: 5,
    readWork: 1,
    note: "Reads are free, but there are infinitely many queries, so every write would have to recompute infinitely many answers: impossible.",
  },
];

/**
 * Write path and read path meeting at the derived dataset. The slider
 * moves the boundary between the two, with full-text search as the
 * example: the more you precompute, the more the write path does and
 * the less the read path has to.
 */
export function WriteReadPath() {
  const [i, setI] = useState(1);
  const s = STOPS[i];
  const writeHeavy = s.writeWork >= s.readWork;

  return (
    <Figure
      label="FIG 02"
      title="write path and read path"
      caption={
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">boundary</span>
              <input
                type="range"
                min={0}
                max={STOPS.length - 1}
                value={i}
                onChange={(e) => setI(Number(e.target.value))}
                aria-label="Where the derived dataset draws the boundary"
                className="w-40 accent-black"
              />
            </label>
            <span className="font-semibold text-ink">{s.name}</span>
            <span className="flex flex-wrap gap-x-5 gap-y-1">
              <Meter label="write-time work" value={s.writeWork} color="var(--neon-1)" />
              <Meter label="read-time work" value={s.readWork} color="var(--neon-3)" />
            </span>
          </div>
          <span className="block">{s.note}</span>
        </div>
      }
    >
      <Canvas w={780} h={310}>
        <Group x={10} y={30} w={440} h={120} label="write path · eager, whether anyone asks or not" color={NEON.blue} />
        <Group x={300} y={185} w={470} h={105} label="read path · lazy, on demand" color={NEON.green} />

        {/* Write path */}
        <Box x={20} y={65} w={80} h={50} title="Write" />
        <Arrow pts={[100, 90, 140, 90]} color={writeHeavy ? "blue" : "ink"} width={writeHeavy ? 2 : 1.5} />
        <Cylinder x={140} y={52} w={110} h={76} title="Event log" sub="append-only" />
        <Arrow pts={[250, 90, 290, 90]} color={writeHeavy ? "blue" : "ink"} width={writeHeavy ? 2 : 1.5} />
        <Box x={290} y={60} w={120} h={60} title="Stream" sub="processor" titleSize={12} />
        <Arrow pts={[410, 90, 505, 90]} color={writeHeavy ? "blue" : "ink"} width={writeHeavy ? 2 : 1.5} />

        {/* The meeting point */}
        <Cylinder x={505} y={48} w={160} h={104} title="Derived dataset" sub={s.derived} accent={NEON.magenta} />
        <Label x={585} y={30} lines="where the two paths meet" size={10} mono color="var(--ink-2)" />

        {/* Read path */}
        <Box x={465} y={210} w={130} h={50} title="User request" titleSize={12} />
        <Arrow pts={[530, 210, 530, 154]} color={writeHeavy ? "ink" : "green"} width={writeHeavy ? 1.5 : 2} />
        <Arrow pts={[640, 154, 640, 210]} color={writeHeavy ? "ink" : "green"} width={writeHeavy ? 1.5 : 2} />
        <Box x={625} y={210} w={130} h={50} title="Response" titleSize={12} />
        <Label x={380} y={235} lines={writeHeavy ? "read = cheap lookup" : "read = scan everything"} size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</span>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="w-4 h-2 border border-ink" style={{ background: n <= value ? color : "transparent" }} />
        ))}
      </span>
    </span>
  );
}
