"use client";

import { useState } from "react";

/**
 * The same three transactions scheduled three ways: actual serial
 * execution (one at a time), two-phase locking (shared/exclusive locks,
 * waits, a deadlock) and serializable snapshot isolation (nobody waits,
 * an abort at commit). One tick is one step of work; the reader
 * advances the clock and compares makespan, waits and aborts.
 */

type Strategy = "serial" | "2PL" | "SSI";
type TxId = "T1" | "T2" | "T3";

interface Op {
  kind: "r" | "w" | "c";
  key?: string;
}

const ORDER: TxId[] = ["T1", "T2", "T3"];
const TXS: Record<TxId, { name: string; ops: Op[] }> = {
  T1: { name: "pay x from y", ops: [{ kind: "r", key: "x" }, { kind: "r", key: "y" }, { kind: "w", key: "x" }, { kind: "c" }] },
  T2: { name: "pay y from x", ops: [{ kind: "r", key: "y" }, { kind: "r", key: "x" }, { kind: "w", key: "y" }, { kind: "c" }] },
  T3: { name: "report (read-only)", ops: [{ kind: "r", key: "x" }, { kind: "r", key: "y" }, { kind: "r", key: "z" }, { kind: "c" }] },
};

type CellKind = "run" | "wait" | "abort" | "commit" | "queued" | "done";

interface Cell {
  text: string;
  kind: CellKind;
}

interface Tick {
  n: number;
  cells: Record<TxId, Cell>;
  notes: string[];
}

const MAX_TICKS = 30;

function opText(op: Op): string {
  return op.kind === "c" ? "commit" : `${op.kind} ${op.key}`;
}

