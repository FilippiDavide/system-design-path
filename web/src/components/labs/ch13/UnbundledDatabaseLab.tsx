"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type Kind = "table" | "search" | "cache" | "analytics";
type Mode = "log" | "dual";

interface Ev {
  seq: number;
  product: string;
  price: number;
}

interface View {
  kind: Kind;
  /** Log mode: how many log entries this consumer has applied. */
  offset: number;
  /** Dual-writes mode: the writes that actually reached this system. */
  applied: Ev[];
  /** Log length when the view was created (bootstrap target). */
  joinedAt: number;
  paused: boolean;
  /** Dual-writes mode: writes that never arrived. */
  lost: number;
}

const PRODUCTS = ["lamp", "desk", "chair", "mug", "rug", "fan"];
const TICK = 350;
const LOSS = 0.3;

const SEED: Ev[] = [
  { seq: 1, product: "lamp", price: 30 },
  { seq: 2, product: "desk", price: 120 },
  { seq: 3, product: "lamp", price: 25 },
];

const KINDS: Record<Kind, { title: string; tag: string; render: (evs: Ev[]) => ReactNode }> = {
  table: {
    title: "OLTP table",
    tag: "latest price by product",
    render: (evs) => {
      const m = new Map<string, number>();
      evs.forEach((e) => m.set(e.product, e.price));
      return [...m.entries()].map(([p, v]) => `${p} ${v}`).join(" · ") || "—";
    },
  },
  search: {
    title: "Search index",
    tag: "sorted product names",
    render: (evs) => [...new Set(evs.map((e) => e.product))].sort().join(" · ") || "—",
  },
  cache: {
    title: "Cache",
    tag: "last 3 writes",
    render: (evs) => evs.slice(-3).map((e) => `#${e.seq} ${e.product}`).join(" · ") || "—",
  },
  analytics: {
    title: "Analytics",
    tag: "COUNT, SUM(price)",
    render: (evs) => (
      <span>
        <span className="font-dot text-xl font-bold">{evs.length}</span>
        <span className="text-ink-3"> writes · </span>
        <span className="font-dot text-xl font-bold">{evs.reduce((a, e) => a + e.price, 0)}</span>
      </span>
    ),
  },
};

const ORDER: Kind[] = ["table", "search", "cache", "analytics"];

function freshViews(kinds: Kind[], log: Ev[]): View[] {
  return kinds.map((kind) => ({ kind, offset: log.length, applied: [...log], joinedAt: 0, paused: false, lost: 0 }));
}

/**
 * The unbundled database. In log mode every derived system is a
 * consumer of one ordered log: add a view and it bootstraps from
 * offset 0, pause one and the log buffers for it, remove one and the
 * others do not notice. In dual-writes mode the application writes to
 * each system directly: a lost write is lost forever and a new system
 * has no history to replay.
 */
