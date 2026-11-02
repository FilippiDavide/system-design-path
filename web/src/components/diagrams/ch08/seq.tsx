import type { ReactNode } from "react";
import { Arrow, Box, INK2, Label, SOFT } from "../primitives";

/**
 * Local vocabulary for the sequence diagrams of chapter 8: lifelines
 * with a head box, messages between lifelines and a Prev/Next stepper
 * for the caption. Messages that are "ahead" of the current step are
 * drawn soft and dashed so the reader sees what is still to come.
 */

export interface Lifeline {
  x: number;
  title: string;
  sub?: string;
  accent?: string;
}

/** Head boxes plus dashed vertical lines down to `bottom`. */
export function Lifelines({
  cols,
  top = 20,
  bottom,
  w = 130,
  h = 44,
}: {
  cols: Lifeline[];
  top?: number;
  bottom: number;
  w?: number;
  h?: number;
}) {
  return (
    <g>
      {cols.map((c) => (
        <g key={c.title}>
          <line x1={c.x} y1={top + h} x2={c.x} y2={bottom} stroke={SOFT} strokeWidth={1} strokeDasharray="3 3" />
          <Box x={c.x - w / 2} y={top} w={w} h={h} title={c.title} sub={c.sub} accent={c.accent} titleSize={12} />
        </g>
      ))}
    </g>
  );
}

/**
 * One horizontal message. `state` decides the look: `past` is ink,
 * `now` is drawn in a neon, `future` is soft and dashed.
 */
export function Msg({
  from,
  to,
  y,
  text,
  state = "past",
  color = "blue",
  reply = false,
  below = false,
  lx,
}: {
  from: number;
  to: number;
  y: number;
  text: string;
  state?: "past" | "now" | "future";
  color?: "blue" | "magenta" | "green" | "violet" | "orange";
  reply?: boolean;
  below?: boolean;
  /** Label x, when the midpoint of the arrow sits on another lifeline. */
  lx?: number;
}) {
  const future = state === "future";
  const c = state === "now" ? color : future ? "soft" : "ink";
  const dir = to > from ? 1 : -1;
  // Stop a few px short of the lifeline so the head does not sit on it.
  const x2 = to - dir * 3;
  return (
    <g opacity={future ? 0.55 : 1}>
      <Arrow pts={[from, y, x2, y]} color={c} dashed={reply || future} width={state === "now" ? 2 : 1.5} />
      <Label
        x={lx ?? (from + to) / 2}
        y={y + (below ? 12 : -10)}
        lines={text}
        size={10}
        mono
        color={state === "now" ? `var(--neon-${colorIndex(color)})` : INK2}
      />
    </g>
  );
}

function colorIndex(c: "blue" | "magenta" | "green" | "violet" | "orange"): number {
  return { blue: 1, magenta: 2, green: 3, violet: 4, orange: 5 }[c];
}

/** Prev / Next controls with a step counter, for a Figure caption. */
export function Stepper({
  step,
  total,
  onStep,
  children,
}: {
  step: number;
  total: number;
  onStep: (s: number) => void;
  children?: ReactNode;
}) {
  const btn = "px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="flex items-center gap-px border border-line w-fit">
        <button type="button" className={btn} onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0}>
          Prev
        </button>
        <span className="font-dot text-sm font-bold px-2 border-x border-line-soft min-w-[4.5rem] text-center">
          {step}/{total}
        </span>
        <button type="button" className={btn} onClick={() => onStep(Math.min(total, step + 1))} disabled={step === total}>
          Next
        </button>
      </span>
      {children}
    </div>
  );
}

/** Two-way toggle styled like the ETL/ELT switch in chapter 1. */
export function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <span className="flex gap-px border border-line w-fit">
      {options.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={m === value}
          className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
            m === value ? "bg-ink text-surface" : "hover:bg-surface-2"
          }`}
        >
          {m}
        </button>
      ))}
    </span>
  );
}