function simulate(strategy: Strategy): Tick[] {
  const ticks: Tick[] = [];
  const pc: Record<TxId, number> = { T1: 0, T2: 0, T3: 0 };
  const done: Record<TxId, boolean> = { T1: false, T2: false, T3: false };

  // 2PL lock table.
  const S: Record<string, Set<TxId>> = {};
  const X: Record<string, TxId | null> = {};
  const held = (id: TxId) => Object.keys(S).filter((k) => S[k].has(id) || X[k] === id);
  const release = (id: TxId) => {
    for (const k of Object.keys(S)) S[k].delete(id);
    for (const k of Object.keys(X)) if (X[k] === id) X[k] = null;
  };

  // SSI bookkeeping.
  const start: Record<TxId, number> = { T1: 1, T2: 1, T3: 1 };
  const reads: Record<TxId, string[]> = { T1: [], T2: [], T3: [] };
  const lastCommit: Record<string, number> = {};

  for (let n = 1; n <= MAX_TICKS && !ORDER.every((id) => done[id]); n++) {
    const cells = {} as Record<TxId, Cell>;
    const notes: string[] = [];
    const waitingOn: Partial<Record<TxId, TxId[]>> = {};

    if (strategy === "serial") {
      const current = ORDER.find((id) => !done[id]);
      for (const id of ORDER) {
        if (done[id]) cells[id] = { text: "—", kind: "done" };
        else if (id !== current) cells[id] = { text: "queued", kind: "queued" };
        else {
          const op = TXS[id].ops[pc[id]];
          pc[id] += 1;
          if (op.kind === "c") {
            done[id] = true;
            cells[id] = { text: "commit", kind: "commit" };
            notes.push(`${id} commits; the thread moves on to the next stored procedure.`);
          } else {
            cells[id] = { text: opText(op), kind: "run" };
            if (pc[id] === 1) notes.push(`${id} has the single thread; the others queue. No locks, no aborts, no concurrency.`);
          }
        }
      }
    }

    if (strategy === "2PL") {
      for (const id of ORDER) {
        if (done[id]) {
          cells[id] = { text: "—", kind: "done" };
          continue;
        }
        const op = TXS[id].ops[pc[id]];
        if (op.kind === "c") {
          release(id);
          done[id] = true;
          pc[id] += 1;
          cells[id] = { text: "commit", kind: "commit" };
          notes.push(`${id} commits and releases all its locks (shrinking phase).`);
          continue;
        }
        const k = op.key as string;
        S[k] ??= new Set();
        X[k] ??= null;
        const xOther = X[k] !== null && X[k] !== id ? [X[k] as TxId] : [];
        const sOthers = [...S[k]].filter((o) => o !== id);
        const blockers = op.kind === "r" ? xOther : [...xOther, ...sOthers];
        if (blockers.length) {
          waitingOn[id] = blockers;
          cells[id] = { text: `wait ${k}`, kind: "wait" };
          notes.push(`${id} wants ${op.kind === "r" ? "a shared" : "an exclusive"} lock on ${k}, held by ${blockers.join(", ")}: blocked.`);
          continue;
        }
        if (op.kind === "r") S[k].add(id);
        else {
          S[k].delete(id);
          X[k] = id;
        }
        pc[id] += 1;
        cells[id] = { text: opText(op), kind: "run" };
      }
      // Deadlock detection on the waits-for graph; abort the youngest.
      const cycle = findCycle(waitingOn);
      if (cycle) {
        const victim = cycle[cycle.length - 1];
        release(victim);
        pc[victim] = 0;
        cells[victim] = { text: "abort", kind: "abort" };
        notes.push(`Deadlock: ${cycle.join(" waits for ")} waits for ${cycle[0]}. The database aborts ${victim}; the application will retry it.`);
      }
      const longRead = held("T3").length;
      if (longRead >= 2 && !done.T3 && Object.values(waitingOn).some((b) => b?.includes("T3"))) {
        notes.push("T3 only reads, but its shared locks block every writer until it commits.");
      }
    }

    if (strategy === "SSI") {
      for (const id of ORDER) {
        if (done[id]) {
          cells[id] = { text: "—", kind: "done" };
          continue;
        }
        const op = TXS[id].ops[pc[id]];
        if (op.kind === "r") {
          reads[id].push(op.key as string);
          pc[id] += 1;
          cells[id] = { text: opText(op), kind: "run" };
          continue;
        }
        if (op.kind === "w") {
          pc[id] += 1;
          cells[id] = { text: opText(op), kind: "run" };
          continue;
        }
        const writes = TXS[id].ops.filter((o) => o.kind === "w").map((o) => o.key as string);
        const stale = writes.length ? reads[id].find((k) => (lastCommit[k] ?? 0) > start[id]) : undefined;
        if (stale) {
          cells[id] = { text: "abort", kind: "abort" };
          notes.push(`${id} tries to commit, but ${stale} was changed by a transaction that committed after ${id}'s snapshot. Premise outdated: abort, retry from a fresh snapshot.`);
          pc[id] = 0;
          reads[id] = [];
          start[id] = n + 1;
          continue;
        }
        for (const k of writes) lastCommit[k] = n;
        done[id] = true;
        pc[id] += 1;
        cells[id] = { text: "commit", kind: "commit" };
        notes.push(writes.length ? `${id} commits first: its premise still holds.` : `${id} is read-only on a snapshot: it never aborts and never blocks anyone.`);
      }
    }

    ticks.push({ n, cells, notes });
  }
  return ticks;
}

/** Returns the transactions of a cycle in the waits-for graph, if any. */
function findCycle(g: Partial<Record<TxId, TxId[]>>): TxId[] | null {
  for (const startId of ORDER) {
    const path: TxId[] = [];
    const seen = new Set<TxId>();
    let cur: TxId | undefined = startId;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      path.push(cur);
      cur = g[cur]?.find((b) => b in g);
    }
    if (cur && path.includes(cur)) return path.slice(path.indexOf(cur)).sort();
  }
  return null;
}

const NOTE: Record<Strategy, string> = {
  serial: "One thread, stored procedures, dataset in RAM. Nothing ever waits or aborts, and the makespan is the sum of all the work: the throughput of a single core.",
  "2PL": "Shared and exclusive locks, held until commit. Writers block readers and vice versa; a long read holds everything; two writers that each hold what the other wants deadlock, and one is aborted.",
  SSI: "Everybody runs on its own snapshot; nobody waits. At commit the database checks whether a premise went stale and aborts the second committer. Read-only transactions are never aborted.",
};

