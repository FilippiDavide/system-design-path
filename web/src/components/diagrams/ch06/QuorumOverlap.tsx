"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Label, NEON } from "../primitives";

const NODE_W = 90;
const GAP = 130;

/**
 * Quorum overlap. n replicas in a row; a write is confirmed by the
 * first w of them, a read waits for the last r. Sliders move w and r
 * and the overlap (the nodes in both sets) is highlighted, or vanishes
 * when w + r ≤ n.
 */
export function QuorumOverlap() {
  const [n, setN] = useState<3 | 5>(5);
  const [w, setW] = useState(3);
  const [r, setR] = useState(3);

  const overlap = Math.max(0, w + r - n);
  const safe = w + r > n;
  const total = (n - 1) * GAP + NODE_W;
  const x0 = (760 - total) / 2;
  const cx = (i: number) => x0 + i * GAP + NODE_W / 2;

  const pickN = (v: 3 | 5) => {
    setN(v);
    setW((x) => Math.min(x, v));
    setR((x) => Math.min(x, v));
  };

  return (
    <Figure
      label="FIG 04"
      title={`quorum · w + r = ${w + r} ${safe ? ">" : "≤"} n = ${n}`}
      caption={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="flex gap-px border border-line w-fit">
            {([3, 5] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => pickN(v)}
                aria-pressed={n === v}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  n === v ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                n = {v}
              </button>
            ))}
          </span>
          <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
            w
            <input type="range" min={1} max={n} value={w} onChange={(e) => setW(Number(e.target.value))} className="w-20 accent-black" aria-label="write quorum w" />
            <span className="font-dot text-sm w-4">{w}</span>
          </label>
          <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
            r
            <input type="range" min={1} max={n} value={r} onChange={(e) => setR(Number(e.target.value))} className="w-20 accent-black" aria-label="read quorum r" />
            <span className="font-dot text-sm w-4">{r}</span>
          </label>
          <span className="basis-full sm:basis-auto sm:flex-1">
            {safe
              ? `The two sets share ${overlap} node${overlap > 1 ? "s" : ""}: whichever r nodes answer, at least one of them confirmed the latest write. Requests still go to all ${n} nodes; w and r only say how many to wait for.`
              : "The sets can miss each other: a read may be answered only by nodes that never confirmed the write and return the old value. Lower latency and higher availability, more stale reads."}
          </span>
        </div>
      }
    >
      <Canvas w={760} h={300}>
        <Box
          x={40}
          y={20}
          w={170}
          h={50}
          title={`write · w = ${w}`}
          sub={w === 1 ? "node 1 confirms" : `nodes 1–${w} confirm`}
          titleSize={12}
          accent={NEON.green}
        />
        <Box
          x={550}
          y={230}
          w={170}
          h={50}
          title={`read · r = ${r}`}
          sub={r === 1 ? `node ${n} answers` : `nodes ${n - r + 1}–${n} answer`}
          titleSize={12}
          accent={NEON.magenta}
        />

        {/* write bus */}
        <Arrow pts={[125, 70, 125, 95, cx(w - 1), 95]} color="green" noHead dashed />
        {Array.from({ length: n }, (_, i) => i).map((i) =>
          i < w ? <Arrow key={`w${i}`} pts={[cx(i), 95, cx(i), 120]} color="green" dashed /> : null,
        )}
        {/* read bus */}
        <Arrow pts={[635, 230, 635, 205, cx(n - r), 205]} color="magenta" noHead dashed />
        {Array.from({ length: n }, (_, i) => i).map((i) =>
          i >= n - r ? <Arrow key={`r${i}`} pts={[cx(i), 205, cx(i), 180]} color="magenta" dashed /> : null,
        )}

        {Array.from({ length: n }, (_, i) => i).map((i) => {
          const inW = i < w;
          const inR = i >= n - r;
          const both = inW && inR;
          return (
            <Cylinder
              key={i}
              x={cx(i) - NODE_W / 2}
              y={120}
              w={NODE_W}
              h={60}
              title={String(i + 1)}
              sub={inW ? "v2 · new" : "v1 · old"}
              accent={both ? NEON.blue : inW ? NEON.green : inR ? NEON.magenta : undefined}
            />
          );
        })}

        {safe ? (
          <Label
            x={300}
            y={292}
            lines={`in both sets: ${Array.from({ length: n }, (_, i) => i).filter((i) => i < w && i >= n - r).map((i) => i + 1).join(", ")} · reads survive ${n - r} down, writes ${n - w}`}
            size={10}
            mono
            color={NEON.blue}
          />
        ) : (
          <Label x={300} y={292} lines="no node is in both sets: a read can return v1 after v2 was confirmed" size={10} mono color="var(--bad)" />
        )}
      </Canvas>
    </Figure>
  );
}
