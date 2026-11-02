"use client";

import { useState } from "react";
import { Canvas, INK, INK2, Label, NEON, SOFT } from "@/components/diagrams/primitives";

type Lane = "A" | "B" | "C";

interface Op {
  id: string;
  lane: Lane;
  kind: "read" | "write";
  start: number;
  end: number;
  value: number;
}

const MAX_T = 10;

const TEXTBOOK: Op[] = [
  { id: "w", lane: "C", kind: "write", start: 2, end: 6, value: 1 },
  { id: "a1", lane: "A", kind: "read", start: 0, end: 1, value: 0 },
  { id: "a2", lane: "A", kind: "read", start: 3, end: 4, value: 1 },
  { id: "a3", lane: "A", kind: "read", start: 7, end: 8, value: 1 },
  { id: "b1", lane: "B", kind: "read", start: 2, end: 5, value: 0 },
];

const PRESETS: { key: string; label: string; ops: Op[] }[] = [
  { key: "textbook", label: "textbook", ops: TEXTBOOK },
  {
    key: "stale",
    label: "Bryce's stale read",
    ops: TEXTBOOK.map((o) => (o.id === "a3" ? { ...o, value: 0 } : o)),
  },
  {
    key: "flip",
    label: "flip-flop",
    ops: TEXTBOOK.map((o) => (o.id === "b1" ? { ...o, start: 5, end: 6, value: 0 } : o)),
  },
];

/** True when `a` completed before `b` started (real-time order). */
const before = (a: Op, b: Op) => a.end <= b.start;

/**
 * Search for a sequential order of `ops` that respects real-time order
 * and register semantics (a read returns the latest preceding write,
 * initially 0). Returns the order or null.
 */
function linearize(ops: Op[]): Op[] | null {
  const n = ops.length;
  const used = new Array<boolean>(n).fill(false);
  const order: Op[] = [];

  const dfs = (value: number): boolean => {
    if (order.length === n) return true;
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const o = ops[i];
      // Every still-pending op that finished before `o` started must go first.
      const blocked = ops.some((p, j) => !used[j] && j !== i && before(p, o));
      if (blocked) continue;
      if (o.kind === "read" && o.value !== value) continue;
      used[i] = true;
      order.push(o);
      if (dfs(o.kind === "write" ? o.value : value)) return true;
      order.pop();
      used[i] = false;
    }
    return false;
  };
  return dfs(0) ? [...order] : null;
}

/** First op (by start time) whose arrival makes the history non-linearizable. */
function culprit(ops: Op[]): Op | null {
  const sorted = [...ops].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let k = 1; k <= sorted.length; k++) {
    if (!linearize(sorted.slice(0, k))) return sorted[k - 1];
  }
  return null;
}

/** Place one point inside each bar so that the order is drawn left to right. */
function points(order: Op[]): number[] {
  const out: number[] = [];
  let t = -1;
  for (const o of order) {
    t = Math.min(o.end - 0.1, Math.max(o.start + 0.1, t + 0.3));
    out.push(t);
  }
  return out;
}

const LANE_Y: Record<Lane, number> = { C: 58, A: 112, B: 166 };
const X0 = 76;
const UNIT = 62;
const tx = (t: number) => X0 + t * UNIT;

/**
 * Where to put the "no valid order" note of a bad operation: below its
 * bar, unless that is the bottom lane or a bar in the lane below
 * overlaps it in time, in which case it goes above (clear of the bar's
 * own label when the bar is narrow).
 */
function verdictY(o: Op, all: Op[], w: number): number {
  const y = LANE_Y[o.lane] - 13;
  const below: Lane | null = o.lane === "C" ? "A" : o.lane === "A" ? "B" : null;
  const clash = below === null || all.some((p) => p.lane === below && p.start < o.end + 1 && p.end > o.start - 1);
  return clash ? y - (w < 70 ? 21 : 9) : y + 38;
}

/**
 * Linearizability checker. One write and four reads on a register;
 * the reader shifts bars in time and flips what a read returned, and
 * the verdict says whether some valid history exists.
 */
