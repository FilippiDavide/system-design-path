"use client";

import { useState } from "react";

/**
 * Two transactions, one database, five isolation levels. The reader
 * runs the transactions step by step in any interleaving (or replays
 * the classic race) and sees which anomaly comes out, or how the level
 * prevents it: a lock that makes a step wait, a snapshot that returns
 * an older version, or an abort at write or commit time.
 */

type Val = number | string;
type TxId = "T1" | "T2";
type Level = "none" | "read uncommitted" | "read committed" | "snapshot isolation" | "serializable";

const LEVELS: Level[] = ["none", "read uncommitted", "read committed", "snapshot isolation", "serializable"];

type Step =
  | { kind: "read"; key: string; text: string }
  | {
      kind: "write";
      key: string;
      text: string;
      value: (reads: Record<string, Val>) => Val;
      when?: (reads: Record<string, Val>) => boolean;
    }
  | { kind: "commit"; text: string };

interface TxDef {
  name: string;
  steps: Step[];
}

interface Verdict {
  kind: "ok" | "warn" | "bad" | "pending";
  text: string;
}

interface Scenario {
  id: string;
  name: string;
  anomaly: string;
  init: Record<string, Val>;
  tx: Record<TxId, TxDef>;
  race: TxId[];
  verdict: (s: SimState) => Verdict;
}

interface Version {
  value: Val;
  seq: number;
}

interface ReadRec {
  key: string;
  value: Val;
  dirty: boolean;
}

interface TxState {
  pc: number;
  status: "idle" | "running" | "waiting" | "committed" | "aborted";
  startSeq: number;
  reads: Record<string, Val>;
  readLog: ReadRec[];
  note: string;
  skipped: boolean;
}

interface SimState {
  versions: Record<string, Version[]>;
  uncommitted: Record<string, { value: Val; by: TxId }>;
  seq: number;
  tx: Record<TxId, TxState>;
}

const read = (key: string, text?: string): Step => ({ kind: "read", key, text: text ?? `read ${key}` });
const commit = (): Step => ({ kind: "commit", text: "commit" });

