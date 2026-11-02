"use client";

import { useEffect, useReducer } from "react";

type EvKind = "request" | "outgoing" | "incoming" | "fee" | "declined";
type ShardId = "A" | "B" | "F";

interface Ev {
  kind: EvKind;
  id: string;
  amount: number;
  /** Annotation written by the consuming processor. */
  note?: "applied" | "dup" | "declined";
}

interface Shard {
  log: Ev[];
  /** Entries consumed so far. */
  offset: number;
  balance: number;
  reserved: number;
  /** Request IDs already handled, per event kind, for deduplication. */
  seen: Record<string, true>;
}

interface State {
  shards: Record<ShardId, Shard>;
  /** Offset of A persisted before the last request: where a crash rewinds to. */
  checkpoint: number;
  nextId: number;
  crashes: number;
}

type Action = { type: "pay" } | { type: "tick" } | { type: "crash" } | { type: "reset" };

const AMOUNT = 30;
const FEE = 1;
const START = 100;
const TICK = 700;

const INITIAL: State = {
  shards: {
    A: { log: [], offset: 0, balance: START, reserved: 0, seen: {} },
    B: { log: [], offset: 0, balance: 0, reserved: 0, seen: {} },
    F: { log: [], offset: 0, balance: 0, reserved: 0, seen: {} },
  },
  checkpoint: 0,
  nextId: 1,
  crashes: 0,
};

const NAMES: Record<ShardId, { title: string; tag: string }> = {
  A: { title: "Account A", tag: "payer · source shard" },
  B: { title: "Account B", tag: "payee shard" },
  F: { title: "Fees", tag: "fees shard" },
};

/** Apply one event to a shard's local state. Pure and deterministic. */
function apply(shard: Shard, ev: Ev): { shard: Shard; note: Ev["note"]; emit: boolean } {
  const key = `${ev.kind}:${ev.id}`;
  if (shard.seen[key]) return { shard, note: "dup", emit: false };
  const seen = { ...shard.seen, [key]: true as const };
  switch (ev.kind) {
    case "request":
      if (shard.balance < ev.amount) return { shard: { ...shard, seen }, note: "declined", emit: true };
      return { shard: { ...shard, seen, balance: shard.balance - ev.amount, reserved: shard.reserved + ev.amount }, note: "applied", emit: true };
    case "outgoing":
      return { shard: { ...shard, seen, reserved: shard.reserved - ev.amount }, note: "applied", emit: false };
    case "incoming":
    case "fee":
      return { shard: { ...shard, seen, balance: shard.balance + ev.amount }, note: "applied", emit: false };
    case "declined":
      return { shard: { ...shard, seen }, note: "applied", emit: false };
  }
}

/** Rebuild a shard's state from its log up to `offset`, as a restarted processor would. */
function rebuild(log: Ev[], offset: number, balance: number): Shard {
  let s: Shard = { log, offset: 0, balance, reserved: 0, seen: {} };
  for (let i = 0; i < offset; i++) s = apply(s, log[i]).shard;
  return { ...s, offset };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return INITIAL;
    case "pay": {
      const id = `r${state.nextId}`;
      const A = state.shards.A;
      return {
        ...state,
        nextId: state.nextId + 1,
        checkpoint: A.offset,
        shards: { ...state.shards, A: { ...A, log: [...A.log, { kind: "request", id, amount: AMOUNT }] } },
      };
    }
    case "crash": {
      // Everything A knew since the checkpoint is gone; it re-derives its state from its own log.
      const A = state.shards.A;
      const log = A.log.map((e, i) => (i < state.checkpoint ? e : { kind: e.kind, id: e.id, amount: e.amount }));
      return { ...state, crashes: state.crashes + 1, shards: { ...state.shards, A: rebuild(log, state.checkpoint, START) } };
    }
    case "tick": {
      const shards = { ...state.shards };
      (["A", "B", "F"] as ShardId[]).forEach((sid) => {
        const sh = shards[sid];
        if (sh.offset >= sh.log.length) return;
        const ev = sh.log[sh.offset];
        const { shard, note, emit } = apply(sh, ev);
        const log = shard.log.map((e, i) => (i === sh.offset ? { ...e, note } : e));
        shards[sid] = { ...shard, log, offset: sh.offset + 1 };
        if (!emit) return;
        if (note === "declined") {
          shards.A = { ...shards.A, log: [...shards.A.log, { kind: "declined", id: ev.id, amount: ev.amount }] };
          return;
        }
        // Same request ID on every emitted event: downstream dedups by it.
        shards.A = { ...shards.A, log: [...shards.A.log, { kind: "outgoing", id: ev.id, amount: ev.amount }] };
        shards.B = { ...shards.B, log: [...shards.B.log, { kind: "incoming", id: ev.id, amount: ev.amount - FEE }] };
        shards.F = { ...shards.F, log: [...shards.F.log, { kind: "fee", id: ev.id, amount: FEE }] };
      });
      return { ...state, shards };
    }
  }
}

