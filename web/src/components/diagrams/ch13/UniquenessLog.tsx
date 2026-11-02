"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Label, NEON } from "../primitives";

const STEPS = [
  "Two clients both want the username 'mario'. Neither can decide alone: uniqueness is a consensus problem, somebody must pick a winner.",
  "Both requests are appended to the same log shard, chosen by hash('mario'). The log fixes a total order for that key: A landed at offset 1, B at offset 2.",
  "One stream processor consumes the shard sequentially, on one thread. It reads A first: 'mario' is not in its local DB of taken names, so it claims it.",
  "It reads B next: 'mario' is already taken. The decision is deterministic: a processor that crashed and replayed the shard would decide exactly the same.",
  "The outcomes go on the output stream and each client waits for its own message: A success, B rejected. Consensus built from a shared log, scaled by sharding on the unique value.",
];

/**
 * Uniqueness enforced by a sharded log: two clients race for the same
 * username, the log orders them, a single-threaded processor decides,
 * and the output stream tells each client its outcome. A step
 * walkthrough highlights the part of the flow that is active.
 */
export function UniquenessLog() {
  const [step, setStep] = useState(0);
  const at = (n: number) => step === n;
  const done = (n: number) => step >= n;

  return (
    <Figure
      label="FIG 03"
      title="uniqueness: consensus, but sharded"
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
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
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={step === STEPS.length - 1}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Next
            </button>
          </span>
          <span className="flex-1 min-w-[16rem]">{STEPS[step]}</span>
        </div>
      }
    >
      <Canvas w={780} h={330}>
        {/* Clients */}
        <Box x={20} y={50} w={140} h={56} title="Client A" sub="I want 'mario'" accent={at(0) ? NEON.blue : done(4) ? "var(--ok)" : undefined} />
        <Box x={20} y={224} w={140} h={56} title="Client B" sub="I want 'mario'" accent={at(0) ? NEON.blue : done(4) ? "var(--bad)" : undefined} />

        {/* Requests into the log shard */}
        <Arrow pts={[160, 78, 200, 78, 200, 150, 230, 150]} color={at(1) ? "blue" : "ink"} width={at(1) ? 2 : 1.5} />
        <Label x={212} y={114} lines="1" size={10} mono color="var(--ink-2)" />
        <Arrow pts={[160, 252, 200, 252, 200, 174, 230, 174]} color={at(1) ? "blue" : "ink"} width={at(1) ? 2 : 1.5} />
        <Label x={212} y={213} lines="2" size={10} mono color="var(--ink-2)" />

        {/* Log shard */}
        <Cylinder
          x={230}
          y={110}
          w={130}
          h={110}
          title="Log shard"
          sub={done(1) ? "1: A mario\n2: B mario" : "hash('mario')"}
          accent={at(1) ? NEON.blue : undefined}
        />
        <Label x={295} y={240} lines="total order per key" size={10} mono color="var(--ink-2)" />

        {/* Processor */}
        <Arrow pts={[360, 165, 410, 165]} color={at(2) || at(3) ? "magenta" : "ink"} width={at(2) || at(3) ? 2 : 1.5} label={at(2) ? "read 1" : at(3) ? "read 2" : undefined} />
        <Box
          x={410}
          y={125}
          w={160}
          h={80}
          title="Stream processor"
          sub={done(2) ? "taken: { mario → A }" : "taken: { }"}
          titleSize={12}
          accent={at(2) || at(3) ? NEON.magenta : undefined}
        />
        <Label x={490} y={225} lines="one thread, one shard" size={10} mono color="var(--ink-2)" />
        {at(2) && <Label x={490} y={246} lines="A: free → claim" size={11} mono color="var(--ok)" />}
        {at(3) && <Label x={490} y={246} lines="B: taken → reject" size={11} mono color="var(--bad)" />}

        {/* Output stream */}
        <Arrow pts={[570, 165, 620, 165]} color={at(4) ? "green" : "ink"} width={at(4) ? 2 : 1.5} />
        <Cylinder x={620} y={120} w={140} h={90} title="Output stream" sub={done(4) ? "A: success\nB: rejected" : "outcomes"} accent={at(4) ? NEON.green : undefined} />

        {/* Replies routed back to the clients */}
        <Arrow pts={[690, 120, 690, 24, 90, 24, 90, 50]} color={done(4) ? "green" : "soft"} dashed={!done(4)} width={done(4) ? 2 : 1} label="A: success" labelOffset={-8} />
        <Arrow pts={[690, 210, 690, 306, 90, 306, 90, 280]} color={done(4) ? "magenta" : "soft"} dashed={!done(4)} width={done(4) ? 2 : 1} label="B: rejected" labelOffset={12} />
      </Canvas>
    </Figure>
  );
}
