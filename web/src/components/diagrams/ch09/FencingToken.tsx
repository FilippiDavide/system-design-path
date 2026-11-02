"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Canvas, INK, INK2, Label, SOFT } from "../primitives";

/** Lifeline x positions. */
const X = { c1: 110, lock: 300, c2: 490, store: 680 } as const;
type Who = keyof typeof X;

interface Msg {
  kind: "msg";
  from: Who;
  to: Who;
  y: number;
  text: string;
  dashed?: boolean;
  bad?: boolean;
}
interface Note {
  kind: "note";
  over: Who;
  y: number;
  text: string;
}
type Step = (Msg | Note) & { lease: string; seen: string; why: string };

/**
 * The script of the sequence diagram. `lease` and `seen` are the state
 * of the lock service and of the storage after the step; `why` is the
 * sentence shown in the caption.
 */
function script(fencing: boolean): Step[] {
  return [
    { kind: "msg", from: "c1", to: "lock", y: 92, text: "lease?", lease: "free", seen: "–", why: "Client 1 asks the lock service for the lease on the file." },
    {
      kind: "msg",
      from: "lock",
      to: "c1",
      y: 116,
      text: fencing ? "ok, token 33" : "ok",
      dashed: true,
      lease: fencing ? "client 1 · 33" : "client 1",
      seen: "–",
      why: fencing
        ? "Granted. Every grant carries a number that only ever increases: this one is 33."
        : "Granted. Without fencing the grant is just a yes: nothing identifies which grant it was.",
    },
    {
      kind: "note",
      over: "c1",
      y: 150,
      text: "long pause: lease expired",
      lease: "expired",
      seen: "–",
      why: "Client 1 stops (GC, VM suspend, page fault). Its lease expires while it is frozen, but it has no way to notice.",
    },
    { kind: "msg", from: "c2", to: "lock", y: 200, text: "lease?", lease: "expired", seen: "–", why: "Client 2 asks for the same lease. The old one has expired, so it is available." },
    {
      kind: "msg",
      from: "lock",
      to: "c2",
      y: 224,
      text: fencing ? "ok, token 34" : "ok",
      dashed: true,
      lease: fencing ? "client 2 · 34" : "client 2",
      seen: "–",
      why: fencing ? "Granted with the next token, 34. Any token below 34 now belongs to the past." : "Granted. Two clients now believe they hold the lease, and nothing can tell them apart.",
    },
    {
      kind: "msg",
      from: "c2",
      to: "store",
      y: 256,
      text: fencing ? "write (token 34)" : "write",
      lease: fencing ? "client 2 · 34" : "client 2",
      seen: fencing ? "34" : "–",
      why: fencing ? "Client 2 writes immediately and includes its token. The storage records 34 as the highest token it has seen." : "Client 2 writes. The storage has no idea who is supposed to be the writer.",
    },
    { kind: "msg", from: "store", to: "c2", y: 280, text: "ok", dashed: true, lease: fencing ? "client 2 · 34" : "client 2", seen: fencing ? "34" : "–", why: "Accepted." },
    {
      kind: "note",
      over: "c1",
      y: 312,
      text: "wakes up",
      lease: fencing ? "client 2 · 34" : "client 2",
      seen: fencing ? "34" : "–",
      why: "Client 1 resumes exactly where it stopped, convinced it still holds the lease. It is now a zombie.",
    },
    {
      kind: "msg",
      from: "c1",
      to: "store",
      y: 348,
      text: fencing ? "write (token 33)" : "write",
      lease: fencing ? "client 2 · 34" : "client 2",
      seen: fencing ? "34" : "–",
      why: fencing ? "The zombie writes with its stale token 33." : "The zombie writes. Nothing in the request says it is stale.",
    },
    {
      kind: "msg",
      from: "store",
      to: "c1",
      y: 372,
      text: fencing ? "rejected: already seen 34" : "ok · file corrupted",
      dashed: true,
      bad: true,
      lease: fencing ? "client 2 · 34" : "client 2",
      seen: fencing ? "34" : "–",
      why: fencing
        ? "33 < 34, so the storage refuses it. The zombie is fenced off and client 2's write survives."
        : "Accepted: client 1's stale write overwrites client 2's. Split brain, corrupted file. This is the real HBase bug.",
    },
  ];
}

