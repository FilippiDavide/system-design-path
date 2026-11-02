"use client";

import { useEffect, useRef, useState } from "react";

const NODES = 12;
const DAYS = 365;
/** Days a faulty node stays down before it is replaced. */
const REPAIR_DAYS = 4;
/** Wall-clock milliseconds per simulated day. */
const DAY_MS = 12;

type DayState = "ok" | "tolerated" | "failure";

interface Year {
  /** Remaining repair days per node, 0 = healthy. */
  down: number[];
  day: number;
  faults: number;
  failureDays: number;
  /** One entry per simulated day. */
  strip: DayState[];
  /** Day on which the correlated bug hit, if any. */
  bugDay: number | null;
}

const EMPTY: Year = { down: Array(NODES).fill(0), day: 0, faults: 0, failureDays: 0, strip: [], bugDay: null };

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fault-tolerance lab. Twelve nodes fault independently at a chosen
 * annual rate; the system tolerates up to k of them at once. Run a
 * year and count the days the service was down, then switch on the
 * correlated software bug and see why no k saves you from it.
 */
export function FaultToleranceLab() {
  const [rate, setRate] = useState(25); // % per node per year
  const [k, setK] = useState(1);
  const [bug, setBug] = useState(false);
  const [year, setYear] = useState<Year>(EMPTY);
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(1);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    },
    [],
  );

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setRunning(false);
  };

  const run = () => {
    stop();
    const r = rng(seed * 2654435761);
    const bugDay = bug ? 40 + Math.floor(r() * 300) : null;
    const pDay = rate / 100 / DAYS;
    let day = 0;
    setSeed((s) => s + 1);
    setYear({ ...EMPTY, down: Array(NODES).fill(0), strip: [] });
    setRunning(true);
    timer.current = window.setInterval(() => {
      day += 1;
      if (day > DAYS) {
        stop();
        return;
      }
      // Random draws happen here, outside the updater, so the updater
      // stays pure (React may call it twice in development).
      const hit = bugDay === day;
      const draws = Array.from({ length: NODES }, () => r() < pDay);
      setYear((y) => {
        let faults = y.faults;
        const down = y.down.map((d, i) => {
          if (hit) return 1; // the dormant bug wakes up on every node at once
          if (d > 0) return d - 1;
          if (draws[i]) {
            faults++;
            return REPAIR_DAYS;
          }
          return 0;
        });
        if (hit) faults += NODES;
        const active = down.filter((d) => d > 0).length;
        const state: DayState = active === 0 ? "ok" : active <= k ? "tolerated" : "failure";
        return {
          down,
          day,
          faults,
          failureDays: y.failureDays + (state === "failure" ? 1 : 0),
          strip: [...y.strip, state],
          bugDay: hit ? day : y.bugDay,
        };
      });
    }, DAY_MS);
  };

  const active = year.down.filter((d) => d > 0).length;
  const availability = year.day > 0 ? ((year.day - year.failureDays) / year.day) * 100 : 100;
  const expected = (NODES * rate) / 100;
  const W = 730;
  const colorOf = (s: DayState) => (s === "ok" ? "var(--ok)" : s === "tolerated" ? "var(--warn)" : "var(--bad)");

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={run} disabled={running} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Run a year
        </button>
        <label className="flex items-center gap-2">
          fault rate
          <input type="range" min={5} max={100} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-20 accent-black" aria-label="Annual fault rate per node in percent" />
          <span className="font-dot text-sm w-14">{rate}%/yr</span>
        </label>
        <label className="flex items-center gap-2">
          tolerates
          <input type="range" min={0} max={3} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-16 accent-black" aria-label="Simultaneous faults tolerated" />
          <span className="font-dot text-sm w-16">{k} of {NODES}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={bug} onChange={(e) => setBug(e.target.checked)} className="accent-black" />
          correlated bug
        </label>
      </div>

      <div className="grid md:grid-cols-[1fr_2fr] gap-px bg-line-soft">
        <div className="bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
            {NODES} nodes · day {year.day} of {DAYS}
          </p>
          <div className="mt-2 grid grid-cols-6 gap-1.5" aria-label="Cluster nodes">
            {year.down.map((d, i) => (
              <span
                key={i}
                className="h-8 border border-ink flex items-center justify-center font-mono text-[10px]"
                style={{ background: d > 0 ? "var(--bad)" : "transparent", color: d > 0 ? "#fff" : "var(--ink-2)" }}
              >
                {d > 0 ? `${d}d` : i + 1}
              </span>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px]">
            {active === 0 ? (
              <span className="text-ok">all nodes up</span>
            ) : active <= k ? (
              <span className="text-warn">
                {active} down · tolerated ({k} allowed)
              </span>
            ) : (
              <span className="text-bad">
                {active} down · failure ({k} allowed)
              </span>
            )}
          </p>
        </div>

        <div className="bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">the year, day by day</p>
          <svg viewBox={`0 0 ${W} 44`} width="100%" style={{ display: "block", marginTop: 8 }} role="img" aria-label="Service state per day: green up, orange fault tolerated, red failure">
            <rect x={0} y={0} width={W} height={24} fill="var(--surface-2)" stroke="var(--ink)" strokeWidth={1} />
            {year.strip.map((s, i) =>
              s === "ok" ? null : <rect key={i} x={(i / DAYS) * W} y={0} width={Math.max(2, W / DAYS)} height={24} fill={colorOf(s)} />,
            )}
            {year.bugDay !== null && (
              <text x={Math.min(W - 60, (year.bugDay / DAYS) * W)} y={38} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--bad)">
                ↑ leap second: every node at once
              </text>
            )}
            {year.bugDay === null && (
              <text x={0} y={38} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
                orange = fault tolerated · red = failure
              </text>
            )}
          </svg>
          <div className="grid grid-cols-3 gap-3 mt-3 font-mono text-[11px]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-ink-2">faults</p>
              <p className="font-dot text-xl font-bold">{year.faults}</p>
              <p className="text-ink-2">expected ≈ {expected.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-ink-2">failure days</p>
              <p className="font-dot text-xl font-bold" style={year.failureDays > 0 ? { color: "var(--bad)" } : undefined}>
                {year.failureDays}
              </p>
              <p className="text-ink-2">service down</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-ink-2">availability</p>
              <p className="font-dot text-xl font-bold">{availability.toFixed(1)}%</p>
              <p className="text-ink-2">so far</p>
            </div>
          </div>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Hardware faults are frequent but independent: with &ldquo;tolerates 1&rdquo; two nodes rarely fail in the
        same four days, so the failure days drop to almost zero. Software faults are rare but correlated: every
        node runs the same code, so the 2012 leap-second bug took them all down together, and no amount of
        redundancy covers that. Run a few years with the bug on and compare.
      </p>
    </div>
  );
}