const SCENARIOS: Scenario[] = [
  {
    id: "dirty-read",
    name: "Dirty read",
    anomaly: "the unread counter",
    init: { emails: 0, unread: 0 },
    tx: {
      T1: {
        name: "new mail arrives",
        steps: [
          { kind: "write", key: "emails", text: "write emails = 1", value: () => 1 },
          { kind: "write", key: "unread", text: "write unread = 1", value: () => 1 },
          commit(),
        ],
      },
      T2: { name: "render the inbox", steps: [read("emails"), read("unread"), commit()] },
    },
    race: ["T1", "T2", "T2", "T1", "T1", "T2"],
    verdict: (s) => {
      const r = s.tx.T2.readLog;
      if (r.some((x) => x.dirty)) {
        return { kind: "bad", text: "Dirty read: T2 saw a value T1 had not committed. It rendered the new email with the old counter, and if T1 had aborted it would have shown data that never existed." };
      }
      if (r.length === 2 && r[0].value !== r[1].value) {
        return { kind: "warn", text: "No dirty read (every value was committed when read), but the two reads straddle T1's commit: that is read skew, the next anomaly." };
      }
      return { kind: "ok", text: "T2 only ever saw committed values: the inbox is consistent, either without the new mail or with mail and counter together." };
    },
  },
  {
    id: "dirty-write",
    name: "Dirty write",
    anomaly: "two buyers, one car",
    init: { buyer: "-", invoice: "-" },
    tx: {
      T1: {
        name: "Aaliyah buys",
        steps: [
          { kind: "write", key: "buyer", text: "write buyer = Aaliyah", value: () => "Aaliyah" },
          { kind: "write", key: "invoice", text: "write invoice = Aaliyah", value: () => "Aaliyah" },
          commit(),
        ],
      },
      T2: {
        name: "Bryce buys",
        steps: [
          { kind: "write", key: "buyer", text: "write buyer = Bryce", value: () => "Bryce" },
          { kind: "write", key: "invoice", text: "write invoice = Bryce", value: () => "Bryce" },
          commit(),
        ],
      },
    },
    race: ["T1", "T2", "T2", "T1", "T1", "T2"],
    verdict: (s) => {
      const buyer = latest(s, "buyer");
      const invoice = latest(s, "invoice");
      if (buyer !== invoice) {
        return { kind: "bad", text: `Dirty write: the car goes to ${buyer} and the invoice to ${invoice}. Each transaction overwrote the other's uncommitted write on a different row.` };
      }
      return { kind: "ok", text: `Row locks held until commit: the second buyer waited for the first to finish and then overwrote both rows. ${buyer} gets the car and the invoice.` };
    },
  },
  {
    id: "read-skew",
    name: "Read skew",
    anomaly: "the transfer",
    init: { acct1: 500, acct2: 500 },
    tx: {
      T1: { name: "Aaliyah checks balances", steps: [read("acct1"), read("acct2"), commit()] },
      T2: {
        name: "transfer 100 from 2 to 1",
        steps: [
          { kind: "write", key: "acct1", text: "write acct1 = 600", value: () => 600 },
          { kind: "write", key: "acct2", text: "write acct2 = 400", value: () => 400 },
          commit(),
        ],
      },
    },
    race: ["T1", "T2", "T2", "T2", "T1", "T1"],
    verdict: (s) => {
      const r = s.tx.T1.readLog;
      if (r.some((x) => x.dirty)) return { kind: "bad", text: "Dirty read: Aaliyah saw the transfer before it committed." };
      if (r.length === 2) {
        const sum = Number(r[0].value) + Number(r[1].value);
        if (sum !== 1000) {
          return { kind: "bad", text: `Read skew: ${r[0].value} + ${r[1].value} = ${sum}. Both values were committed when read, but at different instants. Fine for a web page, fatal for a backup.` };
        }
        return { kind: "ok", text: `${r[0].value} + ${r[1].value} = 1000. The two reads come from one consistent snapshot, whatever the transfer did meanwhile.` };
      }
      return { kind: "pending", text: "" };
    },
  },
  {
    id: "lost-update",
    name: "Lost update",
    anomaly: "two increments",
    init: { counter: 0 },
    tx: {
      T1: {
        name: "increment",
        steps: [read("counter"), { kind: "write", key: "counter", text: "write counter = counter + 1", value: (r) => Number(r.counter) + 1 }, commit()],
      },
      T2: {
        name: "increment",
        steps: [read("counter"), { kind: "write", key: "counter", text: "write counter = counter + 1", value: (r) => Number(r.counter) + 1 }, commit()],
      },
    },
    race: ["T1", "T2", "T1", "T2", "T1", "T2"],
    verdict: (s) => {
      const v = Number(latest(s, "counter"));
      const a = s.tx.T1.status === "aborted" || s.tx.T2.status === "aborted";
      if (a) return { kind: "ok", text: "Automatic detection: the second writer was aborted because the row changed since its snapshot (first committer wins). Retry it and the counter reaches 2." };
      if (v === 1) return { kind: "bad", text: "Lost update: two read-modify-write cycles, the second overwrote the first. Two increments, counter = 1." };
      return { kind: "ok", text: "Counter = 2: the second increment read the value the first had written." };
    },
  },
  {
    id: "write-skew",
    name: "Write skew",
    anomaly: "the doctors on call",
    init: { aaliyah: "on", bryce: "on" },
    tx: {
      T1: {
        name: "Aaliyah goes home",
        steps: [
          read("aaliyah"),
          read("bryce"),
          { kind: "write", key: "aaliyah", text: "if 2 on call: write aaliyah = off", value: () => "off", when: (r) => onCall(r) >= 2 },
          commit(),
        ],
      },
      T2: {
        name: "Bryce goes home",
        steps: [
          read("aaliyah"),
          read("bryce"),
          { kind: "write", key: "bryce", text: "if 2 on call: write bryce = off", value: () => "off", when: (r) => onCall(r) >= 2 },
          commit(),
        ],
      },
    },
    race: ["T1", "T1", "T2", "T2", "T1", "T2", "T1", "T2"],
    verdict: (s) => {
      const both = latest(s, "aaliyah") === "off" && latest(s, "bryce") === "off";
      if (both) return { kind: "bad", text: "Write skew: each transaction checked the premise (2 on call), each changed a different row, both committed. Nobody is on call. No lock was ever contended, so no level below serializable notices." };
      if (s.tx.T1.status === "aborted" || s.tx.T2.status === "aborted") {
        return { kind: "ok", text: "SSI: the second commit found that a row it had read was changed by a transaction that committed after its snapshot. Premise outdated, abort, the application retries and sees 1 on call." };
      }
      if (s.tx.T1.skipped || s.tx.T2.skipped) return { kind: "ok", text: "One transaction saw only 1 on call and did not leave. That is what a serial order gives you." };
      return { kind: "ok", text: "At least one doctor is still on call." };
    },
  },
];

