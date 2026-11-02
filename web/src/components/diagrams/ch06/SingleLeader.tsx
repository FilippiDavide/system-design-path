"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Label, MONO, NEON } from "../primitives";

interface Step {
  title: string;
  note: string;
}

const STEPS: Step[] = [
  {
    title: "all writes go to the leader",
    note: "Clients send every write to the one replica that is the leader (primary, source). Followers never accept writes from clients.",
  },
  {
    title: "the leader ships its replication log",
    note: "The leader applies the write locally, appends it to its replication log and sends that log to every follower, synchronously or asynchronously.",
  },
  {
    title: "followers apply changes in the same order",
    note: "Each follower (read replica, secondary, hot standby) replays the log in the leader's order, so it ends up with the same state as the leader.",
  },
  {
    title: "reads can go anywhere",
    note: "Reads may be served by the leader or by any follower. A follower that has not caught up yet answers with stale data: that is replication lag.",
  },
];

/** Three small log entries drawn under a replica. */
function LogChips({ x, y, count, accent }: { x: number; y: number; count: number; accent?: string }) {
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const filled = i < count;
        return (
          <g key={i}>
            <rect
              x={x + i * 32}
              y={y}
              width={28}
              height={16}
              fill={filled ? "#fff" : "var(--surface-2)"}
              stroke={filled ? (accent ?? "var(--ink)") : "var(--line-soft)"}
              strokeWidth={filled && accent ? 2 : 1}
            />
            <text
              x={x + i * 32 + 14}
              y={y + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={MONO}
              fontSize={10}
              fill={filled ? "var(--ink)" : "var(--ink-3)"}
            >
              w{i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * Single-leader replication as a four-step walkthrough: the write
 * path, the log shipped to the followers, the followers applying it in
 * order, and reads that may be served by any replica.
 */
export function SingleLeader() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const writeOn = step === 0;
  const shipOn = step === 1;
  const applyOn = step === 2;
  const readOn = step === 3;

  return (
    <Figure
      label="FIG 02"
      title={`single-leader · ${s.title}`}
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
            <span className="px-3 py-1 font-dot text-sm border-x border-line">
              {step + 1}/{STEPS.length}
            </span>
            <button
              type="button"
              onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
              disabled={step === STEPS.length - 1}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Next
            </button>
          </span>
          <span>{s.note}</span>
        </div>
      }
    >
      <Canvas w={780} h={326}>
        <Box x={30} y={120} w={110} h={56} title="Client" sub="app server" />

        {/* write path */}
        <Arrow pts={[140, 136, 300, 136]} color={writeOn ? "blue" : "ink"} width={writeOn ? 2.5 : 1.5} label="writes" />
        <Cylinder x={300} y={100} w={140} h={96} title="Leader" sub="accepts writes" accent={writeOn || shipOn ? NEON.blue : undefined} />
        <LogChips x={320} y={206} count={step >= 1 ? 3 : 0} accent={shipOn ? NEON.blue : undefined} />
        <Label x={370} y={232} lines="replication log" size={10} mono color="var(--ink-2)" />

        {/* log shipping */}
        <Arrow
          pts={[440, 130, 520, 130, 520, 59, 600, 59]}
          color={shipOn ? "blue" : "ink"}
          width={shipOn ? 2.5 : 1.5}
          label={shipOn ? "log" : undefined}
          labelOffset={-10}
        />
        <Arrow
          pts={[440, 166, 520, 166, 520, 235, 600, 235]}
          color={shipOn ? "blue" : "ink"}
          width={shipOn ? 2.5 : 1.5}
          label={shipOn ? "log" : undefined}
          labelOffset={14}
        />

        <Cylinder x={600} y={24} w={140} h={70} title="Follower 1" sub="applies in order" accent={applyOn ? NEON.green : undefined} />
        <LogChips x={620} y={102} count={step >= 2 ? 3 : 0} accent={applyOn ? NEON.green : undefined} />
        <Cylinder x={600} y={200} w={140} h={70} title="Follower 2" sub="applies in order" accent={applyOn ? NEON.green : undefined} />
        <LogChips x={620} y={278} count={step >= 2 ? 3 : 0} accent={applyOn ? NEON.green : undefined} />

        {/* read paths */}
        <Arrow pts={[140, 160, 300, 160]} dashed color={readOn ? "green" : "soft"} width={readOn ? 2 : 1} label="reads" labelOffset={12} />
        <Arrow pts={[85, 120, 85, 20, 560, 20, 560, 45, 600, 45]} dashed color={readOn ? "green" : "soft"} width={readOn ? 2 : 1} label="reads" labelOffset={-8} />
        <Arrow pts={[85, 176, 85, 296, 560, 296, 560, 250, 600, 250]} dashed color={readOn ? "green" : "soft"} width={readOn ? 2 : 1} label="reads" labelOffset={12} />
      </Canvas>
    </Figure>
  );
}
