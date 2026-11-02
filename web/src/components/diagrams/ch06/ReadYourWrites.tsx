"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Label, NEON } from "../primitives";

type Mode = "none" | "leader" | "timestamp";

const MODES: { key: Mode; label: string; title: string; note: string }[] = [
  {
    key: "none",
    label: "No guarantee",
    title: "the comment seems lost",
    note: "The write went to the leader, the page reload read a lagging follower: the user's own comment is missing and looks lost.",
  },
  {
    key: "leader",
    label: "Own data → leader",
    title: "read-after-write · route own data to the leader",
    note: "Anything the user may have modified themselves is read from the leader; everything else can still come from followers. Needs a way to know what is 'own' without querying.",
  },
  {
    key: "timestamp",
    label: "Timestamp",
    title: "read-after-write · wait for the write's position",
    note: "The client remembers the log position of its last write and the follower either has caught up to it or waits before answering. Works for any replica, but multiple devices must share that timestamp.",
  },
];

const U = 100;
const L = 380;
const F = 640;

/** A sequence-diagram participant: header box plus dashed lifeline. */
function Lifeline({ x, title, sub, h, accent }: { x: number; title: string; sub?: string; h: number; accent?: string }) {
  return (
    <g>
      <Box x={x - 70} y={16} w={140} h={44} title={title} sub={sub} titleSize={12} accent={accent} />
      <line x1={x} y1={60} x2={x} y2={h} stroke="var(--line-soft)" strokeWidth={1} strokeDasharray="4 4" />
    </g>
  );
}

/**
 * The read-your-writes anomaly as a sequence diagram, with a toggle
 * that applies each of the two fixes the chapter describes.
 */
export function ReadYourWrites() {
  const [mode, setMode] = useState<Mode>("none");
  const m = MODES.find((x) => x.key === mode)!;
  const H = 330;

  return (
    <Figure
      label="FIG 03"
      title={m.title}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {MODES.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setMode(x.key)}
                aria-pressed={mode === x.key}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  mode === x.key ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {x.label}
              </button>
            ))}
          </span>
          <span>{m.note}</span>
        </div>
      }
    >
      <Canvas w={760} h={H}>
        <Lifeline x={U} title="User" sub="browser" h={282} />
        <Lifeline x={L} title="Leader" sub="up to date" h={282} accent={NEON.blue} />
        <Lifeline x={F} title="Follower" sub="lagging" h={282} accent={NEON.orange} />
        <Label x={28} y={200} lines="time ↓" size={10} mono color="var(--ink-2)" />

        {/* 1. write */}
        <Arrow pts={[U, 92, L, 92]} label="write comment · pos 42" />
        {/* 2. ok */}
        <Arrow pts={[L, 120, U, 120]} dashed color="soft" label="ok" labelOffset={12} />
        {/* 3. replication, delayed: drawn diagonally */}
        {/* In timestamp mode the delayed replica stops at the wait bar, not on the green dot. */}
        <Arrow pts={mode === "timestamp" ? [L, 140, F - 7, 232] : [L, 140, F, 268]} dashed color="orange" />
        <Label x={520} y={150} lines="replicate (delayed)" size={10} mono color={NEON.orange} anchor="start" />

        {mode === "none" && (
          <>
            <Arrow pts={[U, 180, F, 180]} label="read comments" />
            <Arrow pts={[F, 212, U, 212]} dashed color="soft" label="the comment is not there" labelOffset={12} />
            <circle cx={F} cy={212} r={5} fill="var(--bad)" />
            <Label x={F + 12} y={268} lines="applied, too late" size={10} mono color={NEON.orange} anchor="start" />
            <Label x={U} y={306} lines={"user sees: 0 comments\nown write 'lost'"} size={10} mono color="var(--bad)" />
          </>
        )}

        {mode === "leader" && (
          <>
            <Arrow pts={[U, 180, L, 180]} color="blue" label="read own comments" />
            <Arrow pts={[L, 212, U, 212]} dashed color="blue" label="comment is there" labelOffset={12} />
            <circle cx={L} cy={212} r={5} fill="var(--ok)" />
            <Label x={F - 12} y={286} lines="still lagging, not asked" size={10} mono color="var(--ink-2)" anchor="end" />
            <Label x={U} y={306} lines={"user sees: 1 comment\nothers' data may still come\nfrom a follower"} size={10} mono color="var(--ok)" />
          </>
        )}

        {mode === "timestamp" && (
          <>
            <Arrow pts={[U, 180, F, 180]} color="blue" label="read · need pos ≥ 42" />
            <rect x={F - 5} y={180} width={10} height={60} fill="var(--surface-2)" stroke="var(--ink)" strokeWidth={1} />
            <Label x={F + 12} y={200} lines={"waits until\npos 42 applied"} size={10} mono color="var(--ink-2)" anchor="start" />
            <circle cx={F} cy={236} r={5} fill="var(--ok)" />
            <Arrow pts={[F, 262, U, 262]} dashed color="blue" label="comment is there" labelOffset={12} />
            <Label x={U} y={306} lines={"user sees: 1 comment\nslower, but any replica\ncan answer"} size={10} mono color="var(--ok)" />
          </>
        )}
      </Canvas>
    </Figure>
  );
}
