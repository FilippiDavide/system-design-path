"use client";

import { useEffect, useState } from "react";

/** Requests the server can finish per simulated second. */
const CAPACITY = 100;
/** Clients give up after this many seconds in the queue. */
const TIMEOUT_S = 3;
/** Load shedding rejects arrivals once the queue would exceed this. */
const QUEUE_CAP = CAPACITY * TIMEOUT_S;
/** Milliseconds of wall-clock time per simulated second. */
const TICK_MS = 250;
const HISTORY = 60;

interface Sim {
  t: number;
  queue: number;
  retries: number;
  arrivals: number;
  served: number;
  timedOut: number;
  rejected: number;
  history: number[];
}

const INITIAL: Sim = { t: 0, queue: 0, retries: 0, arrivals: 0, served: 0, timedOut: 0, rejected: 0, history: [] };

/**
 * One simulated second of a single server with a FIFO queue. Clients
 * whose request would wait longer than the timeout give up and retry
 * next second; the server still processes their abandoned requests.
 */
function step(s: Sim, load: number, backoff: boolean, shedding: boolean): Sim {
  const offered = load + s.retries;
  const accepted = shedding ? Math.min(offered, Math.max(0, QUEUE_CAP - s.queue)) : offered;
  const rejected = offered - accepted;
  // Response time a request accepted now will see: queue ahead / capacity.
  const waitS = (s.queue + accepted) / CAPACITY;
  const timedOut = waitS > TIMEOUT_S ? accepted : 0;
  const queue = Math.max(0, s.queue + accepted - CAPACITY);
  const served = Math.min(s.queue + accepted, CAPACITY);
  // Without backoff every timed-out client retries immediately; with
  // exponential backoff only a quarter of them come back each second.
  const retries = Math.round(backoff ? timedOut * 0.25 : timedOut);
  return {
    t: s.t + 1,
    queue,
    retries,
    arrivals: accepted,
    served,
    timedOut,
    rejected,
    history: [...s.history, queue].slice(-HISTORY),
  };
}

/**
 * Retry-storm simulator. Drive a server with a load slider, hit it
 * with a spike, and watch whether the queue drains once the spike is
 * over. Without countermeasures it does not: the retries alone keep
 * it overloaded, a metastable failure.
 */
export function RetryStormLab() {
  const [sim, setSim] = useState<Sim>(INITIAL);
  const [running, setRunning] = useState(false);
  const [load, setLoad] = useState(70);
  const [backoff, setBackoff] = useState(false);
  const [shedding, setShedding] = useState(false);

  // The interval restarts whenever a parameter changes; the state lives
  // in `sim`, so nothing is lost by restarting it.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setSim((s) => step(s, load, backoff, shedding)), TICK_MS);
    return () => window.clearInterval(id);
  }, [running, load, backoff, shedding]);

  const spike = () => {
    setSim((s) => ({ ...s, queue: s.queue + 450 }));
    setRunning(true);
  };
  const reset = () => {
    setRunning(false);
    setSim(INITIAL);
  };

  const waitS = sim.queue / CAPACITY;
  const status =
    sim.queue === 0 && sim.retries === 0
      ? { key: "healthy", text: "healthy", color: "var(--ok)" }
      : waitS > TIMEOUT_S && load <= CAPACITY
        ? { key: "meta", text: "metastable", color: "var(--bad)" }
        : waitS > TIMEOUT_S
          ? { key: "over", text: "overloaded", color: "var(--bad)" }
          : { key: "queue", text: "queueing", color: "var(--warn)" };

  // Chart geometry.
  const W = 600;
  const H = 150;
  const maxQ = Math.max(QUEUE_CAP * 1.5, ...sim.history);
  const x = (i: number) => (i / (HISTORY - 1)) * W;
  const y = (q: number) => H - (q / maxQ) * (H - 10);
  const line = sim.history.map((q, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(q)}`).join(" ");
  const check = "flex items-center gap-2 cursor-pointer";

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => setRunning((r) => !r)} aria-pressed={running} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          {running ? "Pause" : "Run"}
        </button>
        <button type="button" onClick={spike} className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad">
          Spike +450
        </button>
        <label className="flex items-center gap-2">
          load
          <input type="range" min={20} max={160} step={10} value={load} onChange={(e) => setLoad(Number(e.target.value))} className="w-24 accent-black" aria-label="External load in requests per second" />
          <span className="font-dot text-sm w-14">{load} rps</span>
        </label>
        <label className={check}>
          <input type="checkbox" checked={backoff} onChange={(e) => setBackoff(e.target.checked)} className="accent-black" />
          backoff
        </label>
        <label className={check}>
          <input type="checkbox" checked={shedding} onChange={(e) => setShedding(e.target.checked)} className="accent-black" />
          load shedding
        </label>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink normal-case tracking-normal">
          reset
        </button>
      </div>

      <div className="p-3 sm:p-4 bg-grid">
        <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ display: "block", maxWidth: 720, margin: "0 auto" }} role="img" aria-label="Queue length over the last 60 seconds">
          <line x1={0} y1={y(QUEUE_CAP)} x2={W} y2={y(QUEUE_CAP)} stroke="var(--bad)" strokeWidth={1} strokeDasharray="4 4" />
          <text x={W - 4} y={y(QUEUE_CAP) - 5} textAnchor="end" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--bad)">
            timeout line · queue = {QUEUE_CAP} ({TIMEOUT_S} s wait)
          </text>
          <line x1={0} y1={H} x2={W} y2={H} stroke="var(--ink)" strokeWidth={1.5} />
          {sim.history.length > 1 && <path d={line} fill="none" stroke="var(--ink)" strokeWidth={2} />}
          {sim.history.length > 0 && (
            <circle cx={x(sim.history.length - 1)} cy={y(sim.queue)} r={4} fill={status.color} />
          )}
          <text x={0} y={H + 16} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            queue length · last {HISTORY} s · t = {sim.t} s
          </text>
          <text x={W} y={H + 16} textAnchor="end" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            capacity {CAPACITY} rps
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line-soft border-t border-line-soft font-mono text-[11px]">
        <Tile label="status" value={status.text} color={status.color} />
        <Tile label="response time" value={`${Math.min(99, waitS).toFixed(1)} s`} color={waitS > TIMEOUT_S ? "var(--bad)" : undefined} />
        <Tile label="arrivals/s" value={`${load} + ${sim.retries}`} sub="external + retries" />
        <Tile label="shed this second" value={String(sim.rejected)} sub={shedding ? "rejected early" : "shedding off"} />
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {status.key === "meta"
          ? "External load is below capacity, yet the queue never drains: timed-out clients retry, the server wastes capacity on abandoned requests, and the retries alone keep it above the timeout line. The book calls this a metastable failure; only a restart (reset) or a countermeasure ends it."
          : "Run at 70 rps, then press Spike: the queue jumps past the timeout line, every new arrival times out and comes back as a retry. Then try the same with exponential backoff (client side) or load shedding (server side) and watch the queue drain."}
      </p>
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className="font-dot text-xl font-bold" style={color ? { color } : undefined}>
        {value}
      </p>
      {sub && <p className="text-ink-2">{sub}</p>}
    </div>
  );
}