export function LinearizabilityLab() {
  const [ops, setOps] = useState<Op[]>(TEXTBOOK);
  const [preset, setPreset] = useState("textbook");

  const order = linearize(ops);
  const bad = order ? null : culprit(ops);
  const pts = order ? points(order) : [];

  const shift = (id: string, d: number) =>
    setOps((cur) =>
      cur.map((o) => {
        if (o.id !== id) return o;
        const s = o.start + d;
        const e = o.end + d;
        return s < 0 || e > MAX_T ? o : { ...o, start: s, end: e };
      }),
    );
  const flip = (id: string) => setOps((cur) => cur.map((o) => (o.id === id ? { ...o, value: o.value ? 0 : 1 } : o)));
  const load = (key: string) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setPreset(key);
    setOps(p.ops);
  };

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-ink-2 mr-1">preset</span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => load(p.key)}
            aria-pressed={preset === p.key}
            className={`px-3 py-1.5 border ${preset === p.key ? "border-ink bg-ink text-surface" : "border-line-soft hover:border-ink"}`}
          >
            {p.label}
          </button>
        ))}
        <span
          className={`ml-auto px-3 py-1.5 border font-bold ${
            order ? "border-ok text-ok" : "border-bad text-bad"
          }`}
          role="status"
        >
          {order ? "linearizable" : "not linearizable"}
        </span>
      </div>

      <div className="p-3 bg-grid overflow-x-auto">
        <Canvas w={740} h={220}>
          {Array.from({ length: MAX_T + 1 }, (_, t) => (
            <g key={t}>
              <line x1={tx(t)} y1={34} x2={tx(t)} y2={192} stroke={SOFT} strokeWidth={1} strokeDasharray="2 4" />
              <Label x={tx(t)} y={206} lines={String(t)} size={10} mono color={INK2} />
            </g>
          ))}
          <line x1={X0 - 8} y1={192} x2={tx(MAX_T) + 16} y2={192} stroke={INK} strokeWidth={1.5} markerEnd="url(#arrow-ink)" />
          {(["C", "A", "B"] as Lane[]).map((l) => (
            <Label key={l} x={38} y={LANE_Y[l]} lines={`client ${l}`} size={10} mono upper color={INK2} />
          ))}

          {/* The history line goes under the bars and labels so it never runs through text. */}
          {order && (
            <polyline
              pointerEvents="none"
              points={order.map((o, i) => `${tx(pts[i])},${LANE_Y[o.lane] + 6}`).join(" ")}
              fill="none"
              stroke={NEON.green}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}

          {ops.map((o) => {
            const x = tx(o.start);
            const w = tx(o.end) - x;
            const y = LANE_Y[o.lane] - 13;
            const isBad = bad?.id === o.id;
            const stroke = isBad ? "var(--bad)" : o.kind === "write" ? NEON.blue : INK;
            const text = o.kind === "write" ? `write x=${o.value}` : `read → ${o.value}`;
            return (
              <g key={o.id}>
                <rect x={x} y={y} width={w} height={26} fill={o.kind === "write" ? "var(--surface-2)" : "#fff"} stroke={stroke} strokeWidth={isBad || o.kind === "write" ? 2 : 1.5} />
                {/* Narrow bars get their label above, on a white backing; points sit in the lower half of the bar. */}
                {w < 70 && <rect x={x + w / 2 - (text.length * 6.2 + 6) / 2} y={y - 15} width={text.length * 6.2 + 6} height={12} fill="#fff" />}
                <Label
                  x={x + w / 2}
                  y={w < 70 ? y - 9 : y + 8}
                  lines={o.kind === "write" ? `write x=${o.value}` : `read → ${o.value}`}
                  size={10}
                  mono
                  color={isBad ? "var(--bad)" : INK}
                />
                {isBad && (
                  <Label x={x + w / 2} y={verdictY(o, ops, w)} lines="no valid order from here" size={10} mono color="var(--bad)" />
                )}
              </g>
            );
          })}

          {order &&
            order.map((o, i) => (
              <circle key={o.id} pointerEvents="none" cx={tx(pts[i])} cy={LANE_Y[o.lane] + 6} r={4.5} fill={NEON.green} stroke="#fff" strokeWidth={1.5} />
            ))}
        </Canvas>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">operations · shift in time, flip the result</p>
          <ul className="space-y-1 font-mono text-[11px]">
            {ops.map((o) => (
              <li key={o.id} className={`flex items-center gap-2 ${bad?.id === o.id ? "text-bad" : ""}`}>
                <span className="w-24">
                  {o.lane} · {o.kind === "write" ? `write x=${o.value}` : `read → ${o.value}`}
                </span>
                <span className="w-12 text-ink-2">
                  [{o.start}, {o.end}]
                </span>
                <button type="button" onClick={() => shift(o.id, -1)} aria-label={`shift ${o.id} earlier`} className="border border-line-soft px-2 py-0.5 hover:border-ink">
                  ◀
                </button>
                <button type="button" onClick={() => shift(o.id, 1)} aria-label={`shift ${o.id} later`} className="border border-line-soft px-2 py-0.5 hover:border-ink">
                  ▶
                </button>
                {o.kind === "read" && (
                  <button type="button" onClick={() => flip(o.id)} className="border border-line-soft px-2 py-0.5 hover:border-ink uppercase tracking-[0.1em]">
                    returns {o.value ? 0 : 1}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">verdict</p>
          {order ? (
            <p className="text-[12px] leading-relaxed">
              A valid sequential history exists:{" "}
              <span className="font-mono">
                {order.map((o) => (o.kind === "write" ? `W(${o.value})` : `R→${o.value}`)).join(" · ")}
              </span>
              . The green points are one choice of instants, one per bar, that moves forward in time and returns the latest
              write before each read.
            </p>
          ) : (
            <p className="text-[12px] leading-relaxed">
              No order of the operations both respects real time and explains every value.{" "}
              {bad &&
                (bad.kind === "read"
                  ? `The read on client ${bad.lane} at [${bad.start}, ${bad.end}] returning ${bad.value} is where it breaks: every earlier-finishing operation must precede it, and with that prefix the register cannot hold ${bad.value} at any instant inside its bar.`
                  : `The write at [${bad.start}, ${bad.end}] cannot be placed after the reads that already saw its value.`)}
            </p>
          )}
        </div>
      </div>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        The checker does what the book describes: mark a point inside every bar and join them in sequence, the line must
        always move forward and the register must behave as a single copy. Stale read: a read that starts after the write
        finished must see 1. Flip-flop: once any read has seen 1, a later read cannot see 0, even on another client and even
        while the write is still in flight. Checking recorded timings like this is possible but expensive.
      </p>
    </div>
  );
}
