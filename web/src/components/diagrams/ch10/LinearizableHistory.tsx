"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Canvas, INK, INK2, Label, NEON, SOFT } from "../primitives";

type Lane = "C" | "A" | "B";

interface Op {
  id: string;
  lane: Lane;
  start: number;
  end: number;
  /** Label while the rules are shown. */
  rule: string;
  /** Label once one concrete history is chosen. */
  chosen: string;
  /** Linearization point of the chosen history. */
  point: number;
  why: string;
}

const OPS: Op[] = [
  {
    id: "w",
    lane: "C",
    start: 2,
    end: 6,
    rule: "write x = 1",
    chosen: "write x = 1",
    point: 3.3,
    why: "The write is a bar too: somewhere between the request and the response the value flips from 0 to 1, atomically. The client never learns when.",
  },
  {
    id: "a1",
    lane: "A",
    start: 0,
    end: 1,
    rule: "read → 0",
    chosen: "read → 0",
    point: 0.5,
    why: "This read finished before the write started, so it must return the old value 0. Anything else would be a read from the future.",
  },
  {
    id: "a2",
    lane: "A",
    start: 3,
    end: 4,
    rule: "read → 0 or 1",
    chosen: "read → 1",
    point: 3.6,
    why: "Concurrent with the write: 0 or 1 are both allowed. But once this read has returned 1, every read that starts afterwards, on any client, must return 1 as well.",
  },
  {
    id: "a3",
    lane: "A",
    start: 7,
    end: 8,
    rule: "read → 1 (required)",
    chosen: "read → 1",
    point: 7.5,
    why: "Started after the write completed: 1 is the only legal answer. This is Bryce's refresh; a lagging replica returning 0 here breaks linearizability.",
  },
  {
    id: "b1",
    lane: "B",
    start: 2,
    end: 5,
    rule: "read → 0 or 1",
    chosen: "read → 0",
    point: 2.6,
    why: "Concurrent with the write, so 0 is fine, but only because its linearization point can sit before the write's. If this read had started after A's read at 3–4 returned 1, a 0 would be illegal.",
  },
];

const LANE_Y: Record<Lane, number> = { C: 60, A: 120, B: 180 };
const X0 = 80;
const UNIT = 68;
const tx = (t: number) => X0 + t * UNIT;

/**
 * FIG 02: the register timeline. Every request is a bar from send to
 * response; the rules say which reads are constrained. The second mode
 * draws one valid history: a point in each bar, joined by a line that
 * must always move forward in time.
 */
export function LinearizableHistory() {
  const [history, setHistory] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const info = OPS.find((o) => o.id === active);
  const ordered = [...OPS].sort((a, b) => a.point - b.point);

  return (
    <Figure
      label="FIG 02"
      title={history ? "one valid history: points always move forward" : "the rules for reads around one write"}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {(["rules", "history"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setHistory(m === "history")}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  (m === "history") === history ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {m}
              </button>
            ))}
          </span>
          <span>
            {info
              ? info.why
              : history
                ? "Mark one instant inside every bar and join them in order: the line never goes back in time, and each read returns the latest write before its point. Tap a bar for its rule."
                : "Tap a bar. The database processed each request at some unknown instant between send and response; linearizability constrains which values the reads may return."}
          </span>
        </div>
      }
    >
      <Canvas w={760} h={240}>
        {/* time axis */}
        {Array.from({ length: 10 }, (_, t) => (
          <g key={t}>
            <line x1={tx(t)} y1={34} x2={tx(t)} y2={208} stroke={SOFT} strokeWidth={1} strokeDasharray="2 4" />
            <Label x={tx(t)} y={222} lines={String(t)} size={10} mono color={INK2} />
          </g>
        ))}
        <line x1={X0 - 10} y1={208} x2={tx(9) + 20} y2={208} stroke={INK} strokeWidth={1.5} markerEnd="url(#arrow-ink)" />
        <Label x={tx(9) + 20} y={196} lines="time" size={10} mono color={INK2} anchor="end" />

        {(["C", "A", "B"] as Lane[]).map((l) => (
          <Label key={l} x={40} y={LANE_Y[l]} lines={`client ${l}`} size={10} mono upper color={INK2} />
        ))}

        {OPS.map((o) => {
          const isActive = active === o.id;
          const isWrite = o.id === "w";
          const x = tx(o.start);
          const w = tx(o.end) - x;
          const y = LANE_Y[o.lane] - 13;
          const stroke = isActive ? NEON.magenta : isWrite ? NEON.blue : INK;
          return (
            <g key={o.id} onClick={() => setActive(isActive ? null : o.id)} style={{ cursor: "pointer" }}>
              <rect
                x={x}
                y={y}
                width={w}
                height={26}
                fill={isWrite ? "var(--surface-2)" : "#fff"}
                stroke={stroke}
                strokeWidth={isActive || isWrite ? 2 : 1.5}
              />
            </g>
          );
        })}

        {history && (
          <polyline
            pointerEvents="none"
            points={ordered.map((o) => `${tx(o.point)},${LANE_Y[o.lane] + 6}`).join(" ")}
            fill="none"
            stroke={NEON.green}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        {/* Labels after the history line, on a white backing, so the line never runs through text.
            Narrow bars get their label above, so nothing is clipped. */}
        {OPS.map((o) => {
          const isActive = active === o.id;
          const x = tx(o.start);
          const w = tx(o.end) - x;
          const y = LANE_Y[o.lane] - 13;
          const text = history ? o.chosen : o.rule;
          const lx = x + w / 2;
          const ly = w < 90 ? y - 9 : history ? y + 8 : y + 13;
          const tw = text.length * 6.2 + 6;
          return (
            <g key={`l${o.id}`} onClick={() => setActive(isActive ? null : o.id)} style={{ cursor: "pointer" }}>
              <rect x={lx - tw / 2} y={ly - 6} width={tw} height={12} fill={o.id === "w" && w >= 90 ? "var(--surface-2)" : "#fff"} />
              <Label x={lx} y={ly} lines={text} size={10} mono color={isActive ? NEON.magenta : INK} />
            </g>
          );
        })}

        {history &&
          ordered.map((o) => (
            <circle key={o.id} pointerEvents="none" cx={tx(o.point)} cy={LANE_Y[o.lane] + 6} r={4.5} fill={NEON.green} stroke="#fff" strokeWidth={1.5} />
          ))}
      </Canvas>
    </Figure>
  );
}