function onCall(r: Record<string, Val>): number {
  return (r.aaliyah === "on" ? 1 : 0) + (r.bryce === "on" ? 1 : 0);
}

function latest(s: SimState, key: string): Val {
  const v = s.versions[key];
  return v[v.length - 1].value;
}

function freshTx(): TxState {
  return { pc: 0, status: "idle", startSeq: 0, reads: {}, readLog: [], note: "", skipped: false };
}

function initial(sc: Scenario): SimState {
  const versions: Record<string, Version[]> = {};
  for (const [k, v] of Object.entries(sc.init)) versions[k] = [{ value: v, seq: 0 }];
  return { versions, uncommitted: {}, seq: 0, tx: { T1: freshTx(), T2: freshTx() } };
}

function clone(s: SimState): SimState {
  return {
    versions: Object.fromEntries(Object.entries(s.versions).map(([k, v]) => [k, v.map((x) => ({ ...x }))])),
    uncommitted: Object.fromEntries(Object.entries(s.uncommitted).map(([k, v]) => [k, { ...v }])),
    seq: s.seq,
    tx: {
      T1: { ...s.tx.T1, reads: { ...s.tx.T1.reads }, readLog: s.tx.T1.readLog.map((r) => ({ ...r })) },
      T2: { ...s.tx.T2, reads: { ...s.tx.T2.reads }, readLog: s.tx.T2.readLog.map((r) => ({ ...r })) },
    },
  };
}

/** Execute the next step of `id` under `level`; returns a new state. */
function advance(prev: SimState, sc: Scenario, id: TxId, level: Level): SimState {
  const s = clone(prev);
  const t = s.tx[id];
  const other: TxId = id === "T1" ? "T2" : "T1";
  if (t.status === "committed" || t.status === "aborted") return s;
  if (t.status === "idle") {
    t.startSeq = s.seq;
    t.status = "running";
  }
  const step = sc.tx[id].steps[t.pc];
  const snapshot = level === "snapshot isolation" || level === "serializable";
  const locks = level !== "none";

  const abort = (note: string) => {
    for (const k of Object.keys(s.uncommitted)) if (s.uncommitted[k].by === id) delete s.uncommitted[k];
    t.status = "aborted";
    t.note = note;
  };

  if (step.kind === "read") {
    const unc = s.uncommitted[step.key];
    let value: Val;
    let dirty = false;
    if (unc && unc.by === id) {
      value = unc.value;
    } else if (unc && !snapshot && level !== "read committed") {
      value = unc.value;
      dirty = true;
    } else if (snapshot) {
      const vis = s.versions[step.key].filter((v) => v.seq <= t.startSeq);
      value = vis[vis.length - 1].value;
    } else {
      value = latest(s, step.key);
    }
    t.reads[step.key] = value;
    t.readLog.push({ key: step.key, value, dirty });
    t.note = dirty ? `read ${step.key} = ${value}, uncommitted (${other})` : `read ${step.key} = ${value}`;
    t.status = "running";
    t.pc += 1;
    return s;
  }

  if (step.kind === "write") {
    const unc = s.uncommitted[step.key];
    if (locks && unc && unc.by !== id) {
      t.status = "waiting";
      t.note = `waiting for the lock on ${step.key}, held by ${other}`;
      return s;
    }
    const lv = s.versions[step.key];
    if (snapshot && lv[lv.length - 1].seq > t.startSeq) {
      abort(`abort: ${step.key} changed since this snapshot (first committer wins)`);
      return s;
    }
    if (step.when && !step.when(t.reads)) {
      t.skipped = true;
      t.note = "precondition false: nothing to write";
      t.status = "running";
      t.pc += 1;
      return s;
    }
    s.uncommitted[step.key] = { value: step.value(t.reads), by: id };
    t.note = locks ? `wrote ${step.key}, lock held until commit` : `wrote ${step.key}, no lock`;
    t.status = "running";
    t.pc += 1;
    return s;
  }

  // commit
  if (level === "serializable") {
    for (const r of t.readLog) {
      const lv = s.versions[r.key];
      if (lv[lv.length - 1].seq > t.startSeq) {
        abort(`abort: premise outdated, ${r.key} was changed by ${other} after this snapshot`);
        return s;
      }
    }
  }
  s.seq += 1;
  for (const k of Object.keys(s.uncommitted)) {
    if (s.uncommitted[k].by === id) {
      s.versions[k].push({ value: s.uncommitted[k].value, seq: s.seq });
      delete s.uncommitted[k];
    }
  }
  t.status = "committed";
  t.note = "committed";
  t.pc += 1;
  return s;
}

