"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Box, Canvas, INK, INK2, Label, NEON, SOFT } from "../primitives";

const NX = 130;
const Q1X = 400;
const Q2X = 640;

interface Step {
  title: string;
  why: string;
}

const STEPS: Step[] = [
  {
    title: "nobody is leader",
    why: "The leader of epoch 4 has gone quiet. A node that suspects it is dead starts an election with a higher epoch number; there is no need for a leader to run the election.",
  },
  {
    title: "round one: ask for votes",
    why: "The candidate asks a quorum to vote for it in epoch 5. Anyone can start this round, and a majority is enough. In 2PC only the coordinator asks, and every participant must say yes.",
  },
  {
    title: "voters answer",
    why: "A node votes yes only if it knows of no epoch higher than 5. Raft also refuses a candidate whose log is behind the voter's, so the new leader already holds the committed entries.",
  },
  {
    title: "leader for epoch 5",
    why: "Not 'the only leader': the only leader of epoch 5. The old leader may still believe it leads epoch 4; the algorithm does not try to stop that, it makes it harmless.",
  },
  {
    title: "round two: propose an entry",
    why: "For every entry the leader asks a quorum to accept the append tagged with epoch 5, synchronously, before acknowledging the client.",
  },
  {
    title: "voters accept",
    why: "A voter accepts only if it has seen no epoch above 5. The two quorums overlap: at least one of these voters took part in the last election, so a newer epoch, if it existed, would surface in this reply.",
  },
  {
    title: "entry committed",
    why: "No higher epoch surfaced, so the leader knows it is still the leader and the entry is committed on a majority. A deposed leader fails exactly here, which is what prevents split brain and lost writes.",
  },
];

/**
 * FIG 04: the two rounds of voting that turn single-leader replication
 * into consensus. Step through election and proposal; the inset shows
 * why the two quorums must overlap.
 */
export function TwoRoundsVoting() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const on = (k: number) => step >= k;
  const col = (k: number) => (on(k) ? INK : SOFT);
  const lab = (k: number) => (on(k) ? INK2 : SOFT);

  return (
    <Figure
      label="FIG 04"
      title={`step ${step}/${STEPS.length - 1} · ${s.title}`}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            <button
              type="button"
              onClick={() => setStep((v) => Math.max(0, v - 1))}
              disabled={step === 0}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
              disabled={step === STEPS.length - 1}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-surface hover:bg-ink/80 disabled:opacity-40"
            >
              Next
            </button>
          </span>
          <span>{s.why}</span>
        </div>
      }
    >
      <Canvas w={760} h={360}>
        <Box x={NX - 75} y={14} w={150} h={40} title="Candidate node" titleSize={12} accent={on(3) ? NEON.blue : undefined} />
        <Box x={Q1X - 75} y={14} w={150} h={40} title="Quorum (election)" titleSize={12} accent={on(1) ? NEON.violet : undefined} />
        <Box x={Q2X - 75} y={14} w={150} h={40} title="Quorum (proposal)" titleSize={12} accent={on(4) ? NEON.green : undefined} />
        {[NX, Q1X, Q2X].map((x) => (
          <line key={x} x1={x} y1={54} x2={x} y2={296} stroke={INK2} strokeWidth={1} strokeDasharray="3 4" />
        ))}

        {/* 1: vote request */}
        <line x1={NX} y1={92} x2={Q1X - 6} y2={92} stroke={col(1)} strokeWidth={1.5} markerEnd={on(1) ? "url(#arrow-ink)" : "url(#arrow-soft)"} />
        <Label x={(NX + Q1X) / 2} y={82} lines="vote for me for epoch 5" size={10} mono color={lab(1)} />

        {/* 2: vote */}
        <line x1={Q1X} y1={126} x2={NX + 6} y2={126} stroke={col(2)} strokeWidth={1.5} strokeDasharray="5 4" markerEnd={on(2) ? "url(#arrow-ink)" : "url(#arrow-soft)"} />
        <Label x={(NX + Q1X) / 2} y={116} lines="yes (I know no epoch > 5)" size={10} mono color={lab(2)} />

        {/* 3: note */}
        <rect x={NX - 64} y={148} width={128} height={24} fill={on(3) ? "#fff" : "var(--surface-2)"} stroke={on(3) ? NEON.blue : SOFT} strokeWidth={1.5} />
        <Label x={NX} y={160} lines="leader for epoch 5" size={10} mono color={on(3) ? INK : SOFT} />

        {/* 4: append proposal */}
        <line x1={NX} y1={200} x2={Q2X - 6} y2={200} stroke={col(4)} strokeWidth={1.5} markerEnd={on(4) ? "url(#arrow-ink)" : "url(#arrow-soft)"} />
        <Label x={(NX + Q2X) / 2} y={190} lines="I append this entry, epoch 5" size={10} mono color={lab(4)} />

        {/* 5: accept */}
        <line x1={Q2X} y1={234} x2={NX + 6} y2={234} stroke={col(5)} strokeWidth={1.5} strokeDasharray="5 4" markerEnd={on(5) ? "url(#arrow-ink)" : "url(#arrow-soft)"} />
        <Label x={(NX + Q2X) / 2} y={224} lines="yes (no epoch > 5 seen)" size={10} mono color={lab(5)} />

        {/* 6: note */}
        <rect x={NX - 64} y={256} width={128} height={24} fill={on(6) ? "#fff" : "var(--surface-2)"} stroke={on(6) ? NEON.green : SOFT} strokeWidth={1.5} />
        <Label x={NX} y={268} lines="entry committed" size={10} mono color={on(6) ? INK : SOFT} />

        {/* inset: the quorums overlap */}
        <Label x={330} y={332} lines="5 nodes · both quorums share node 3" size={10} mono upper color={INK2} anchor="end" />
        {[1, 2, 3, 4, 5].map((n, i) => {
          const x = 380 + i * 48;
          const inQ1 = n <= 3;
          const inQ2 = n >= 3;
          return (
            <g key={n}>
              {inQ1 && <circle cx={x} cy={332} r={14} fill="none" stroke={on(1) ? NEON.violet : SOFT} strokeWidth={1.5} />}
              {inQ2 && <circle cx={x} cy={332} r={on(1) && inQ1 ? 18 : 14} fill="none" stroke={on(4) ? NEON.green : SOFT} strokeWidth={1.5} />}
              <circle cx={x} cy={332} r={6} fill={n === 3 && on(5) ? NEON.magenta : INK} />
              <Label x={x} y={332} lines={String(n)} size={9} mono color="#fff" weight={700} />
            </g>
          );
        })}
        <Label x={640} y={322} lines="election" size={10} mono color={on(1) ? NEON.violet : SOFT} anchor="start" />
        <Label x={640} y={342} lines="proposal" size={10} mono color={on(4) ? NEON.green : SOFT} anchor="start" />
      </Canvas>
    </Figure>
  );
}
