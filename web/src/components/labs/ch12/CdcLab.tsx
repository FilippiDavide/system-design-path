"use client";

import { useState } from "react";

interface Change {
  off: number;
  key: string;
  /** null is a tombstone. */
  value: string | null;
  /** false once compaction removed this entry. */
  kept: boolean;
}

/** Scripted writes, applied in order by "Write next". */
const SCRIPT: [string, string | null][] = [
  ["u1", "ada"],
  ["u2", "bob"],
  ["u1", "adele"],
  ["u3", "cy"],
  ["u2", null],
  ["u1", "ada m."],
  ["u3", "cyrus"],
  ["u2", "bo"],
  ["u3", null],
  ["u1", "ada"],
];

interface Derived {
  /** Next offset to apply. */
  pos: number;
  /** key -> value, the "cache". */
  byKey: Record<string, string>;
}

const EMPTY: Derived = { pos: 0, byKey: {} };

/** Apply one change to a derived copy. */
function apply(d: Derived, c: Change): Derived {
  const byKey = { ...d.byKey };
  if (c.value === null) delete byKey[c.key];
  else byKey[c.key] = c.value;
  return { pos: c.off + 1, byKey };
}

/** First kept entry at or after the consumer's position. */
const nextFor = (log: Change[], d: Derived) => log.find((c) => c.kept && c.off >= d.pos);

/**
 * Change data capture in miniature. Writes go to the database only;
 * every write is appended to a change log; a cache and a search index
 * are consumers of that log that the reader advances by hand. Compact
 * the log and rebuild a consumer from offset 0 to see why a compacted
 * topic replaces the initial snapshot.
 */
