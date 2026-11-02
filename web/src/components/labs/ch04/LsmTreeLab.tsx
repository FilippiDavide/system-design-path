"use client";

import { useState } from "react";

const KEYS = ["apple", "banana", "cherry", "date", "fig", "grape", "kiwi", "lemon"];
const TOMB = "†"; // tombstone marker
const THRESHOLD = 4;
const BITS = 16;

type Entry = [string, string];

interface Segment {
  id: number;
  entries: Entry[];
  bloom: number;
}

/** Two cheap hash functions into a 16-bit array. */
function hashes(key: string): [number, number] {
  let a = 7;
  let b = 3;
  for (let i = 0; i < key.length; i++) {
    a = (a * 31 + key.charCodeAt(i)) % 1000003;
    b = (b * 17 + key.charCodeAt(i) * 7) % 1000003;
  }
  return [a % BITS, (b + 5) % BITS];
}

function bloomOf(entries: Entry[]): number {
  let bits = 0;
  for (const [k] of entries) for (const h of hashes(k)) bits |= 1 << h;
  return bits;
}

const maybeHas = (bloom: number, key: string) => hashes(key).every((h) => (bloom >> h) & 1);

interface Trace {
  key: string;
  steps: { where: string; what: string; kind: "hit" | "miss" | "skip" | "fp" }[];
  result: string;
}

interface State {
  memtable: Map<string, string>;
  log: number;
  segments: Segment[];
  nextId: number;
  counter: number;
  trace: Trace | null;
  note: string;
}

const START: State = {
  memtable: new Map(),
  log: 0,
  segments: [],
  nextId: 1,
  counter: 0,
  trace: null,
  note: "Put a few keys. The memtable flushes to a sorted segment when it holds 4 entries.",
};