/**
 * Fencing token as a sequence diagram you step through. The toggle
 * removes the token to show the same sequence ending in corruption.
 */
export function FencingToken() {
  const [fencing, setFencing] = useState(true);
  const [step, setStep] = useState(0);
  const steps = script(fencing);
  const cur = steps[step];
  const n = steps.length;

  const btn = "px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]";

  return (
    <Figure
      label="FIG 03"
      title={fencing ? "fencing token: the zombie is rejected" : "without a token: the zombie corrupts the file"}
      caption={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex gap-px border border-line w-fit">
            <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className={`${btn} hover:bg-surface-2 disabled:opacity-40`}>
              Prev
            </button>
            <span className={`${btn} border-x border-line font-dot`}>
              {step + 1}/{n}
            </span>
            <button type="button" onClick={() => setStep((s) => Math.min(n - 1, s + 1))} disabled={step === n - 1} className={`${btn} hover:bg-surface-2 disabled:opacity-40`}>
              Next
            </button>
          </span>
          <span className="flex gap-px border border-line w-fit">
            {(["token", "no token"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={(m === "token") === fencing}
                onClick={() => setFencing(m === "token")}
                className={`${btn} ${(m === "token") === fencing ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
              >
                {m}
              </button>
            ))}
          </span>
          <span className="basis-full sm:basis-auto sm:flex-1">{cur.why}</span>
        </div>
      }
    >
      <Canvas w={780} h={400}>
        {/* Lifelines */}
        {(Object.keys(X) as Who[]).map((k) => (
          <g key={k}>
            <line x1={X[k]} y1={62} x2={X[k]} y2={392} stroke={SOFT} strokeWidth={1} strokeDasharray="3 3" />
            <rect x={X[k] - 65} y={22} width={130} height={40} fill="#fff" stroke={INK} strokeWidth={1.5} />
            <Label
              x={X[k]}
              y={42}
              lines={k === "c1" ? "Client 1" : k === "lock" ? "Lock service" : k === "c2" ? "Client 2" : "Storage"}
              size={13}
              weight={600}
            />
          </g>
        ))}
        {/* State of the lock service and of the storage */}
        <rect x={X.lock - 60} y={68} width={120} height={16} fill="var(--surface-2)" />
        <Label x={X.lock} y={76} lines={`lease: ${cur.lease}`} size={10} mono color={INK2} />
        <rect x={X.store - 60} y={68} width={120} height={16} fill="var(--surface-2)" />
        <Label x={X.store} y={76} lines={`highest token: ${cur.seen}`} size={10} mono color={INK2} />

        {steps.map((s, i) => {
          const state = i < step ? "past" : i === step ? "now" : "future";
          const opacity = state === "future" ? 0.18 : 1;
          const color = state === "now" ? (s.kind === "msg" && s.bad ? "var(--bad)" : "var(--neon-1)") : INK;
          if (s.kind === "note") {
            return (
              <g key={i} opacity={opacity}>
                <rect x={X[s.over] - 78} y={s.y - 12} width={156} height={24} fill="#fff" stroke={state === "now" ? "var(--neon-5)" : INK} strokeWidth={1.5} />
                <Label x={X[s.over]} y={s.y} lines={s.text} size={10} mono color={state === "now" ? "var(--neon-5)" : INK} />
              </g>
            );
          }
          const x1 = X[s.from];
          const x2 = X[s.to];
          const dir = x2 > x1 ? 1 : -1;
          const head = `${x2 - dir * 8},${s.y - 4} ${x2},${s.y} ${x2 - dir * 8},${s.y + 4}`;
          const labelColor = state === "now" ? color : s.bad && !fencing ? "var(--bad)" : INK2;
          return (
            <g key={i} opacity={opacity}>
              <line x1={x1} y1={s.y} x2={x2} y2={s.y} stroke={color} strokeWidth={state === "now" ? 2 : 1.5} strokeDasharray={s.dashed ? "5 4" : undefined} />
              <polyline points={head} fill="none" stroke={color} strokeWidth={state === "now" ? 2 : 1.5} />
              <Label x={(x1 + x2) / 2} y={s.y - 9} lines={s.text} size={10} mono color={labelColor} />
            </g>
          );
        })}
      </Canvas>
    </Figure>
  );
}
