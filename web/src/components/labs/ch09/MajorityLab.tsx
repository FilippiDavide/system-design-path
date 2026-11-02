"use client";

import { useState } from "react";

type Side = "A" | "B" | "down";
const IDS = [1, 2, 3, 4, 5] as const;
const N = IDS.length;
const MAJORITY = Math.floor(N / 2) + 1; // 3 of 5
const BYZ_QUORUM = Math.floor((2 * N) / 3) + 1; // 4 of 5
const LIAR = 5;

const NEXT: Record<Side, Side> = { A: "B", B: "down", down: "A" };

/**
 * Five nodes, a partition the reader draws by hand, and the question
 * "who may declare whom dead". Only a majority can, and there is only
 * ever one majority: the old leader stranded on the small side is a
 * zombie and must step down. A Byzantine node that votes on both sides
 * breaks the rule, which is why those protocols need more than 2/3.
 */
export function MajorityLab() {
  const [sides, setSides] = useState<Record<number, Side>>({ 1: "A", 2: "A", 3: "A", 4: "B", 5: "B" });
  const [liar, setLiar] = useState(false);

  const cycle = (id: number) => setSides((s) => ({ ...s, [id]: NEXT[s[id]] }));
  const reset = () => {
    setSides({ 1: "A", 2: "A", 3: "A", 4: "B", 5: "B" });
    setLiar(false);
  };

  const members = (side: Side) => IDS.filter((id) => sides[id] === side);
  const liarAlive = liar && sides[LIAR] !== "down";
  const votes = (side: Side) => {
    const honest = members(side).filter((id) => !(liar && id === LIAR)).length;
    return honest + (liarAlive ? 1 : 0);
  };

  const vA = votes("A");
  const vB = votes("B");
  const majA = vA >= MAJORITY;
  const majB = vB >= MAJORITY;
  const byzA = vA >= BYZ_QUORUM;
  const byzB = vB >= BYZ_QUORUM;

  const oldLeader = 1;
  const leaderSide = sides[oldLeader];
  const newLeader = (side: Side) => members(side).find((id) => !(liar && id === LIAR)) ?? null;

  const verdict = (() => {
    if (majA && majB) return { tone: "bad" as const, text: `Two majorities at once: both sides elect a leader and both serve writes. Split brain, because node ${LIAR} voted twice.` };
    if (!majA && !majB) return { tone: "warn" as const, text: "No side reaches 3 of 5: nobody can declare anybody dead, nobody can be elected. The system stops rather than disagree with itself: liveness lost, safety kept." };
    const m: Side = majA ? "A" : "B";
    const other: Side = m === "A" ? "B" : "A";
    const stranded = leaderSide === other;
    return {
      tone: "ok" as const,
      text: `Side ${m} holds the majority: it declares the nodes of side ${other} dead and keeps going${
        stranded ? ` with node ${newLeader(m)} as the new leader. Node ${oldLeader} still feels alive, but it has been outvoted: it must step down or it is a zombie.` : `; node ${oldLeader} stays leader because the majority still hears it.`
      }`,
    };
  })();

  const sideLabel: Record<Side, string> = { A: "side A", B: "side B", down: "crashed" };
  const sideTone: Record<Side, string> = { A: "border-neon-1 text-neon-1", B: "border-neon-2 text-neon-2", down: "border-line-soft text-ink-3 line-through" };

  const panel = (side: "A" | "B") => {
    const v = side === "A" ? vA : vB;
    const maj = side === "A" ? majA : majB;
    const byz = side === "A" ? byzA : byzB;
    const ms = members(side);
    const colour = side === "A" ? "var(--neon-1)" : "var(--neon-2)";
    return (
      <div className="bg-surface p-4" style={{ boxShadow: `inset 4px 0 0 ${colour}` }}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-sm">Side {side}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
            {ms.length} node{ms.length === 1 ? "" : "s"}
            {liarAlive && ` · ${v} votes`}
          </span>
        </div>
        <p className="mt-2 font-mono text-[12px] min-h-[18px]">
          {ms.length === 0 ? <span className="text-ink-3">empty</span> : ms.map((id) => `n${id}${id === oldLeader ? " (leader)" : liar && id === LIAR ? " (liar)" : ""}`).join(" · ")}
        </p>
        <div className="mt-3 space-y-1 font-mono text-[11px]">
          <p className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${maj ? "bg-ok" : "bg-bad"}`} />
            <span>
              majority 3/5: <span className={maj ? "text-ok" : "text-bad"}>{maj ? "yes · may declare the others dead" : "no · must wait"}</span>
            </span>
          </p>
          {liar && (
            <p className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${byz ? "bg-ok" : "bg-bad"}`} />
              <span>
                Byzantine quorum 4/5: <span className={byz ? "text-ok" : "text-bad"}>{byz ? "yes" : "no"}</span>
              </span>
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-ink-2">tap a node: side A → side B → crashed</span>
        <button
          type="button"
          aria-pressed={liar}
          onClick={() => setLiar((v) => !v)}
          className={`border px-3 py-1.5 ${liar ? "bg-ink text-surface border-ink" : "border-line-soft hover:border-ink"}`}
        >
          node 5 lies
        </button>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="p-4 bg-grid">
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => cycle(id)}
              aria-label={`node ${id}, ${sideLabel[sides[id]]}, tap to change`}
              className={`w-[64px] sm:w-[80px] border-2 bg-surface py-2 text-center hover:bg-surface-2 ${sideTone[sides[id]]}`}
            >
              <span className="block font-dot text-2xl font-bold leading-none text-ink">n{id}</span>
              <span className="block mt-1 font-mono text-[9px] uppercase tracking-[0.1em]">{sideLabel[sides[id]]}</span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-ink-2 min-h-[12px]">
                {id === oldLeader ? "leader" : liar && id === LIAR ? "liar" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft border-t border-line-soft">
        {panel("A")}
        {panel("B")}
      </div>

      <div className={`p-3 text-[12px] leading-relaxed border-t ${verdict.tone === "bad" ? "border-bad text-bad" : verdict.tone === "warn" ? "border-warn text-warn" : "border-line-soft"}`}>
        {verdict.text}
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        A node cannot trust its own judgment: it may be alive and unheard, or paused and unaware. So decisions,
        including &quot;who is dead&quot;, go to a quorum, and a strict majority works because two majorities cannot
        exist at the same time. Turn on the liar: that guarantee assumes honest nodes. Against a node that votes
        twice you need the Byzantine rule, more than two thirds, and far more expensive protocols.
      </p>
    </div>
  );
}