export function SerializableLab() {
  const [strategy, setStrategy] = useState<Strategy>("2PL");
  const [shown, setShown] = useState(0);
  const ticks = simulate(strategy);
  const total = ticks.length;
  const visible = ticks.slice(0, shown);
  const waits = visible.reduce((a, t) => a + ORDER.filter((id) => t.cells[id].kind === "wait").length, 0);
  const aborts = visible.reduce((a, t) => a + ORDER.filter((id) => t.cells[id].kind === "abort").length, 0);
  const committed = visible.reduce((a, t) => a + ORDER.filter((id) => t.cells[id].kind === "commit").length, 0);
  const last = visible[visible.length - 1];

  const pick = (s: Strategy) => {
    setStrategy(s);
    setShown(0);
  };

  const cellCls: Record<CellKind, string> = {
    run: "bg-surface",
    wait: "bg-surface-2 text-warn",
    abort: "bg-surface text-bad font-semibold",
    commit: "bg-surface text-ok font-semibold",
    queued: "bg-surface text-ink-3",
    done: "bg-surface text-ink-3",
  };

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line w-fit">
          {(["serial", "2PL", "SSI"] as Strategy[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={strategy === s}
              onClick={() => pick(s)}
              className={`px-3 py-1 uppercase ${strategy === s ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {s}
            </button>
          ))}
        </span>
        <button type="button" onClick={() => setShown((n) => Math.min(total, n + 1))} disabled={shown >= total} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Tick
        </button>
        <button type="button" onClick={() => setShown(total)} disabled={shown >= total} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Run to end
        </button>
        <button type="button" onClick={() => setShown(0)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full w-max">
          <div className="grid gap-px bg-line-soft" style={{ gridTemplateColumns: `11rem repeat(${Math.max(shown, 1)}, minmax(3rem, 1fr))` }}>
            <div className="bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">tick</div>
            {Array.from({ length: Math.max(shown, 1) }, (_, i) => i + 1).map((n) => (
              <div key={n} className="bg-surface px-1 py-1.5 text-center font-dot text-sm font-bold">
                {shown ? n : ""}
              </div>
            ))}
            {ORDER.map((id) => (
              <RowCells key={id} id={id} visible={visible} shown={shown} cellCls={cellCls} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line-soft border-t border-line-soft">
        <Stat label="ticks elapsed" value={`${shown}${shown >= total ? "" : ` / ${total}`}`} />
        <Stat label="committed" value={`${committed} / 3`} />
        <Stat label="waits" value={String(waits)} bad={waits > 0} />
        <Stat label="aborts" value={String(aborts)} bad={aborts > 0} />
      </div>

      <div className="px-3 py-2 border-t border-line-soft text-[12px] leading-relaxed min-h-[2.5rem]">
        {last ? (
          last.notes.length ? (
            <ul className="space-y-0.5">
              {last.notes.map((n, i) => (
                <li key={i} className={n.startsWith("Deadlock") || n.includes("abort") ? "text-bad" : "text-ink-2"}>
                  {n}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-ink-2">Tick {last.n}: every live transaction did one step.</span>
          )
        ) : (
          <span className="text-ink-2">
            T1 and T2 each read x and y and write one of them; T3 is a long read-only report. Press Tick and watch
            how each strategy schedules them.
          </span>
        )}
      </div>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">{NOTE[strategy]}</p>
    </div>
  );
}

function RowCells({
  id,
  visible,
  shown,
  cellCls,
}: {
  id: TxId;
  visible: Tick[];
  shown: number;
  cellCls: Record<CellKind, string>;
}) {
  const accent = id === "T1" ? "var(--neon-1)" : id === "T2" ? "var(--neon-2)" : "var(--neon-3)";
  return (
    <>
      <div className="bg-surface px-3 py-1.5 text-sm" style={{ boxShadow: `inset 4px 0 0 ${accent}` }}>
        <span className="font-semibold">{id}</span> <span className="text-ink-2 text-[11px]">{TXS[id].name}</span>
      </div>
      {shown === 0 ? (
        <div className="bg-surface" />
      ) : (
        visible.map((t) => (
          <div key={t.n} className={`px-1 py-1.5 text-center font-mono text-[11px] ${cellCls[t.cells[id].kind]}`}>
            {t.cells[id].text}
          </div>
        ))
      )}
    </>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="bg-surface px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className={`font-dot text-2xl font-bold ${bad ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
}