const LEVEL_NOTE: Record<Level, string> = {
  none: "No locks, reads return the latest write even if uncommitted. Nothing is prevented.",
  "read uncommitted": "Row locks on writes, held until commit, so no dirty writes. Reads still see uncommitted values.",
  "read committed": "Row locks on writes; readers get the last committed version instead of waiting. No dirty reads or writes.",
  "snapshot isolation": "Each transaction reads the versions committed before it started (MVCC). A write to a row changed since the snapshot aborts (first committer wins).",
  serializable: "Snapshot isolation plus SSI: at commit, if any row this transaction read was changed by a transaction that committed after its snapshot, it aborts.",
};

export function IsolationAnomaliesLab() {
  const [scIdx, setScIdx] = useState(0);
  const [level, setLevel] = useState<Level>("read committed");
  const sc = SCENARIOS[scIdx];
  const [state, setState] = useState<SimState>(() => initial(SCENARIOS[0]));

  const pick = (i: number) => {
    setScIdx(i);
    setState(initial(SCENARIOS[i]));
  };
  const changeLevel = (l: Level) => {
    setLevel(l);
    setState(initial(sc));
  };
  const stepTx = (id: TxId) => setState((s) => advance(s, sc, id, level));
  const retry = (id: TxId) =>
    setState((s) => {
      const n = clone(s);
      n.tx[id] = freshTx();
      return n;
    });
  const replay = () => {
    let s = initial(sc);
    for (const id of sc.race) s = advance(s, sc, id, level);
    // If a lock made one transaction wait, let both run to the end so
    // the verdict is visible at every level (no deadlock is possible
    // in these scenarios, the guard is only a safety net).
    const fin = (st: SimState, id: TxId) => st.tx[id].status === "committed" || st.tx[id].status === "aborted";
    for (let i = 0; i < 20 && !(fin(s, "T1") && fin(s, "T2")); i++) {
      if (!fin(s, "T1")) s = advance(s, sc, "T1", level);
      if (!fin(s, "T2")) s = advance(s, sc, "T2", level);
    }
    setState(s);
  };

  const done = (id: TxId) => state.tx[id].status === "committed" || state.tx[id].status === "aborted";
  const finished = done("T1") && done("T2");
  const verdict: Verdict = finished ? sc.verdict(state) : { kind: "pending", text: "" };

  const selectCls = "border border-line bg-surface px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em]";

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <label className="flex items-center gap-2">
          anomaly
          <select className={selectCls} value={scIdx} onChange={(e) => pick(Number(e.target.value))} aria-label="Anomaly scenario">
            {SCENARIOS.map((s, i) => (
              <option key={s.id} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          level
          <select className={selectCls} value={level} onChange={(e) => changeLevel(e.target.value as Level)} aria-label="Isolation level">
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={replay} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Replay the race
        </button>
        <button type="button" onClick={() => setState(initial(sc))} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-px bg-line-soft">
        <TxPanel id="T1" def={sc.tx.T1} t={state.tx.T1} accent="var(--neon-1)" onStep={() => stepTx("T1")} onRetry={() => retry("T1")} />
        <div className="bg-surface p-3 md:order-none order-first">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Database</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{sc.anomaly}</span>
          </div>
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-ink-2">
                <th className="text-left font-normal pb-1">row</th>
                <th className="text-left font-normal pb-1">committed</th>
                <th className="text-left font-normal pb-1">uncommitted</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(sc.init).map((k) => {
                const vs = state.versions[k];
                const u = state.uncommitted[k];
                return (
                  <tr key={k} className="border-t border-line-soft">
                    <td className="py-1">{k}</td>
                    <td className="py-1">
                      {vs.map((v, i) => (
                        <span key={i} className={i === vs.length - 1 ? "" : "text-ink-3 line-through mr-1"}>
                          {String(v.value)}
                        </span>
                      ))}
                    </td>
                    <td className="py-1">
                      {u ? (
                        <span style={{ color: u.by === "T1" ? "var(--neon-1)" : "var(--neon-2)" }}>
                          {String(u.value)} <span className="text-[10px]">· {u.by}{level !== "none" ? " lock" : ""}</span>
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-ink-2 leading-snug">{LEVEL_NOTE[level]}</p>
        </div>
        <TxPanel id="T2" def={sc.tx.T2} t={state.tx.T2} accent="var(--neon-2)" onStep={() => stepTx("T2")} onRetry={() => retry("T2")} />
      </div>

      <div
        className={`px-3 py-2 border-t border-line-soft text-[12px] leading-relaxed min-h-[2.5rem] ${
          verdict.kind === "bad" ? "text-bad" : verdict.kind === "warn" ? "text-warn" : verdict.kind === "ok" ? "text-ok" : "text-ink-2"
        }`}
      >
        {finished ? (
          <>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] mr-2">
              {verdict.kind === "bad" ? "anomaly" : verdict.kind === "warn" ? "different anomaly" : "prevented"}
            </span>
            {verdict.text}
          </>
        ) : (
          "Click 'next step' on either transaction in any order, or replay the interleaving that triggers the anomaly. Then change the level and try again."
        )}
      </div>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        The same five races, five levels. Read committed stops dirty reads and dirty writes with row locks and a second
        committed version. Snapshot isolation stops read skew with MVCC and, in PostgreSQL-style implementations, lost
        updates with first-committer-wins. Only serializability stops write skew, because the two transactions never touch
        the same row.
      </p>
    </div>
  );
}

function TxPanel({
  id,
  def,
  t,
  accent,
  onStep,
  onRetry,
}: {
  id: TxId;
  def: TxDef;
  t: TxState;
  accent: string;
  onStep: () => void;
  onRetry: () => void;
}) {
  const done = t.status === "committed" || t.status === "aborted";
  const badge =
    t.status === "committed" ? "text-ok" : t.status === "aborted" ? "text-bad" : t.status === "waiting" ? "text-warn" : "text-ink-2";
  return (
    <div className="bg-surface p-3" style={{ boxShadow: `inset 4px 0 0 ${accent}` }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-semibold text-sm">
          {id} <span className="font-normal text-ink-2">· {def.name}</span>
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${badge}`}>{t.status}</span>
      </div>
      <ol className="font-mono text-[12px] space-y-0.5">
        {def.steps.map((st, i) => {
          const isDone = i < t.pc;
          const isNext = i === t.pc && !done;
          const r = st.kind === "read" ? t.readLog.find((x) => x.key === st.key) : undefined;
          return (
            <li key={i} className={`flex gap-2 ${isDone ? "" : isNext ? "" : "text-ink-3"}`}>
              <span className="w-3 shrink-0">{isDone ? "✓" : isNext ? "▸" : " "}</span>
              <span>
                {st.text}
                {isDone && r && <span className="text-ink-2"> → {String(r.value)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className={`mt-2 text-[11px] leading-snug min-h-[2.2rem] ${t.status === "aborted" ? "text-bad" : t.status === "waiting" ? "text-warn" : "text-ink-2"}`}>
        {t.note || "not started"}
      </p>
      <div className="mt-2 flex gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
        <button
          type="button"
          onClick={onStep}
          disabled={done}
          className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
        >
          {t.status === "waiting" ? "Try again" : "Next step"}
        </button>
        {t.status === "aborted" && (
          <button type="button" onClick={onRetry} className="border border-line-soft px-3 py-1.5 hover:border-ink">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
