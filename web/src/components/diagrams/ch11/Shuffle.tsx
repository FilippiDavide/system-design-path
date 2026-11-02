"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Group, Label, NEON, INK2 } from "../primitives";

type Sel = { kind: "m" | "r"; i: number } | null;

const ROW_Y = [44, 134, 224];
const CHANNEL_X = [340, 380, 420];
const FILE_X = 150;
const FILE_W = 120;
const FILE_H = 16;
const RED_X = 540;

/**
 * The shuffle between 3 mappers and 3 reducers. Every mapper writes one
 * sorted local file per reducer (picked by hash(key) mod R); every
 * reducer copies its slice from all mappers and merges them. Tap a
 * mapper or a reducer to follow its 3 files.
 */
export function Shuffle() {
  const [sel, setSel] = useState<Sel>(null);
  const toggle = (next: Sel) => setSel((cur) => (cur && next && cur.kind === next.kind && cur.i === next.i ? null : next));

  const lit = (m: number, r: number): boolean =>
    sel !== null && ((sel.kind === "m" && sel.i === m) || (sel.kind === "r" && sel.i === r));
  const color = sel?.kind === "m" ? "blue" : "magenta";
  const accent = sel?.kind === "m" ? NEON.blue : NEON.magenta;

  const pairs: [number, number][] = [];
  for (let m = 0; m < 3; m++) for (let r = 0; r < 3; r++) pairs.push([m, r]);
  const dim = pairs.filter(([m, r]) => !lit(m, r));
  const bright = pairs.filter(([m, r]) => lit(m, r));

  const caption =
    sel === null ? (
      <span>
        Tap a mapper or a reducer. Nothing random here: every mapper writes <strong>one local file per reducer</strong>,
        chosen by <code>hash(key) mod 3</code>, with the pairs sorted inside; every reducer copies its slice from all the
        mappers and merges them, so equal keys end up adjacent in one place.
      </span>
    ) : sel.kind === "m" ? (
      <span>
        <strong>Mapper m{sel.i + 1}</strong> emits (key, value) pairs from its input shard and splits them into three local
        files, one per reducer, by <code>hash(key) mod 3</code>. Each file is sorted by key with the LSM technique: in
        memory, then segments on disk, then a merge. Same key, same hash, same reducer, whichever mapper saw it.
      </span>
    ) : (
      <span>
        <strong>Reducer r{sel.i + 1}</strong> waits until the mappers are done, copies file (m<sub>i</sub>, r{sel.i + 1}) from
        each of them and merges the three sorted files mergesort-style. Equal keys are now adjacent, so <code>reduce()</code> is
        called once per key with an iterator over its values. Its output is one file: shard {sel.i + 1} of the result, on the DFS.
      </span>
    );

  const fileBox = (m: number, r: number) => {
    const y = ROW_Y[m] + 2 + r * (FILE_H + 2);
    const on = lit(m, r);
    return (
      <g key={`f${m}${r}`}>
        <rect
          x={FILE_X}
          y={y}
          width={FILE_W}
          height={FILE_H}
          fill={on ? "var(--surface-2)" : "#fff"}
          stroke={on ? accent : INK2}
          strokeWidth={on ? 1.5 : 1}
        />
        <Label x={FILE_X + FILE_W / 2} y={y + FILE_H / 2 + 0.5} lines={`m${m + 1},r${r + 1} · sorted`} size={10} mono color={on ? accent : INK2} />
      </g>
    );
  };

  const arrow = (m: number, r: number, on: boolean) => {
    const fy = ROW_Y[m] + 2 + r * (FILE_H + 2) + FILE_H / 2;
    const ty = ROW_Y[r] + 16 + m * 12;
    const cx = CHANNEL_X[r];
    return (
      <Arrow
        key={`a${m}${r}`}
        pts={[FILE_X + FILE_W, fy, cx, fy, cx, ty, RED_X, ty]}
        color={on ? color : "soft"}
        width={on ? 2 : 1}
      />
    );
  };

  return (
    <Figure label="FIG 03" title="the shuffle · hash, sort, copy, merge" caption={caption}>
      <Canvas w={780} h={330}>
        <Group x={20} y={30} w={280} h={280} label="map side · one task per input shard" />
        <Group x={480} y={30} w={280} h={280} label="reduce side · as many as you choose" />

        {dim.map(([m, r]) => arrow(m, r, false))}
        {bright.map(([m, r]) => arrow(m, r, true))}

        {ROW_Y.map((y, m) => {
          const on = sel?.kind === "m" && sel.i === m;
          return (
            <g key={`m${m}`} onClick={() => toggle({ kind: "m", i: m })} style={{ cursor: "pointer" }}>
              <Box x={40} y={y} w={90} h={56} title={`m${m + 1}`} sub={on ? "hash(key)\nmod 3" : "map()"} accent={on ? NEON.blue : undefined} />
              {[0, 1, 2].map((r) => fileBox(m, r))}
            </g>
          );
        })}

        {ROW_Y.map((y, r) => {
          const on = sel?.kind === "r" && sel.i === r;
          return (
            <g key={`r${r}`} onClick={() => toggle({ kind: "r", i: r })} style={{ cursor: "pointer" }}>
              <Box x={RED_X} y={y} w={110} h={56} title={`r${r + 1}`} sub={on ? "copy, merge\nreduce()" : "reduce()"} accent={on ? NEON.magenta : undefined} titleSize={13} />
              <Arrow pts={[RED_X + 110, y + 28, 690, y + 28]} color={on ? "magenta" : "ink"} width={on ? 2 : 1.5} />
              <rect x={690} y={y + 18} width={56} height={20} fill="#fff" stroke={on ? NEON.magenta : INK2} strokeWidth={on ? 1.5 : 1} />
              <Label x={718} y={y + 28.5} lines={`part-${r + 1}`} size={10} mono color={on ? NEON.magenta : INK2} />
            </g>
          );
        })}

        <Label x={380} y={300} lines={"3 × 3 files cross the network\nonce the mappers are done"} size={10} mono color={INK2} />
        <Label x={718} y={300} lines={"output shards\non the DFS"} size={10} mono color={INK2} />
      </Canvas>
    </Figure>
  );
}
