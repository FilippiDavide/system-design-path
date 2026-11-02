"use client";

import { useState } from "react";

/**
 * One row, many versions. Writers create versions tagged with their
 * txid (an update is a delete plus an insert); a reader holds a
 * snapshot and applies the visibility rules to every version. Commit
 * and abort writers while the reader is open and watch its answer not
 * change; begin a new reader and watch it change.
 */

type TxStatus = "in progress" | "committed" | "aborted";

interface Version {
  id: number;
  value: number;
  insertedBy: number;
  deletedBy: number | null;
}

interface Reader {
  txid: number;
  inProgressAtStart: number[];
}

interface Writer {
  txid: number;
  updated: boolean;
}

interface Sim {
  next: number;
  versions: Version[];
  status: Record<number, TxStatus>;
  reader: Reader | null;
  writers: Writer[];
  log: string[];
}

const INITIAL: Sim = {
  next: 11,
  versions: [{ id: 1, value: 500, insertedBy: 5, deletedBy: null }],
  status: { 5: "committed" },
  reader: null,
  writers: [],
  log: [],
};

interface Visibility {
  visible: boolean;
  why: string;
}

/** The book's visibility rules, applied by `reader` to one version. */
function visibility(v: Version, r: Reader, status: Record<number, TxStatus>): Visibility {
  const ins = status[v.insertedBy];
  if (ins === "aborted") return { visible: false, why: `inserted by ${v.insertedBy}, aborted` };
  if (r.inProgressAtStart.includes(v.insertedBy)) return { visible: false, why: `inserted by ${v.insertedBy}, in progress at my start` };
  if (v.insertedBy > r.txid) return { visible: false, why: `inserted by ${v.insertedBy}, later than me` };
  if (v.deletedBy !== null) {
    const del = status[v.deletedBy];
    if (del === "aborted") return { visible: true, why: `deleted by ${v.deletedBy}, but it aborted` };
    if (r.inProgressAtStart.includes(v.deletedBy)) return { visible: true, why: `deleted by ${v.deletedBy}, not committed at my start` };
    if (v.deletedBy > r.txid) return { visible: true, why: `deleted by ${v.deletedBy}, later than me` };
    return { visible: false, why: `deleted by ${v.deletedBy} before my start` };
  }
  return { visible: true, why: `inserted by ${v.insertedBy}, committed before my start` };
}

/** What a read-committed reader would get right now. */
function readCommitted(s: Sim): Version | undefined {
  return s.versions.find(
    (v) =>
      s.status[v.insertedBy] === "committed" &&
      (v.deletedBy === null || s.status[v.deletedBy] !== "committed"),
  );
}

