"use client";

import { useMemo, useState } from "react";

/** Simulated heartbeats sent to a node that is, in fact, alive. */
const N = 14;
/** Time axis in ms. */
const T_MAX = 1200;
const BASE_RTT = 30;

interface Beat {
  n: number;
  /** Round trip in ms, or null when the packet was dropped. */
  rtt: number | null;
  /** Where on the way the packet was dropped (ms), for the marker. */
  dropAt: number;
}

/** Small deterministic PRNG so the same seed always gives the same run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(seed: number, queue: number, loss: number): Beat[] {
  const rnd = mulberry32(seed * 7919 + 13);
  const out: Beat[] = [];
  for (let i = 0; i < N; i++) {
    const u = rnd();
    const lost = rnd() < loss / 100;
    // Queueing delay: exponential with the chosen mean, which is what a
    // congested switch or a busy CPU looks like from the outside.
    const extra = queue === 0 ? 0 : -queue * Math.log(1 - Math.min(u, 0.9995));
    const rtt = Math.round(BASE_RTT + extra + rnd() * 10);
    out.push({ n: i + 1, rtt: lost ? null : Math.min(rtt, T_MAX), dropAt: 10 + Math.round(rnd() * 60) });
  }
  return out;
}

/**
 * Failure detection with a timeout. The node is alive the whole time;
 * the only things that vary are the queueing delay, the packet loss
 * and the timeout the reader picks. Two consecutive timeouts make the
 * detector declare the node dead, which here is always a false alarm.
 */