/**
 * A payment across three shards with no atomic commit: the client
 * appends one request to the payer's log, the payer's processor
 * reserves the funds and emits events carrying the same request ID to
 * the other shards, and every processor deduplicates by that ID.
 * Crash the payer's processor and it replays, re-emits, and the
 * duplicates are ignored: the money still adds up.
 */
export function MultishardPaymentLab() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const { A, B, F } = state.shards;
  const pending = [A, B, F].reduce((n, s) => n + (s.log.length - s.offset), 0);

  useEffect(() => {
    if (pending === 0) return;
    const t = window.setInterval(() => dispatch({ type: "tick" }), TICK);
    return () => clearInterval(t);
  }, [pending]);

  const total = A.balance + A.reserved + B.balance + F.balance;
  const lastId = state.nextId > 1 ? `r${state.nextId - 1}` : null;
  const lastOutcome = lastId
    ? A.log.find((e) => e.id === lastId && e.kind === "outgoing" && e.note === "applied")
      ? "executed"
      : A.log.find((e) => e.id === lastId && e.kind === "declined" && e.note === "applied")
        ? "declined"
        : "waiting"
    : null;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => dispatch({ type: "pay" })} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Pay ${AMOUNT} A → B
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "crash" })}
          disabled={A.offset <= state.checkpoint}
          className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad disabled:opacity-40"
        >
          Crash source processor
        </button>
        <button type="button" onClick={() => dispatch({ type: "reset" })} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line-soft border-b border-line-soft">
        <Stat
          label="integrity · Σ money"
          value={`$${total}`}
          ok={pending > 0 || total === START}
          note={pending > 0 ? "in flight, settling" : total === START ? "= $100 once settled" : "money leaked!"}
        />
        <Stat label="timeliness · pending" value={String(pending)} ok={pending === 0} note={pending === 0 ? "all views current" : "views catching up"} />
        <Stat label="crashes + replays" value={String(state.crashes)} ok note={state.crashes ? "duplicates ignored" : "none yet"} />
        <Stat
          label={`client waiting on ${lastId ?? "—"}`}
          value={lastOutcome === "executed" ? "paid" : lastOutcome === "declined" ? "declined" : lastOutcome === "waiting" ? "…" : "—"}
          ok={lastOutcome !== "waiting"}
          note="subscribed to A's log"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-px bg-line-soft">
        {(["A", "B", "F"] as ShardId[]).map((sid) => {
          const sh = state.shards[sid];
          const behind = sh.log.length - sh.offset;
          return (
            <div key={sid} className="bg-surface p-3" style={sid === "A" ? { boxShadow: "inset 4px 0 0 var(--neon-1)" } : undefined}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">{NAMES[sid].title}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{NAMES[sid].tag}</span>
              </div>
              <p className="mt-1 font-dot text-2xl font-bold">
                ${sh.balance}
                {sid === "A" && sh.reserved > 0 && <span className="text-base text-neon-5"> + ${sh.reserved} reserved</span>}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mt-1">
                log · offset {sh.offset}/{sh.log.length}
                {sid === "A" && <span> · checkpoint {state.checkpoint}</span>}
                {behind > 0 && <span className="text-neon-5"> · {behind} to process</span>}
              </p>
              <ol className="mt-2 font-mono text-[11px] space-y-0.5 min-h-[5.5rem]">
                {sh.log.length === 0 && <li className="text-ink-3">empty</li>}
                {sh.log.slice(-6).map((e, i, arr) => {
                  const idx = sh.log.length - arr.length + i;
                  const consumed = idx < sh.offset;
                  return (
                    <li key={idx} className={`flex justify-between gap-2 ${consumed ? "" : "text-ink-3"}`}>
                      <span>
                        <span className="text-ink-3">{idx}</span> {e.kind} {e.id} ${e.amount}
                      </span>
                      <span className={e.note === "dup" ? "text-neon-2" : e.note === "declined" ? "text-bad" : e.note ? "text-neon-3" : ""}>
                        {e.note === "dup" ? "dup · ignored" : e.note === "declined" ? "declined" : e.note === "applied" ? "applied" : consumed ? "" : "pending"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Atomicity comes from one append: once the request is in A&apos;s log, everything else follows, perhaps late,
        perhaps twice. A&apos;s processor reserves the money and emits outgoing, incoming and fee events that all carry
        the request ID; each shard applies an ID once and marks repeats as duplicates. Crash A after it has started:
        it rebuilds its state from its log up to the checkpoint, takes the same decision, re-emits the same events,
        and the sum never changes. Same guarantee as 2PC (each request applied once to both accounts), no atomic commit.
      </p>
    </div>
  );
}

function Stat({ label, value, ok, note }: { label: string; value: string; ok: boolean; note: string }) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 truncate">{label}</p>
      <p className={`font-dot text-2xl font-bold mt-1 ${ok ? "" : "text-neon-5"}`}>{value}</p>
      <p className="font-mono text-[10px] text-ink-2">{note}</p>
    </div>
  );
}
