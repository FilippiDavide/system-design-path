"use client";

import { useState, type CSSProperties } from "react";
import { fnv } from "./hash";

type Strategy = "mod" | "fixed" | "ring";

const KEYS = Array.from({ length: 60 }, (_, i) => `key-${String(i).padStart(2, "0")}`);
const HASH = KEYS.map(fnv);
const SHARDS = 24;
const TOKENS = 8;
const RING = 4096;
const MIN_NODES = 2;
const MAX_NODES = 6;

const STRATEGY: Record<Strategy, { name: string; note: string }> = {
  mod: {
    name: "hash % N",
    note: "node = hash % N. Change N and the remainder of almost every hash changes with it, so most keys move even though only one node was added or removed.",
  },
  fixed: {
    name: "Fixed shards",
    note: "24 shards, key → shard = hash % 24, never changes. Only the shard → node map moves: a new node takes whole shards from the others until it has its share, which is close to the minimum possible.",
  },
  ring: {
    name: "Consistent hashing",
    note: "Each node owns 8 ranges of the hash space with pseudo-random boundaries. A new node takes a slice from several neighbours; nothing else moves. This is the 'consistent' in consistent hashing: keys tend to stay where they are.",
  },
};

/** Initial shard → node map: round robin. */
function initialMap(n: number): number[] {
  return Array.from({ length: SHARDS }, (_, s) => s % n);
}

/** Give whole shards from the busiest nodes to the new node until it has its share. */
function addNodeFixed(map: number[], n: number): number[] {
  const next = [...map];
  const target = Math.floor(SHARDS / (n + 1));
  const owned = (node: number) => next.filter((x) => x === node).length;
  while (owned(n) < target) {
    let busiest = 0;
    for (let i = 1; i < n; i++) if (owned(i) > owned(busiest)) busiest = i;
    const s = next.lastIndexOf(busiest);
    next[s] = n;
  }
  return next;
}

/** Hand the removed node's shards to the least loaded survivors. */
function removeNodeFixed(map: number[], n: number): number[] {
  const next = [...map];
  const gone = n - 1;
  const owned = (node: number) => next.filter((x) => x === node).length;
  for (let s = 0; s < SHARDS; s++) {
    if (next[s] !== gone) continue;
    let least = 0;
    for (let i = 1; i < gone; i++) if (owned(i) < owned(least)) least = i;
    next[s] = least;
  }
  return next;
}

/** Owner of each key under a strategy. */
function assign(strategy: Strategy, n: number, map: number[]): number[] {
  if (strategy === "mod") return HASH.map((h) => h % n);
  if (strategy === "fixed") return HASH.map((h) => map[h % SHARDS]);
  const tokens: { pos: number; node: number }[] = [];
  for (let node = 0; node < n; node++) {
    for (let v = 0; v < TOKENS; v++) tokens.push({ pos: fnv(`node${node}#${v}`) % RING, node });
  }
  tokens.sort((a, b) => a.pos - b.pos);
  return HASH.map((h) => {
    const pos = h % RING;
    const t = tokens.find((tk) => tk.pos >= pos) ?? tokens[0];
    return t.node;
  });
}

/**
 * Rebalancing simulator: 60 keys on N nodes. Add or remove a node under
 * three strategies and count how many keys have to be copied.
 */