export function TimeoutDetectionLab() {
  const [seed, setSeed] = useState(1);
  const [queue, setQueue] = useState(60);
  const [loss, setLoss] = useState(10);
  const [timeout, setTimeout_] = useState(200);
  const [crashAt, setCrashAt] = useState(false);

  const beats = useMemo(() => sample(seed, queue, loss), [seed, queue, loss]);

  // Evaluate the detector for the chosen timeout.
  const rows = beats.map((b) => {
    const crashed = crashAt && b.n >= 9;
    const rtt = crashed ? null : b.rtt;
    const timedOut = rtt === null || rtt > timeout;
    return { ...b, rtt, crashed, timedOut, late: rtt !== null && rtt > timeout };
  });
  let streak = 0;
  const declared: number[] = [];
  let noticedCrashAt: number | null = null;
  rows.forEach((r) => {
    streak = r.timedOut ? streak + 1 : 0;
    if (streak === 2) {
      declared.push(r.n);
      if (r.crashed && noticedCrashAt === null) noticedCrashAt = r.n;
    }
  });
  const falseAlarms = declared.filter((n) => !rows[n - 1].crashed).length;
  const lateReplies = rows.filter((r) => r.late).length;
  const detectMs = 2 * timeout;

  const px = (ms: number) => 120 + (ms / T_MAX) * 620;
  const rowH = 16;
  const top = 34;
  const h = top + N * rowH + 20;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => setSeed((s) => s + 1)} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          New sample
        </button>
        <label className="flex items-center gap-2">
          timeout
          <input type="range" min={50} max={1000} step={10} value={timeout} onChange={(e) => setTimeout_(Number(e.target.value))} className="w-28 accent-black" />
          <span className="font-dot text-sm w-14">{timeout} ms</span>
        </label>
        <label className="flex items-center gap-2">
          queueing
          <input type="range" min={0} max={300} step={10} value={queue} onChange={(e) => setQueue(Number(e.target.value))} className="w-24 accent-black" />
          <span className="font-dot text-sm w-14">{queue} ms</span>
        </label>
        <label className="flex items-center gap-2">
          loss
          <input type="range" min={0} max={50} value={loss} onChange={(e) => setLoss(Number(e.target.value))} className="w-20 accent-black" />
          <span className="font-dot text-sm w-8">{loss}%</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={crashAt} onChange={(e) => setCrashAt(e.target.checked)} className="accent-black" />
          node really crashes at #09
        </label>
      </div>

      <div className="p-3 sm:p-4 bg-grid overflow-x-auto">
        <svg viewBox={`0 0 780 ${h}`} width="100%" style={{ minWidth: 600, maxWidth: 900, display: "block", margin: "0 auto" }} role="img" aria-label="Heartbeat round trips against the timeout">
          {/* axis */}
          {[0, 200, 400, 600, 800, 1000, 1200].map((ms) => (
            <g key={ms}>
              <line x1={px(ms)} y1={top - 6} x2={px(ms)} y2={h - 16} stroke="var(--line-soft)" strokeWidth={1} />
              <text x={px(ms)} y={top - 12} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
                {ms}
              </text>
            </g>
          ))}
          <text x={px(T_MAX)} y={h - 2} textAnchor="end" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            round trip · ms
          </text>

          {/* timeout line */}
          <line x1={px(timeout)} y1={top - 6} x2={px(timeout)} y2={h - 16} stroke="var(--bad)" strokeWidth={1.5} strokeDasharray="5 4" />
          {/* The label flips to the left of the line for long timeouts so it never runs into the axis label. */}
          <text
            x={timeout > 600 ? px(timeout) - 4 : px(timeout) + 4}
            y={h - 2}
            textAnchor={timeout > 600 ? "end" : "start"}
            fontFamily="var(--font-jetbrains)"
            fontSize={10}
            fill="var(--bad)"
          >
            timeout {timeout} ms
          </text>

          {rows.map((r, i) => {
            const y = top + i * rowH + rowH / 2;
            const colour = r.crashed ? "var(--ink-3)" : r.late ? "var(--warn)" : r.rtt === null ? "var(--ink-2)" : "var(--ink)";
            const isDeclared = declared.includes(r.n);
            return (
              <g key={r.n}>
                <text x={16} y={y + 3} fontFamily="var(--font-jetbrains)" fontSize={10} fill={colour}>
                  #{String(r.n).padStart(2, "0")}
                </text>
                <text x={56} y={y + 3} fontFamily="var(--font-jetbrains)" fontSize={10} fill={colour}>
                  {r.crashed ? "crashed" : r.rtt === null ? "lost" : `${r.rtt}`}
                </text>
                {r.rtt !== null ? (
                  <>
                    <line x1={px(0)} y1={y} x2={px(r.rtt)} y2={y} stroke={colour} strokeWidth={r.late ? 3 : 2.5} />
                    <circle cx={px(r.rtt)} cy={y} r={3} fill={colour} />
                  </>
                ) : (
                  <>
                    <line x1={px(0)} y1={y} x2={px(r.dropAt)} y2={y} stroke={colour} strokeWidth={2} />
                    {!r.crashed && (
                      <>
                        <line x1={px(r.dropAt) - 3} y1={y - 3} x2={px(r.dropAt) + 3} y2={y + 3} stroke="var(--bad)" strokeWidth={1.5} />
                        <line x1={px(r.dropAt) + 3} y1={y - 3} x2={px(r.dropAt) - 3} y2={y + 3} stroke="var(--bad)" strokeWidth={1.5} />
                      </>
                    )}
                    <line x1={px(r.dropAt) + 6} y1={y} x2={px(T_MAX)} y2={y} stroke="var(--line-soft)" strokeWidth={1} strokeDasharray="2 3" />
                  </>
                )}
                {isDeclared && (
                  <>
                    {/* White backing so the verdict stays readable over a long bar. */}
                    <rect x={px(T_MAX) - 172} y={y - 7} width={172} height={14} fill="#fff" />
                    <text x={px(T_MAX) - 2} y={y + 3} textAnchor="end" fontFamily="var(--font-jetbrains)" fontSize={10} fontWeight={600} fill={r.crashed ? "var(--ok)" : "var(--bad)"}>
                      {r.crashed ? "declared dead · correct" : "declared dead · false alarm"}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">false alarms</p>
          <p className={`font-dot text-3xl font-bold mt-1 ${falseAlarms > 0 ? "text-bad" : ""}`}>{falseAlarms}</p>
          <p className="text-[12px] text-ink-2 mt-1">live node declared dead after two silent heartbeats</p>
        </div>
        <div className="bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">late replies</p>
          <p className={`font-dot text-3xl font-bold mt-1 ${lateReplies > 0 ? "text-warn" : ""}`}>{lateReplies}</p>
          <p className="text-[12px] text-ink-2 mt-1">arrived after you gave up: whatever was retried ran twice</p>
        </div>
        <div className="bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">time to notice a real crash</p>
          <p className="font-dot text-3xl font-bold mt-1">
            {detectMs}
            <span className="text-ink-3 text-base"> ms</span>
          </p>
          <p className="text-[12px] text-ink-2 mt-1">
            {crashAt
              ? noticedCrashAt
                ? `two timeouts in a row: noticed at heartbeat #${String(noticedCrashAt).padStart(2, "0")}`
                : "the crash was not noticed within this sample"
              : "two timeouts in a row, each as long as the timeout"}
          </p>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Drag the timeout down and the false alarms appear; drag it up and a real crash takes longer to notice,
        and every request in flight waits that long. Raise the queueing delay: the long tail is what a congested
        switch or a busy CPU produces, and no timeout cleans it up. The book&apos;s point: delays are unbounded, so
        there is no right timeout, only one measured from the observed distribution and adapted to it.
      </p>
    </div>
  );
}