export function CdcLab() {
  const [db, setDb] = useState<Record<string, string>>({});
  const [log, setLog] = useState<Change[]>([]);
  const [step, setStep] = useState(0);
  const [cache, setCache] = useState<Derived>(EMPTY);
  const [index, setIndex] = useState<Derived>(EMPTY);
  const [note, setNote] = useState("Write to the database. Nothing else is written directly: the copies follow the log.");

  const write = () => {
    const [key, value] = SCRIPT[step % SCRIPT.length];
    const next = { ...db };
    if (value === null) delete next[key];
    else next[key] = value;
    setDb(next);
    const off = log.length;
    setLog([...log, { off, key, value, kept: true }]);
    setStep(step + 1);
    setNote(
      value === null
        ? `DELETE ${key}: the database removes the row and the log gets a tombstone at offset ${off}.`
        : `${key} = "${value}" committed by the database, then appended to the change log at offset ${off}. The database chose the order; consumers will apply it in that order.`,
    );
  };

  const advance = (which: "cache" | "index") => {
    const d = which === "cache" ? cache : index;
    const c = nextFor(log, d);
    if (!c) return;
    const nd = apply(d, c);
    if (which === "cache") setCache(nd);
    else setIndex(nd);
    setNote(
      `${which} applied offset ${c.off} (${c.key} ${c.value === null ? "deleted" : `= "${c.value}"`}) and moved to offset ${nd.pos}. A slow consumer does not slow the database down.`,
    );
  };

  const compact = () => {
    const latest = new Map<string, number>();
    log.forEach((c) => latest.set(c.key, c.off));
    const removed = log.filter((c) => c.kept && latest.get(c.key) !== c.off).length;
    setLog(log.map((c) => ({ ...c, kept: latest.get(c.key) === c.off })));
    setNote(
      `Compaction removed ${removed} superseded entr${removed === 1 ? "y" : "ies"}: only the latest value per key survives, tombstones included. Size now depends on the database's contents, not on its history.`,
    );
  };

  const rebuild = (which: "cache" | "index") => {
    if (which === "cache") setCache(EMPTY);
    else setIndex(EMPTY);
    setNote(`${which} dropped and reset to offset 0. Apply the log from the start: no snapshot of the database needed.`);
  };

  const reset = () => {
    setDb({});
    setLog([]);
    setStep(0);
    setCache(EMPTY);
    setIndex(EMPTY);
    setNote("Write to the database. Nothing else is written directly: the copies follow the log.");
  };

  const sameAsDb = (d: Derived) => {
    const a = Object.keys(db).sort();
    const b = Object.keys(d.byKey).sort();
    return a.length === b.length && a.every((k, i) => k === b[i] && db[k] === d.byKey[k]);
  };
  const kept = log.filter((c) => c.kept).length;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={write} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Write to DB
        </button>
        <button type="button" onClick={() => advance("cache")} disabled={!nextFor(log, cache)} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Cache: apply next
        </button>
        <button type="button" onClick={() => advance("index")} disabled={!nextFor(log, index)} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Index: apply next
        </button>
        <button type="button" onClick={compact} disabled={log.length === 0} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Compact log
        </button>
        <button type="button" onClick={() => rebuild("index")} disabled={log.length === 0} className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad disabled:opacity-40">
          Drop index
        </button>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink normal-case tracking-normal">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_1fr] gap-px bg-line-soft">
        <div className="grid grid-rows-[auto_1fr] gap-px bg-line-soft min-w-0">
          <Panel title="Database" tag="leader · system of record" accent="var(--neon-1)">
            <Rows rows={db} />
          </Panel>
          <Panel title="Change log" tag={`${kept} of ${log.length} entries kept`} accent="var(--neon-2)">
            {log.length === 0 ? (
              <p className="font-mono text-[11px] text-ink-3">empty</p>
            ) : (
              <ol className="flex flex-wrap gap-1">
                {log.map((c) => (
                  <li
                    key={c.off}
                    className={`border px-1.5 py-0.5 font-mono text-[11px] ${
                      !c.kept ? "border-dashed border-line-soft text-ink-3 line-through" : c.value === null ? "border-bad text-bad" : "border-ink"
                    }`}
                  >
                    <span className="text-ink-3">{c.off} </span>
                    {c.key}
                    {c.value === null ? " ✕" : `=${c.value}`}
                  </li>
                ))}
              </ol>
            )}
            <p className="font-mono text-[10px] text-ink-2 mt-2">
              cache @{cache.pos} · index @{index.pos}
            </p>
          </Panel>
        </div>

        <div className="grid grid-rows-2 gap-px bg-line-soft min-w-0">
          <Panel title="Cache" tag="key → value" synced={sameAsDb(cache)} behind={!!nextFor(log, cache)}>
            <Rows rows={cache.byKey} />
          </Panel>
          <Panel title="Search index" tag="name → key" synced={sameAsDb(index)} behind={!!nextFor(log, index)}>
            {Object.keys(index.byKey).length === 0 ? (
              <p className="font-mono text-[11px] text-ink-3">empty</p>
            ) : (
              <ul className="font-mono text-[12px] space-y-0.5">
                {Object.entries(index.byKey)
                  .sort((a, b) => a[1].localeCompare(b[1]))
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span>&quot;{v}&quot;</span>
                      <span className="text-ink-2">→ {k}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <p className="px-3 py-2 text-[12px] border-t border-line-soft">{note}</p>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Write several times to the same key, compact, then drop the index and replay from offset 0: the
        compacted log is shorter but rebuilds the same state as the database, because every change carries the
        full new value of its row. That is why CDC with primary keys needs no initial snapshot, and why event
        sourcing, whose events are intentions rather than values, cannot be compacted this way.
      </p>
    </div>
  );
}

function Rows({ rows }: { rows: Record<string, string> }) {
  const keys = Object.keys(rows).sort();
  if (keys.length === 0) return <p className="font-mono text-[11px] text-ink-3">empty</p>;
  return (
    <ul className="font-mono text-[12px] space-y-0.5">
      {keys.map((k) => (
        <li key={k} className="flex justify-between">
          <span>{k}</span>
          <span>{rows[k]}</span>
        </li>
      ))}
    </ul>
  );
}

function Panel({
  title,
  tag,
  accent,
  synced,
  behind,
  children,
}: {
  title: string;
  tag: string;
  accent?: string;
  synced?: boolean;
  behind?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface p-3 min-h-[86px]" style={accent ? { boxShadow: `inset 4px 0 0 ${accent}` } : undefined}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-semibold text-sm">{title}</span>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
          {synced !== undefined &&
            (behind ? (
              <span className="text-warn flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-warn" /> behind
              </span>
            ) : synced ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" /> same as DB
              </span>
            ) : (
              <span className="text-bad flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-bad" /> differs
              </span>
            ))}
          <span className="hidden sm:inline">· {tag}</span>
        </span>
      </div>
      {children}
    </div>
  );
}