function flush(p: State): State {
  if (p.memtable.size === 0) return p;
  const entries = [...p.memtable.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const seg = { id: p.nextId, entries, bloom: bloomOf(entries) };
  return {
    ...p,
    memtable: new Map(),
    log: 0,
    segments: [seg, ...p.segments],
    nextId: p.nextId + 1,
    note: `Memtable written in one sequential pass as segment #${seg.id} (${entries.length} keys, sorted). The crash log is discarded: everything in it is now on disk.`,
  };
}

/**
 * Hand-driven LSM-tree: a memtable that flushes to immutable sorted
 * segments, background compaction, and a read that walks the memtable
 * and then the segments newest first, skipping any whose Bloom filter
 * says "definitely not".
 */
export function LsmTreeLab() {
  const [s, setS] = useState<State>(START);
  const [key, setKey] = useState("cherry");

  const put = (k: string, v: string, label: string) => {
    setS((p) => {
      const memtable = new Map(p.memtable);
      memtable.set(k, v);
      const next = { ...p, memtable, log: p.log + 1, counter: p.counter + 1, trace: null, note: label };
      return memtable.size >= THRESHOLD ? flush(next) : next;
    });
  };

  const putNext = () => {
    const k = KEYS[s.counter % KEYS.length];
    const v = `v${s.counter + 1}`;
    put(k, v, `put(${k}, ${v}): appended to the log on disk and inserted in the sorted memtable. No segment was touched.`);
  };

  const del = () => put(key, TOMB, `delete(${key}): nothing is erased. A tombstone is written like any other value; it wins over older copies during reads and merges.`);

  const compact = () => {
    setS((p) => {
      if (p.segments.length < 2) return { ...p, note: "Nothing to merge: fewer than two segments." };
      // Newest first: the first value seen for a key is the one to keep.
      const latest = new Map<string, string>();
      for (const seg of p.segments) for (const [k, v] of seg.entries) if (!latest.has(k)) latest.set(k, v);
      const dropped = [...latest.entries()].filter(([, v]) => v === TOMB).length;
      const entries = [...latest.entries()].filter(([, v]) => v !== TOMB).sort((a, b) => a[0].localeCompare(b[0]));
      const before = p.segments.reduce((a, x) => a + x.entries.length, 0);
      const seg = { id: p.nextId, entries, bloom: bloomOf(entries) };
      return {
        ...p,
        segments: [seg],
        nextId: p.nextId + 1,
        trace: null,
        note: `Merged ${p.segments.length} segments into #${seg.id} like a mergesort: ${before} records became ${entries.length}; overwritten values${dropped ? ` and ${dropped} tombstoned key${dropped > 1 ? "s" : ""}` : ""} were thrown away. Reads were never blocked.`,
      };
    });
  };

  const get = () => {
    setS((p) => {
      const steps: Trace["steps"] = [];
      let result = "";
      const mv = p.memtable.get(key);
      if (mv !== undefined) {
        steps.push({ where: "memtable", what: mv === TOMB ? "tombstone → not found" : `found ${mv}`, kind: "hit" });
        result = mv === TOMB ? "not found (deleted)" : mv;
      } else {
        steps.push({ where: "memtable", what: "no entry", kind: "miss" });
        for (const seg of p.segments) {
          if (!maybeHas(seg.bloom, key)) {
            steps.push({ where: `segment #${seg.id}`, what: "Bloom says no → skipped, no disk read", kind: "skip" });
            continue;
          }
          const e = seg.entries.find(([k]) => k === key);
          if (e) {
            steps.push({ where: `segment #${seg.id}`, what: e[1] === TOMB ? "tombstone → not found" : `found ${e[1]}`, kind: "hit" });
            result = e[1] === TOMB ? "not found (deleted)" : e[1];
            break;
          }
          steps.push({ where: `segment #${seg.id}`, what: "Bloom said maybe, read it: not there (false positive)", kind: "fp" });
        }
        if (!result) result = "not found";
      }
      return { ...p, trace: { key, steps, result }, note: `get(${key}) = ${result}. Newest copy wins; the walk stops at the first hit.` };
    });
  };

  const qh = hashes(key);
  const memSorted = [...s.memtable.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={putNext} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Put next
        </button>
        <button type="button" onClick={() => setS((p) => flush(p))} disabled={s.memtable.size === 0} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Flush
        </button>
        <button type="button" onClick={compact} disabled={s.segments.length < 2} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Compact
        </button>
        <label className="flex items-center gap-2">
          <select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Key to read or delete" className="border border-line-soft bg-surface px-2 py-1 font-mono text-[11px] uppercase">
            {[...KEYS, "mango"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button type="button" onClick={get} className="border border-line-soft px-3 py-1.5 hover:border-ink">
            Get
          </button>
          <button type="button" onClick={del} className="border border-line-soft px-3 py-1.5 hover:border-ink">
            Delete
          </button>
        </label>
        <button type="button" onClick={() => setS(START)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_1.4fr] gap-px bg-line-soft">
        <div className="bg-surface p-3" style={{ boxShadow: "inset 4px 0 0 var(--neon-1)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Memtable</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
              {s.memtable.size}/{THRESHOLD} · log {s.log} rec
            </span>
          </div>
          {memSorted.length === 0 ? (
            <p className="font-mono text-[12px] text-ink-3">(empty)</p>
          ) : (
            <ul className="font-mono text-[12px] space-y-0.5">
              {memSorted.map(([k, v]) => (
                <li key={k} className={`flex justify-between px-1 ${s.trace?.key === k && s.trace.steps[0].kind === "hit" ? "bg-neon-1 text-surface" : ""}`}>
                  <span>{k}</span>
                  <span className={v === TOMB ? "text-bad" : ""}>{v === TOMB ? "tombstone" : v}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex h-1.5 gap-px">
            {Array.from({ length: THRESHOLD }, (_, i) => (
              <span key={i} className={`flex-1 ${i < s.memtable.size ? "bg-neon-1" : "bg-line-soft"}`} />
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-2 leading-relaxed">{s.note}</p>
        </div>

        <div className="bg-surface p-3" style={{ boxShadow: "inset 4px 0 0 var(--neon-2)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Segments on disk</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">newest first · immutable</span>
          </div>
          {s.segments.length === 0 ? (
            <p className="font-mono text-[12px] text-ink-3">(none yet)</p>
          ) : (
            <ul className="space-y-2">
              {s.segments.map((seg) => {
                const st = s.trace?.steps.find((x) => x.where === `segment #${seg.id}`);
                const tone = st?.kind === "hit" ? "border-neon-1" : st?.kind === "skip" ? "border-line-soft opacity-50" : st?.kind === "fp" ? "border-warn" : "border-line-soft";
                return (
                  <li key={seg.id} className={`border px-2 py-1.5 ${tone}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] w-12">#{seg.id}</span>
                      <span className="flex gap-px" aria-label={`Bloom filter of segment ${seg.id}`}>
                        {Array.from({ length: BITS }, (_, b) => {
                          const set = (seg.bloom >> b) & 1;
                          const probed = s.trace && qh.includes(b);
                          return (
                            <span
                              key={b}
                              className={`w-2.5 h-2.5 border ${probed ? (set ? "border-neon-3 bg-neon-3" : "border-bad bg-bad") : set ? "border-ink bg-ink" : "border-line-soft"}`}
                            />
                          );
                        })}
                      </span>
                      <span className="font-mono text-[10px] text-ink-2">{seg.entries.length} keys</span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] break-words">
                      {seg.entries.map(([k, v], i) => (
                        <span key={k} className={`${s.trace?.key === k && st?.kind === "hit" ? "bg-neon-1 text-surface" : ""} ${v === TOMB ? "text-bad" : ""}`}>
                          {k}={v === TOMB ? "†" : v}
                          {i < seg.entries.length - 1 ? "  " : ""}
                        </span>
                      ))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          {s.trace && (
            <ol className="mt-3 border-t border-line-soft pt-2 font-mono text-[11px] space-y-0.5">
              <li className="text-ink-2 uppercase tracking-[0.12em] text-[10px]">
                get({s.trace.key}) · bits {qh[0]} and {qh[1]}
              </li>
              {s.trace.steps.map((st, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-24 shrink-0 text-ink-2">{st.where}</span>
                  <span className={st.kind === "hit" ? "text-neon-1" : st.kind === "fp" ? "text-warn" : st.kind === "skip" ? "text-ink-3" : ""}>{st.what}</span>
                </li>
              ))}
              <li className="font-semibold">→ {s.trace.result}</li>
            </ol>
          )}
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Keep putting until you have three or four segments, then get a key that was written early, delete it,
        and get it again: the tombstone in the newest segment hides the old value. Get &ldquo;mango&rdquo;, never written: the
        Bloom filters (16 bits, 2 hashes) let most segments be skipped without a disk read, and the occasional
        orange one is a false positive, a wasted read but never a wrong answer. Compact and watch the tombstone
        and the old versions disappear.
      </p>
    </div>
  );
}
