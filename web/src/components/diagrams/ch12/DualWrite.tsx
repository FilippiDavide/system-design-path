"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Canvas, Label, INK, INK2, MONO, SANS } from "../primitives";

type Mode = "dual" | "cdc";

const PX = { c1: 90, db: 290, ix: 490, c2: 680 };
const STEPS = 5;

/** A small note box pinned on a lifeline. */
function Note({ x, y, text, color = INK, w = 76 }: { x: number; y: number; text: string; color?: string; w?: number }) {
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={22} fill="var(--surface-2)" stroke={color} strokeWidth={1.5} />
      <text x={x} y={y + 15} textAnchor="middle" fontFamily={MONO} fontSize={11} fontWeight={600} fill={color}>
        {text}
      </text>
    </g>
  );
}

/** Message arrow between two lifelines with its label above the line. */
function Msg({ from, to, y, text, color = "ink" }: { from: number; to: number; y: number; text: string; color?: "ink" | "magenta" | "blue" }) {
  return (
    <g>
      <Arrow pts={[from, y, to, y]} color={color} />
      {/* white backing so the label stays legible where it crosses a lifeline */}
      <rect x={(from + to) / 2 - (text.length * 6.8 + 10) / 2} y={y - 17} width={text.length * 6.8 + 10} height={15} fill="#fff" />
      <Label x={(from + to) / 2} y={y - 9} lines={text} size={11} mono color={color === "ink" ? INK : color === "blue" ? "var(--neon-1)" : "var(--neon-2)"} />
    </g>
  );
}

const EXPLAIN: Record<Mode, string[]> = {
  dual: [
    "Two clients update the same key X. The application writes to the database, then to the search index, with no coordination. Step through it.",
    "Client 1 writes X = A to the database.",
    "Client 2 writes X = B right after. The database now holds X = B: the last writer wins, which is fine.",
    "Client 2 goes on to the index and writes X = B there too.",
    "Client 1's request to the index was slower and arrives last: the index now holds X = A. Same two writes, opposite order.",
    "Database and index disagree, nobody got an error, and nothing will ever fix it: a race with no detection. Each store has its own leader, so this is multi-leader replication by accident.",
  ],
  cdc: [
    "Same two clients, but now only the database is written directly. The index follows the database's change log instead.",
    "Client 1 writes X = A to the database.",
    "Client 2 writes X = B. The database decides the order and appends both writes to its log, A then B.",
    "Change data capture ships the log in that order: the index applies X = A first (offset 0).",
    "Then X = B (offset 1). The index applies the writes in the same order the database chose.",
    "Database and index end up identical: the database is the leader, the index a follower. The race cannot happen because there is a single ordering.",
  ],
};

/**
 * The dual-write race, replayed one message at a time. A toggle shows
 * the same two writes routed through change data capture, where the
 * database's log imposes one order on every follower.
 */
export function DualWrite() {
  const [mode, setMode] = useState<Mode>("dual");
  const [step, setStep] = useState(0);
  const done = (k: number) => step >= k;

  const setM = (m: Mode) => {
    setMode(m);
    setStep(0);
  };

  return (
    <Figure
      label="FIG 03"
      title={mode === "dual" ? "dual writes: a race with no error" : "the same writes through CDC"}
      caption={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex gap-px border border-line w-fit">
            {(["dual", "cdc"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setM(m)}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {m === "dual" ? "Dual write" : "Via CDC"}
              </button>
            ))}
          </span>
          <span className="flex items-center gap-px border border-line-soft w-fit">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 font-dot text-sm">
              {step}/{STEPS}
            </span>
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS, s + 1))}
              disabled={step === STEPS}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Next
            </button>
          </span>
          <span className="basis-full">{EXPLAIN[mode][step]}</span>
        </div>
      }
    >
      <Canvas w={770} h={300}>
        {/* participants */}
        {(
          [
            [PX.c1, "Client 1", "wants X = A"],
            [PX.db, "Database", mode === "cdc" ? "leader of the log" : "its own leader"],
            [PX.ix, "Index", mode === "cdc" ? "follower of the log" : "its own leader"],
            [PX.c2, "Client 2", "wants X = B"],
          ] as [number, string, string][]
        ).map(([x, name, sub]) => (
          <g key={name}>
            <rect x={x - 62} y={16} width={124} height={44} fill="#fff" stroke={INK} strokeWidth={1.5} />
            <text x={x} y={34} textAnchor="middle" fontFamily={SANS} fontSize={13} fontWeight={600} fill={INK}>
              {name}
            </text>
            <text x={x} y={50} textAnchor="middle" fontFamily={MONO} fontSize={10} fill={INK2}>
              {sub}
            </text>
            <line x1={x} y1={60} x2={x} y2={284} stroke={INK2} strokeWidth={1} strokeDasharray="4 4" />
          </g>
        ))}

        {mode === "dual" ? (
          <>
            {done(1) && <Msg from={PX.c1} to={PX.db} y={92} text="X = A" color="blue" />}
            {done(2) && <Msg from={PX.c2} to={PX.db} y={122} text="X = B" color="magenta" />}
            {done(2) && <Note x={PX.db} y={138} text="X = B" color="var(--neon-2)" />}
            {done(3) && <Msg from={PX.c2} to={PX.ix} y={182} text="X = B" color="magenta" />}
            {done(4) && <Msg from={PX.c1} to={PX.ix} y={212} text="X = A" color="blue" />}
            {done(4) && <Note x={PX.ix} y={228} text="X = A" color="var(--neon-1)" />}
            {done(5) && (
              <g>
                <rect x={PX.db - 70} y={258} width={PX.ix - PX.db + 140} height={24} fill="#fff" stroke="var(--bad)" strokeWidth={1.5} />
                <text x={(PX.db + PX.ix) / 2} y={274} textAnchor="middle" fontFamily={MONO} fontSize={11} fontWeight={600} fill="var(--bad)">
                  inconsistent forever · no error raised
                </text>
              </g>
            )}
          </>
        ) : (
          <>
            {done(1) && <Msg from={PX.c1} to={PX.db} y={92} text="X = A" color="blue" />}
            {done(2) && <Msg from={PX.c2} to={PX.db} y={122} text="X = B" color="magenta" />}
            {done(2) && <Note x={PX.db} y={138} text="X = B" color="var(--neon-2)" />}
            {done(2) && (
              <text x={PX.db + 46} y={153} fontFamily={MONO} fontSize={10} fill={INK2}>
                log: 0 X=A · 1 X=B
              </text>
            )}
            {done(3) && <Msg from={PX.db} to={PX.ix} y={182} text="log offset 0 · X = A" color="blue" />}
            {done(4) && <Msg from={PX.db} to={PX.ix} y={212} text="log offset 1 · X = B" color="magenta" />}
            {done(4) && <Note x={PX.ix} y={228} text="X = B" color="var(--neon-2)" />}
            {done(5) && (
              <g>
                <rect x={PX.db - 70} y={258} width={PX.ix - PX.db + 140} height={24} fill="#fff" stroke="var(--ok)" strokeWidth={1.5} />
                <text x={(PX.db + PX.ix) / 2} y={274} textAnchor="middle" fontFamily={MONO} fontSize={11} fontWeight={600} fill="var(--ok)">
                  same order everywhere · consistent
                </text>
              </g>
            )}
          </>
        )}
      </Canvas>
    </Figure>
  );
}