export function RebalanceLab() {
  const [strategy, setStrategy] = useState<Strategy>("mod");
  const [n, setN] = useState(3);
  const [map, setMap] = useState<number[]>(() => initialMap(3));
  const [moved, setMoved] = useState<boolean[]>(() => KEYS.map(() => false));
  const [last, setLast] = useState<string | null>(null);

  const owner = assign(strategy, n, map);
  const movedCount = moved.filter(Boolean).length;

  const change = (delta: 1 | -1) => {
    const next = n + delta;
    if (next < MIN_NODES || next > MAX_NODES) return;
    const nextMap = strategy === "fixed" ? (delta === 1 ? addNodeFixed(map, n) : removeNodeFixed(map, n)) : map;
    const before = owner;
    const after = assign(strategy, next, nextMap);
    setMoved(before.map((b, i) => b !== after[i]));
    setMap(nextMap);
    setN(next);
    setLast(`${n} → ${next} nodes`);
  };

  const pick = (s: Strategy) => {
    setStrategy(s);
    setMap(initialMap(n));
    setMoved(KEYS.map(() => false));
    setLast(null);
  };

  const reset = () => {
    setN(3);
    setMap(initialMap(3));
    setMoved(KEYS.map(() => false));
    setLast(null);
  };

  // The best any scheme can do: on add, 1/N of the keys; on remove, the keys of the node that left.
  const ideal = last ? Math.round(KEYS.length / n) : null;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        {(Object.keys(STRATEGY) as Strategy[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={strategy === s}
            onClick={() => pick(s)}
            className={`px-3 py-1.5 border ${strategy === s ? "bg-ink text-surface border-ink" : "border-line-soft hover:border-ink"}`}
          >
            {STRATEGY[s].name}
          </button>
        ))}
        <span className="w-full sm:w-auto sm:ml-auto flex items-center gap-2">
          <button type="button" onClick={() => change(1)} disabled={n >= MAX_NODES} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
            Add node
          </button>
          <button type="button" onClick={() => change(-1)} disabled={n <= MIN_NODES} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
            Remove node
          </button>
          <button type="button" onClick={reset} className="underline underline-offset-4 text-ink-2 hover:text-ink normal-case tracking-normal">
            reset
          </button>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-line-soft border-b border-line-soft">
        <Stat label="nodes" value={String(n)} />
        <Stat label="keys moved" value={last ? `${movedCount} / ${KEYS.length}` : "–"} bad={last !== null && movedCount > KEYS.length / 2} />
        <Stat label="minimum needed" value={ideal !== null ? `≈ ${ideal}` : "–"} sub={last ?? undefined} />
      </div>

      <div className="p-3 bg-grid">
        {/* One column per node from sm up; on a phone six columns are too narrow, so wrap at three. */}
        <div
          className={`grid gap-2 ${n === 2 ? "grid-cols-2" : "grid-cols-3"} sm:grid-cols-[repeat(var(--n),minmax(0,1fr))]`}
          style={{ "--n": n } as CSSProperties}
        >
          {Array.from({ length: n }, (_, node) => {
            const idx = owner.map((o, i) => (o === node ? i : -1)).filter((i) => i >= 0);
            const arrived = idx.filter((i) => moved[i]).length;
            return (
              <div key={node} className="bg-surface border border-line p-2 min-w-0">
                <div className="flex justify-between items-baseline gap-1 mb-2">
                  <span className="font-semibold text-xs">node {node}</span>
                  <span className="font-mono text-[10px] text-ink-2">{idx.length}</span>
                </div>
                <div className="flex flex-wrap gap-[3px]">
                  {idx.map((i) => (
                    <span
                      key={i}
                      title={KEYS[i]}
                      className="w-2.5 h-2.5 border border-ink-2"
                      style={{ background: moved[i] ? "var(--neon-2)" : "var(--surface-2)" }}
                    />
                  ))}
                </div>
                {strategy === "fixed" && (
                  <p className="mt-2 font-mono text-[10px] text-ink-2 leading-tight">
                    shards {map.map((o, s) => (o === node ? s : -1)).filter((s) => s >= 0).join(" ")}
                  </p>
                )}
                {arrived > 0 && <p className="mt-1 font-mono text-[10px] text-neon-2">+{arrived} moved in</p>}
              </div>
            );
          })}
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {STRATEGY[strategy].note}
        {last && strategy === "mod" && movedCount > KEYS.length / 2 && " Compare with the other two strategies: the same change moves a fraction of the keys."}
      </p>
    </div>
  );
}

function Stat({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className={`font-dot text-2xl font-bold mt-1 ${bad ? "text-bad" : ""}`}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-ink-2">{sub}</p>}
    </div>
  );
}