export function UnbundledDatabaseLab() {
  const [mode, setMode] = useState<Mode>("log");
  const [log, setLog] = useState<Ev[]>(SEED);
  const [views, setViews] = useState<View[]>(() => freshViews(["table", "search", "cache"], SEED));

  // Consumers catch up one entry per tick; bootstrapping ones go faster.
  useEffect(() => {
    if (mode !== "log") return;
    const t = window.setInterval(() => {
      setViews((vs) =>
        vs.map((v) => {
          if (v.paused || v.offset >= log.length) return v;
          const step = v.offset < v.joinedAt ? 2 : 1;
          return { ...v, offset: Math.min(log.length, v.offset + step) };
        }),
      );
    }, TICK);
    return () => clearInterval(t);
  }, [mode, log.length]);

  const reset = (m: Mode) => {
    setMode(m);
    setLog(SEED);
    setViews(freshViews(["table", "search", "cache"], SEED));
  };

  const write = () => {
    const ev: Ev = {
      seq: log.length + 1,
      product: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
      price: 5 + Math.floor(Math.random() * 120),
    };
    setLog((l) => [...l, ev]);
    if (mode === "dual") {
      // No log: the app writes to each system itself, and some writes fail.
      const fate = views.map((v) => v.paused || Math.random() < LOSS);
      setViews((vs) => vs.map((v, i) => (fate[i] ? { ...v, lost: v.lost + 1 } : { ...v, applied: [...v.applied, ev] })));
    }
  };

  const add = (kind: Kind) =>
    setViews((vs) => [...vs, { kind, offset: 0, applied: [], joinedAt: log.length, paused: false, lost: 0 }]);
  const remove = (kind: Kind) => setViews((vs) => vs.filter((v) => v.kind !== kind));
  const toggle = (kind: Kind) => setViews((vs) => vs.map((v) => (v.kind === kind ? { ...v, paused: !v.paused } : v)));

  const missing = ORDER.filter((k) => !views.some((v) => v.kind === k));

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={write} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Write
        </button>
        <span className="flex gap-px border border-line">
          {(["log", "dual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => mode !== m && reset(m)}
              className={`px-3 py-1.5 ${mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {m === "log" ? "Event log" : "Dual writes"}
            </button>
          ))}
        </span>
        {missing.map((k) => (
          <button key={k} type="button" onClick={() => add(k)} className="border border-line-soft px-3 py-1.5 hover:border-ink">
            + {KINDS[k].title}
          </button>
        ))}
        <button type="button" onClick={() => reset(mode)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-px bg-line-soft">
        <div className="bg-surface p-3" style={{ boxShadow: `inset 4px 0 0 ${mode === "log" ? "var(--neon-1)" : "var(--neon-5)"}` }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-semibold text-sm">{mode === "log" ? "Event log" : "Application"}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
              {mode === "log" ? "total order · the only input" : "writes to each system itself"}
            </span>
          </div>
          <ol className="font-mono text-[12px] space-y-0.5">
            {log.length > 6 && <li className="text-ink-3">… {log.length - 6} earlier</li>}
            {log.slice(-6).map((e) => (
              <li key={e.seq} className="flex justify-between">
                <span>
                  <span className="text-ink-3">#{e.seq}</span> set {e.product}
                </span>
                <span>{e.price}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid sm:grid-cols-2 gap-px bg-line-soft">
          {views.map((v) => {
            const evs = mode === "log" ? log.slice(0, v.offset) : v.applied;
            const behind = log.length - v.offset;
            let status: ReactNode;
            if (v.paused) {
              status = (
                <Status color="var(--bad)">
                  down · {mode === "log" ? `${behind} buffered` : `${v.lost} lost`}
                </Status>
              );
            } else if (mode === "log" && v.offset < v.joinedAt) {
              status = (
                <Status color="var(--neon-5)" pulse>
                  bootstrapping {v.offset}/{log.length}
                </Status>
              );
            } else if (mode === "log" && behind > 0) {
              status = (
                <Status color="var(--neon-5)" pulse>
                  {behind} behind
                </Status>
              );
            } else if (mode === "dual" && (v.lost > 0 || v.joinedAt > 0)) {
              status = (
                <Status color="var(--bad)">
                  diverged · {v.joinedAt > 0 && v.lost === 0 ? "no history" : `${v.lost} lost`}
                </Status>
              );
            } else {
              status = <Status color="var(--ok)">in sync</Status>;
            }
            return (
              <div key={v.kind} className="bg-surface p-3 min-h-[96px] flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm">{KINDS[v.kind].title}</span>
                  {status}
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">{KINDS[v.kind].tag}</p>
                <div className="font-mono text-[12px] flex-1 break-words">{KINDS[v.kind].render(evs)}</div>
                <div className="mt-2 flex gap-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                  <button type="button" aria-pressed={v.paused} onClick={() => toggle(v.kind)} className="underline underline-offset-4 text-ink-2 hover:text-ink">
                    {v.paused ? "restart consumer" : "kill consumer"}
                  </button>
                  <button type="button" onClick={() => remove(v.kind)} className="underline underline-offset-4 text-ink-2 hover:text-bad">
                    remove
                  </button>
                </div>
              </div>
            );
          })}
          {views.length === 0 && (
            <p className="bg-surface p-3 text-[12px] text-ink-2 sm:col-span-2">
              No derived systems. {mode === "log" ? "The log still holds everything; add a view and it rebuilds itself." : "Nothing holds the history now."}
            </p>
          )}
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {mode === "log"
          ? "Every system is a consumer of the same ordered log, which is the only place the app writes. A new view bootstraps by replaying from offset 0 (what CREATE INDEX does); a dead consumer finds its backlog buffered when it restarts; removing one changes nothing for the others. Loose coupling at the system level: a failure stays local."
          : "Dual writes: the app sends each write to each system on its own, with no order and no buffer. A write that fails (30% here) is gone, a dead consumer misses everything that happened while it was down, and a new system cannot bootstrap because no one kept the history. The copies diverge and nothing will ever bring them back."}
      </p>
    </div>
  );
}

function Status({ color, pulse, children }: { color: string; pulse?: boolean; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap" style={{ color }}>
      <span className={`w-1.5 h-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`} style={{ background: color }} />
      {children}
    </span>
  );
}
