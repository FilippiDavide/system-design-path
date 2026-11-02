"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Canvas, Label, NEON } from "../primitives";

const ROOT = [100, 200, 300, 400, 500];
const PAGE = [210, 230, 250, 270, 290];

interface Step {
  title: string;
  text: string;
  level: number;
}

const STEPS: Step[] = [
  {
    title: "0 · start",
    text: "Looking up key 251. The database is a set of fixed-size pages (4 KiB classically); each page holds boundary keys and page numbers that act as pointers to its children.",
    level: 0,
  },
  {
    title: "1 · root",
    text: "Read the root page: 251 lies between 200 and 300, so follow that reference. The number of children per page is the branching factor, typically several hundred.",
    level: 1,
  },
  {
    title: "2 · interior",
    text: "Read the page for 200-300: 251 lies between 250 and 270. One page read per level; the tree is balanced, so every key is the same number of hops away.",
    level: 2,
  },
  {
    title: "3 · leaf",
    text: "The leaf holds the value (or a reference to it). Three or four levels cover almost any database: 4 levels of 4 KiB pages with branching factor 500 hold 250 TB.",
    level: 3,
  },
];

/** One page: a strip of cells with keys and pointer slots between them. */
function Page({
  x,
  y,
  keys,
  w,
  lit,
  litSlot,
  title,
}: {
  x: number;
  y: number;
  keys: number[];
  w: number;
  lit: boolean;
  litSlot?: number;
  title: string;
}) {
  const h = 34;
  const n = keys.length;
  const cell = w / n;
  return (
    <g>
      <Label x={x} y={y - 12} lines={title} size={10} mono upper color={lit ? NEON.blue : "var(--ink-2)"} anchor="start" />
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke={lit ? NEON.blue : "var(--ink)"} strokeWidth={lit ? 2 : 1.5} />
      {keys.map((k, i) => (
        <g key={k}>
          {i > 0 && <line x1={x + i * cell} y1={y} x2={x + i * cell} y2={y + h} stroke={lit ? NEON.blue : "var(--ink)"} strokeWidth={1} />}
          {litSlot === i && <rect x={x + i * cell + 1} y={y + 1} width={cell - 2} height={h - 2} fill="var(--surface-2)" />}
          <Label x={x + i * cell + cell / 2} y={y + h / 2} lines={String(k)} size={12} weight={600} mono color={litSlot === i ? NEON.blue : "var(--ink)"} />
        </g>
      ))}
    </g>
  );
}

/**
 * B-tree lookup as a three-hop walk: root, interior page, leaf. One
 * page read per level; the path lights up as the reader steps.
 */
export function BTreePages() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const L = step.level;

  // Geometry: root on top, the 200-300 page below, the leaf at the bottom.
  const rootX = 230;
  const rootW = 320;
  const pageX = 60;
  const pageW = 320;
  const leafX = 100;
  const leafW = 170;

  return (
    <Figure
      label="FIG 03"
      title="b-tree: one page per level"
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
            <span className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-surface">{step.title}</span>
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
        <Label x={660} y={48} lines={"find 251"} size={13} weight={600} mono color={L > 0 ? NEON.blue : "var(--ink)"} />
        <Label x={660} y={66} lines={"page reads: " + L} size={10} mono color="var(--ink-2)" />

        {/* Level 1: root */}
        <Page x={rootX} y={40} w={rootW} keys={ROOT} title="root page" lit={L >= 1} litSlot={L >= 1 ? 1 : undefined} />
        {/* Level 2: interior page 200-300 and its siblings */}
        <Arrow pts={[rootX + 96, 74, rootX + 96, 110, pageX + pageW / 2, 110, pageX + pageW / 2, 140]} color={L >= 2 ? "blue" : "ink"} label="200 ≤ k < 300" labelOffset={-10} />
        <Arrow pts={[rootX + 224, 74, rootX + 224, 110, 600, 110, 600, 140]} color="soft" />
        <Page x={pageX} y={140} w={pageW} keys={PAGE} title="page 200-300" lit={L >= 2} litSlot={L >= 2 ? 2 : undefined} />
        <rect x={520} y={140} width={160} height={34} fill="#fff" stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="4 3" />
        <Label x={600} y={157} lines="other pages …" size={11} mono color="var(--ink-2)" />

        {/* Level 3: leaf 250-270 */}
        <Arrow pts={[pageX + 160, 174, pageX + 160, 210, leafX + leafW / 2, 210, leafX + leafW / 2, 240]} color={L >= 3 ? "blue" : "ink"} label="250 ≤ k < 270" labelOffset={-10} />
        <Arrow pts={[pageX + 288, 174, pageX + 288, 210, 420, 210, 420, 240]} color="soft" />
        <g>
          <Label x={leafX} y={288} lines="leaf 250-270" size={10} mono upper color={L >= 3 ? NEON.blue : "var(--ink-2)"} anchor="start" />
          <rect x={leafX} y={240} width={leafW} height={34} fill="#fff" stroke={L >= 3 ? NEON.blue : "var(--ink)"} strokeWidth={L >= 3 ? 2 : 1.5} />
          <line x1={leafX + 50} y1={240} x2={leafX + 50} y2={274} stroke={L >= 3 ? NEON.blue : "var(--ink)"} strokeWidth={1} />
          <Label x={leafX + 25} y={257} lines="251" size={12} weight={600} mono color={L >= 3 ? NEON.blue : "var(--ink)"} />
          <Label x={leafX + 110} y={257} lines="→ value" size={11} mono color="var(--ink-2)" />
        </g>
        <rect x={340} y={240} width={160} height={34} fill="#fff" stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="4 3" />
        <Label x={420} y={257} lines="other leaves …" size={11} mono color="var(--ink-2)" />

        <Label x={390} y={314} lines={"depth O(log n) · a split rewrites a leaf and its parent, protected by the WAL"} size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}