export function MvccLab() {
  const [s, setS] = useState<Sim>(INITIAL);

  const push = (n: Sim, line: string): Sim => ({ ...n, log: [...n.log.slice(-4), line] });

  const beginReader = () =>
    setS((p) => {
      const txid = p.next;
      const inProgress = Object.entries(p.status)
        .filter(([, st]) => st === "in progress")
        .map(([id]) => Number(id));
      return push(
        { ...p, next: txid + 1, reader: { txid, inProgressAtStart: inProgress }, status: { ...p.status, [txid]: "in progress" } },
        `txid ${txid} begins reading · in progress at start: {${inProgress.join(", ")}}`,
      );
    });

  const endReader = () =>
    setS((p) => {
      if (!p.reader) return p;
      return push({ ...p, reader: null, status: { ...p.status, [p.reader.txid]: "committed" } }, `txid ${p.reader.txid} done reading, its snapshot is released`);
    });

  const beginWriter = () =>
    setS((p) => {
      if (p.writers.length >= 2) return p;
      const txid = p.next;
      return push({ ...p, next: txid + 1, writers: [...p.writers, { txid, updated: false }], status: { ...p.status, [txid]: "in progress" } }, `txid ${txid} begins writing`);
    });

  const lockedBy = (p: Sim): number | null => {
    const w = p.writers.find((x) => x.updated);
    return w ? w.txid : null;
  };

  const update = (txid: number, delta: number) =>
    setS((p) => {
      if (lockedBy(p) !== null) return p;
      // The live version: committed insert, not deleted by a committed tx.
      const live = readCommitted(p);
      if (!live) return p;
      const nv: Version = { id: p.versions.length + 1, value: live.value + delta, insertedBy: txid, deletedBy: null };
      const versions = p.versions.map((v) => (v.id === live.id ? { ...v, deletedBy: txid } : v)).concat(nv);
      return push(
        { ...p, versions, writers: p.writers.map((w) => (w.txid === txid ? { ...w, updated: true } : w)) },
        `txid ${txid}: update = delete v${live.id} + insert v${nv.id} (${nv.value}) · row lock held`,
      );
    });

  const finish = (txid: number, how: "committed" | "aborted") =>
    setS((p) =>
      push(
        { ...p, writers: p.writers.filter((w) => w.txid !== txid), status: { ...p.status, [txid]: how } },
        how === "committed" ? `txid ${txid} commits · its version is now visible to new snapshots` : `txid ${txid} aborts · its version stays on disk, flagged aborted`,
      ),
    );

  const gc = () =>
    setS((p) => {
      const keep = p.versions.filter((v) => {
        if (p.status[v.insertedBy] === "aborted") return false;
        if (v.deletedBy !== null && p.status[v.deletedBy] === "committed") {
          // Still needed if the open reader can see it.
          return p.reader ? visibility(v, p.reader, p.status).visible : false;
        }
        return true;
      });
      const removed = p.versions.length - keep.length;
      return push({ ...p, versions: keep }, removed ? `garbage collector removed ${removed} version${removed > 1 ? "s" : ""} nobody can see` : "nothing to collect: every version is still visible to someone");
    });

  const rc = readCommitted(s);
  const reader = s.reader;
  const seen = reader ? s.versions.filter((v) => visibility(v, reader, s.status).visible) : [];
  const seenValue = seen.length ? seen[seen.length - 1].value : null;
  const lock = lockedBy(s);

  const primary = "border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink";
  const soft = "border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40 disabled:hover:border-line-soft";

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        {s.reader ? (
          <button type="button" onClick={endReader} className={primary}>
            End reader {s.reader.txid}
          </button>
        ) : (
          <button type="button" onClick={beginReader} className={primary}>
            Begin reader
          </button>
        )}
        <button type="button" onClick={beginWriter} disabled={s.writers.length >= 2} className={soft}>
          Begin writer
        </button>
        <button type="button" onClick={gc} className={soft}>
          Garbage collect
        </button>
        <button type="button" onClick={() => setS(INITIAL)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        {/* Versions */}
        <div className="bg-surface p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Row account 1 · versions</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{lock !== null ? `locked by ${lock}` : "unlocked"}</span>
          </div>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-ink-2">
                <th className="text-left font-normal pb-1 pr-2 whitespace-nowrap">v</th>
                <th className="text-left font-normal pb-1 pr-2 whitespace-nowrap">balance</th>
                <th className="text-left font-normal pb-1 pr-2 whitespace-nowrap">inserted_by</th>
                <th className="text-left font-normal pb-1 pr-2 whitespace-nowrap">deleted_by</th>
                <th className="text-left font-normal pb-1">reader {s.reader ? s.reader.txid : ""}</th>
              </tr>
            </thead>
            <tbody>
              {s.versions.map((v) => {
                const vis = s.reader ? visibility(v, s.reader, s.status) : null;
                return (
                  <tr key={v.id} className={`border-t border-line-soft ${vis && vis.visible ? "" : s.reader ? "text-ink-3" : ""}`}>
                    <td className="py-1 pr-2 align-top">v{v.id}</td>
                    <td className="py-1 pr-2 align-top">{v.value}</td>
                    <td className="py-1 pr-2 align-top whitespace-nowrap">
                      <TxTag id={v.insertedBy} st={s.status[v.insertedBy]} />
                    </td>
                    <td className="py-1 pr-2 align-top whitespace-nowrap">{v.deletedBy === null ? <span className="text-ink-3">—</span> : <TxTag id={v.deletedBy} st={s.status[v.deletedBy]} />}</td>
                    <td className="py-1 align-top leading-snug">
                      {vis ? (
                        <span className={vis.visible ? "text-ok" : ""}>
                          {vis.visible ? "visible" : "ignored"}
                          <span className="block text-[10px] text-ink-2">{vis.why}</span>
                        </span>
                      ) : (
                        <span className="text-ink-3">no reader</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
            <span className="text-ok">■</span> committed <span className="ml-2 text-neon-5">■</span> in progress <span className="ml-2 text-bad">■</span> aborted
          </p>
        </div>

        {/* Reader and writers */}
        <div className="grid grid-rows-[auto_1fr] gap-px bg-line-soft">
          <div className="bg-surface p-3" style={{ boxShadow: "inset 4px 0 0 var(--neon-1)" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm">Reader</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
                {s.reader ? `txid ${s.reader.txid} · snapshot` : "no snapshot"}
              </span>
            </div>
            {s.reader ? (
              <>
                <p className="font-dot text-3xl font-bold">
                  {seenValue ?? "∅"}
                  <span className="text-ink-3 text-sm font-mono ml-2">
                    from v{seen.length ? seen[seen.length - 1].id : "?"}
                  </span>
                </p>
                <p className="text-[11px] text-ink-2 leading-snug mt-1">
                  Ignores txids in progress at its start {"{"}
                  {s.reader.inProgressAtStart.join(", ")}
                  {"}"}, txids above {s.reader.txid}, and aborted ones. Nothing that commits now changes this number.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-ink-2 leading-snug">Begin a reader to take a snapshot. Its txid fixes which versions it may see.</p>
            )}
            <p className="mt-2 font-mono text-[11px] text-ink-2">
              read committed would see: <span className="text-ink">{rc ? `${rc.value} (v${rc.id})` : "∅"}</span>
            </p>
          </div>

          <div className="bg-surface p-3" style={{ boxShadow: "inset 4px 0 0 var(--neon-5)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">Writers</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{s.writers.length}/2 in progress</span>
            </div>
            {s.writers.length === 0 && <p className="text-[11px] text-ink-2">No writer in progress. Begin one, update the balance, then commit or abort.</p>}
            <ul className="space-y-2">
              {s.writers.map((w) => {
                const blocked = lock !== null && lock !== w.txid;
                return (
                  <li key={w.txid} className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                    <span className="w-14">txid {w.txid}</span>
                    <button type="button" onClick={() => update(w.txid, 100)} disabled={w.updated || blocked} className={soft} title={blocked ? `row locked by ${lock}` : undefined}>
                      {blocked ? `wait: lock ${lock}` : w.updated ? "updated" : "+100"}
                    </button>
                    <button type="button" onClick={() => finish(w.txid, "committed")} className={primary}>
                      Commit
                    </button>
                    <button type="button" onClick={() => finish(w.txid, "aborted")} className={soft}>
                      Abort
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <ol className="border-t border-line-soft divide-y divide-line-soft font-mono text-[11px] text-ink-2">
        {s.log.length === 0 ? (
          <li className="px-3 py-1.5 text-ink-3">log · begin a reader, then a writer, and watch the versions column</li>
        ) : (
          s.log.map((l, i) => (
            <li key={i} className={`px-3 py-1.5 ${i === s.log.length - 1 ? "text-ink" : ""}`}>
              {l}
            </li>
          ))
        )}
      </ol>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Readers never block writers and writers never block readers: a writer adds a version instead of overwriting,
        and the reader keeps applying the same rules to the same snapshot. Two writers still contend for the row
        lock. Old versions stay until no snapshot can see them, which is why a deleted row is only flagged and the
        garbage collector removes it later.
      </p>
    </div>
  );
}

function TxTag({ id, st }: { id: number; st: TxStatus | undefined }) {
  const cls = st === "committed" ? "text-ok" : st === "aborted" ? "text-bad" : "text-neon-5";
  return (
    <span className={cls}>
      {id}
      <span className="block text-[10px]">{st ?? "?"}</span>
    </span>
  );
}
