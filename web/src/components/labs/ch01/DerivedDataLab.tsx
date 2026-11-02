"use client";

import { useEffect, useRef, useState } from "react";

interface Rec {
  id: number;
  name: string;
  amount: number;
}

const NAMES = ["ada", "bob", "cy", "dee", "eli", "fay", "gus", "hal"];

/**
 * One source of truth, three derived views that lag behind it. Writes
 * go to the source only; the copies catch up after a delay. Corrupt a
 * copy and the only honest fix is to rebuild it from the source.
 */
export function DerivedDataLab() {
  const [source, setSource] = useState<Rec[]>([
    { id: 1, name: "ada", amount: 40 },
    { id: 2, name: "bob", amount: 25 },
  ]);
  const [cache, setCache] = useState<Rec[]>(source.slice(-3));
  const [index, setIndex] = useState<string[]>(["ada", "bob"]);
  const [total, setTotal] = useState(65);
  const [corrupt, setCorrupt] = useState(false);
  const [pending, setPending] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Rebuild every derived view from the source, immediately. */
  const rebuild = (src: Rec[]) => {
    setCache(src.slice(-3));
    setIndex([...new Set(src.map((r) => r.name))].sort());
    setTotal(src.reduce((a, r) => a + r.amount, 0));
    setCorrupt(false);
  };

  const write = () => {
    const rec: Rec = {
      id: source.length + 1,
      name: NAMES[Math.floor(Math.random() * NAMES.length)],
      amount: 5 + Math.floor(Math.random() * 60),
    };
    const next = [...source, rec];
    setSource(next);
    setPending((p) => p + 3);
    // Each derived view catches up on its own schedule.
    const schedule = (ms: number, fn: () => void) => {
      const t = window.setTimeout(() => {
        fn();
        setPending((p) => p - 1);
      }, ms);
      timers.current.push(t);
    };
    schedule(500, () => setCache(next.slice(-3)));
    schedule(1300, () => setIndex([...new Set(next.map((r) => r.name))].sort()));
    schedule(2600, () => setTotal(next.reduce((a, r) => a + r.amount, 0)));
  };

  const cacheStale = pending > 0 && cache[cache.length - 1]?.id !== source[source.length - 1]?.id;
  const indexStale = pending > 0 && index.length !== new Set(source.map((r) => r.name)).size && !index.includes(source[source.length - 1].name);
  const totalStale = total !== source.reduce((a, r) => a + r.amount, 0);

  return (
    <div className="border border-line">
      <div className="flex flex-wrap gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={write} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Write to source
        </button>
        <button
          type="button"
          onClick={() => {
            setCorrupt(true);
            setCache([{ id: 99, name: "??", amount: -1 }]);
          }}
          className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad"
        >
          Corrupt the cache
        </button>
        <button type="button" onClick={() => rebuild(source)} className="border border-line-soft px-3 py-1.5 hover:border-ink">
          Rebuild from source
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_1fr] gap-px bg-line-soft min-w-0">
        <Panel title="System of record" tag="source of truth" accent="var(--neon-1)">
          <ul className="font-mono text-[12px] space-y-0.5">
            {source.slice(-6).map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>
                  #{r.id} {r.name}
                </span>
                <span>{r.amount}</span>
              </li>
            ))}
            {source.length > 6 && <li className="text-ink-3">… {source.length - 6} more</li>}
          </ul>
        </Panel>

        <div className="grid grid-rows-3 gap-px bg-line-soft">
          <Panel title="Cache" tag="last 3 writes · lag 0.5 s" stale={cacheStale} broken={corrupt}>
            <p className="font-mono text-[12px]">
              {cache.map((r) => `#${r.id} ${r.name}`).join(" · ")}
            </p>
          </Panel>
          <Panel title="Index by name" tag="sorted · lag 1.3 s" stale={indexStale}>
            <p className="font-mono text-[12px]">{index.join(" · ")}</p>
          </Panel>
          <Panel title="Warehouse aggregate" tag="SUM(amount) · lag 2.6 s" stale={totalStale}>
            <p className="font-dot text-2xl font-bold">{total}</p>
          </Panel>
        </div>
      </div>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Nobody writes to the copies directly. If a copy disagrees with the source, the source wins by
        definition and the copy gets rebuilt. How to propagate updates reliably is the subject of ch. 11 and 12.
      </p>
    </div>
  );
}

function Panel({
  title,
  tag,
  accent,
  stale,
  broken,
  children,
}: {
  title: string;
  tag: string;
  accent?: string;
  stale?: boolean;
  broken?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface p-3 min-h-[86px]" style={accent ? { boxShadow: `inset 4px 0 0 ${accent}` } : undefined}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-semibold text-sm">{title}</span>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
          {broken ? (
            <span className="text-bad flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-bad" /> corrupt
            </span>
          ) : stale ? (
            <span className="text-neon-5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-5 animate-pulse" /> stale
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-3" /> in sync
            </span>
          )}
          <span className="hidden sm:inline">· {tag}</span>
        </span>
      </div>
      {children}
    </div>
  );
}
