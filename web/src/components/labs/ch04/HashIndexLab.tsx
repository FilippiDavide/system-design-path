"use client";

import { useState } from "react";

interface Rec {
  offset: number;
  key: string;
  value: string;
}

const KEYS = ["cat", "dog", "emu", "fox", "gnu"];

/** Bytes a record takes in the file: `key,value\n`. */
const size = (r: Pick<Rec, "key" | "value">) => r.key.length + 1 + r.value.length + 1;

interface State {
  log: Rec[];
  /** key → byte offset of the most recent value, or null after a restart. */
  index: Map<string, number> | null;
  counter: number;
  message: string;
  hit: number | null;
  scanned: number[];
}

const START: State = {
  log: [],
  index: new Map(),
  counter: 0,
  message: "The file is empty. Append a few records.",
  hit: null,
  scanned: [],
};

/** Rebuild the hash map by scanning the whole log, as on restart. */
function rebuild(log: Rec[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of log) m.set(r.key, r.offset);
  return m;
}

/**
 * The world's simplest database plus an in-memory hash index. Appends
 * are cheap, lookups are one hash probe and one seek, but the file only
 * grows until compaction, the map must be rebuilt after a restart, and
 * a range query has no choice but to probe every key.
 */
export function HashIndexLab() {
  const [s, setS] = useState<State>(START);
  const [key, setKey] = useState("dog");
  const live = s.index ?? rebuild(s.log);
  const liveBytes = [...live.entries()].reduce((a, [k, off]) => {
    const r = s.log.find((x) => x.offset === off);
    return a + (r ? size({ key: k, value: r.value }) : 0);
  }, 0);
  const totalBytes = s.log.reduce((a, r) => a + size(r), 0);

  const append = (k: string) => {
    setS((p) => {
      const value = `${k}-v${p.counter + 1}`;
      const offset = p.log.reduce((a, r) => a + size(r), 0);
      const rec = { offset, key: k, value };
      const index = p.index ? new Map(p.index) : null;
      index?.set(k, offset);
      return {
        ...p,
        log: [...p.log, rec],
        index,
        counter: p.counter + 1,
        hit: null,
        scanned: [],
        message: index
          ? `Appended "${k},${value}" at offset ${offset} (${size(rec)} bytes) and pointed the hash map at it. The old value, if any, is now dead weight in the file.`
          : `Appended at offset ${offset}, but the hash map is gone: it must be rebuilt by scanning the file before any read.`,
      };
    });
  };

  const get = () => {
    setS((p) => {
      if (!p.index) {
        return { ...p, message: "No hash map in memory: after a restart nothing can be read. Press Rebuild to scan the file." };
      }
      const off = p.index.get(key);
      if (off === undefined) {
        return { ...p, hit: null, scanned: [], message: `get(${key}): the hash map has no entry, so the answer is "not found" without touching the disk.` };
      }
      return {
        ...p,
        hit: off,
        scanned: [],
        message: `get(${key}): one hash probe gives offset ${off}; one seek and one read return the latest value. Older copies in the file are never looked at.`,
      };
    });
  };

  const range = () => {
    setS((p) => {
      if (!p.index) return { ...p, message: "No hash map in memory. Rebuild it first." };
      const keys = [...p.index.keys()].sort();
      return {
        ...p,
        hit: null,
        scanned: [...p.index.values()],
        message: `range(a..z): a hash map has no order. The only way is to probe every key separately (${keys.length} lookups, ${keys.length} seeks). With a million keys this is not a range query, it is a full scan in random order.`,
      };
    });
  };

  const restart = () => {
    setS((p) => ({ ...p, index: null, hit: null, scanned: [], message: "Process restarted: the hash map lived in RAM and is gone. The file is intact, but nothing can be read until the map is rebuilt." }));
  };

  const doRebuild = () => {
    setS((p) => ({
      ...p,
      index: rebuild(p.log),
      scanned: p.log.map((r) => r.offset),
      hit: null,
      message: `Scanned all ${p.log.length} records from the start of the file to rebuild the map. On a big file this takes minutes, which is why Bitcask keeps a snapshot of the map on disk.`,
    }));
  };

  const compact = () => {
    setS((p) => {
      const latest = rebuild(p.log);
      const keep = p.log.filter((r) => latest.get(r.key) === r.offset);
      let offset = 0;
      const log = keep.map((r) => {
        const rec = { ...r, offset };
        offset += size(r);
        return rec;
      });
      const before = p.log.reduce((a, r) => a + size(r), 0);
      return {
        ...p,
        log,
        index: rebuild(log),
        hit: null,
        scanned: [],
        message: `Compaction wrote a new segment with only the latest value per key: ${p.log.length} records became ${log.length}, ${before} bytes became ${offset}. The old file is deleted and the map now points into the new one.`,
      };
    });
  };

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => append(KEYS[s.counter % KEYS.length])} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Append next
        </button>
        <button type="button" onClick={() => append("dog")} className="border border-line-soft px-3 py-1.5 hover:border-ink">
          Overwrite dog
        </button>
        <label className="flex items-center gap-2">
          <select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Key to look up" className="border border-line-soft bg-surface px-2 py-1 font-mono text-[11px] uppercase">
            {[...KEYS, "yak"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button type="button" onClick={get} className="border border-line-soft px-3 py-1.5 hover:border-ink">
            Get
          </button>
        </label>
        <button type="button" onClick={range} className="border border-line-soft px-3 py-1.5 hover:border-ink">
          Range a..z
        </button>
        <button type="button" onClick={compact} disabled={s.log.length === 0} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Compact
        </button>
        {s.index ? (
          <button type="button" onClick={restart} className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad">
            Restart process
          </button>
        ) : (
          <button type="button" onClick={doRebuild} className="border border-warn text-warn px-3 py-1.5 hover:bg-warn hover:text-surface">
            Rebuild map
          </button>
        )}
        <button type="button" onClick={() => setS(START)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        <div className="bg-surface p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Append-only file</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
              {totalBytes} B · {totalBytes - liveBytes} B dead
            </span>
          </div>
          {s.log.length === 0 ? (
            <p className="font-mono text-[12px] text-ink-3">(empty)</p>
          ) : (
            <ol className="font-mono text-[12px] space-y-0.5">
              {s.log.map((r) => {
                const isLive = live.get(r.key) === r.offset;
                const isHit = s.hit === r.offset;
                const isScanned = s.scanned.includes(r.offset);
                return (
                  <li
                    key={r.offset}
                    className={`flex gap-3 px-1 ${isHit ? "bg-neon-1 text-surface" : isScanned ? "bg-surface-2" : ""} ${!isLive && !isHit ? "line-through text-ink-3" : ""}`}
                  >
                    <span className={`w-8 text-right ${isHit ? "" : "text-ink-2"}`}>{r.offset}</span>
                    <span>
                      {r.key},{r.value}
                    </span>
                    {!isLive && <span className="ml-auto text-[10px] uppercase">overwritten</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div className={`bg-surface p-3 ${s.index ? "" : "bg-surface-2"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Hash map in RAM</span>
            <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${s.index ? "text-ink-2" : "text-bad"}`}>
              {s.index ? `${s.index.size} keys · key → offset` : "lost on restart"}
            </span>
          </div>
          {s.index && s.index.size > 0 ? (
            <ul className="font-mono text-[12px] space-y-0.5">
              {[...s.index.entries()]
                .sort((a, b) => a[1] - b[1])
                .map(([k, off]) => (
                  <li key={k} className={`flex gap-3 px-1 ${s.hit === off ? "bg-neon-1 text-surface" : s.scanned.includes(off) ? "bg-surface-2" : ""}`}>
                    <span className="w-8">{k}</span>
                    <span>→ {off}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="font-mono text-[12px] text-ink-3">{s.index ? "(empty)" : "(nothing: the map was never on disk)"}</p>
          )}
          <p className="mt-3 text-[12px] text-ink-2 leading-relaxed">{s.message}</p>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        This is Bitcask, the storage engine of Riak. Writes are one append; reads are one probe and one seek. The
        price is the four limits the chapter lists: dead values pile up until compaction, the map must fit in RAM,
        it is rebuilt by scanning after a restart, and a range query degenerates into one lookup per key. Sorting
        the keys (SSTable) fixes the last two.
      </p>
    </div>
  );
}
