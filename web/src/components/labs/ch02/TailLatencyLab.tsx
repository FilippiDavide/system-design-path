"use client";

import { useMemo, useState } from "react";

const N = 1000;
const BIN_MS = 25;
const MAX_MS = 1000;
const PAGES = 500;

/** Small deterministic PRNG (mulberry32) so a seed always gives the same sample. */
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
 * Draw one backend response time: a skewed body around 40-80 ms plus a
 * small share of slow outliers (GC pauses, page faults, lost packets).
 */
function drawLatency(r: () => number, slowShare: number): number {
  if (r() < slowShare) return 250 + r() * 650;
  // Log-normal-ish body: product of a few uniforms keeps it skewed.
  const body = 30 + 25 * -Math.log(1 - r() * 0.98) + r() * 20;
  return Math.min(MAX_MS, body);
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

/**
 * Latency percentiles lab. A sample of backend response times, its
 * histogram with p50/p95/p99 markers, and a fan-out slider: a page
 * that waits for N backends in parallel is as slow as the slowest one,
 * so its tail is far worse than any single backend's.
 */
export function TailLatencyLab() {
  const [seed, setSeed] = useState(7);
  const [slow, setSlow] = useState(1); // percent of slow backend calls
  const [fanOut, setFanOut] = useState(10);

  const sample = useMemo(() => {
    const r = rng(seed);
    const xs = Array.from({ length: N }, () => drawLatency(r, slow / 100));
    return xs.sort((a, b) => a - b);
  }, [seed, slow]);

  const mean = sample.reduce((a, b) => a + b, 0) / N;
  const p50 = percentile(sample, 50);
  const p95 = percentile(sample, 95);
  const p99 = percentile(sample, 99);

  // Page requests: each takes the max of `fanOut` backend calls.
  const page = useMemo(() => {
    const r = rng(seed * 31 + fanOut);
    const xs = Array.from({ length: PAGES }, () => {
      let m = 0;
      for (let k = 0; k < fanOut; k++) m = Math.max(m, sample[Math.floor(r() * N)]);
      return m;
    }).sort((a, b) => a - b);
    return { p50: percentile(xs, 50), p99: percentile(xs, 99), slowShare: xs.filter((v) => v > p99).length / PAGES };
  }, [seed, fanOut, sample, p99]);

  const pAtLeastOne = 1 - Math.pow(0.99, fanOut);

  // Histogram.
  const bins = Array.from({ length: MAX_MS / BIN_MS }, () => 0);
  for (const v of sample) bins[Math.min(bins.length - 1, Math.floor(v / BIN_MS))]++;
  const maxBin = Math.max(...bins);
  const W = 600;
  const H = 170;
  const PAD = 18;
  const bw = W / bins.length;
  const xOf = (ms: number) => (ms / MAX_MS) * W;
  // Square-root scale so the rare tail bins stay visible next to the body.
  const hOf = (c: number) => (Math.sqrt(c) / Math.sqrt(maxBin)) * (H - PAD);

  // Lines first, labels after (with a white halo), so that a marker line
  // never runs through another marker's label when percentiles are close.
  const markerLine = (ms: number, color: string) => (
    <line x1={xOf(ms)} y1={6} x2={xOf(ms)} y2={H} stroke={color} strokeWidth={1.5} strokeDasharray="3 3" />
  );
  const markerText = (ms: number, label: string, color: string, dy: number) => (
    <text x={xOf(ms) + 4} y={6 + dy} fontFamily="var(--font-jetbrains)" fontSize={10} fill={color} stroke="#fff" strokeWidth={3} paintOrder="stroke">
      {label} {Math.round(ms)} ms
    </text>
  );

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => setSeed((s) => s + 1)} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Send 1,000 requests
        </button>
        <label className="flex items-center gap-2">
          slow calls
          <input type="range" min={0} max={5} step={0.5} value={slow} onChange={(e) => setSlow(Number(e.target.value))} className="w-20 accent-black" aria-label="Share of slow backend calls in percent" />
          <span className="font-dot text-sm w-10">{slow}%</span>
        </label>
        <label className="flex items-center gap-2">
          fan-out
          <input type="range" min={1} max={50} value={fanOut} onChange={(e) => setFanOut(Number(e.target.value))} className="w-24 accent-black" aria-label="Backends called in parallel per page" />
          <span className="font-dot text-sm w-6">{fanOut}</span>
        </label>
      </div>

      <div className="grid md:grid-cols-[3fr_2fr] gap-px bg-line-soft">
        <div className="bg-surface p-3 sm:p-4 bg-grid">
          <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" style={{ display: "block" }} role="img" aria-label="Histogram of backend response times with percentile markers">
            {bins.map((c, i) => (
              <rect key={i} x={i * bw + 0.5} y={H - hOf(c)} width={bw - 1} height={hOf(c)} fill={i * BIN_MS >= p99 ? "var(--neon-2)" : "var(--ink)"} />
            ))}
            <line x1={0} y1={H} x2={W} y2={H} stroke="var(--ink)" strokeWidth={1.5} />
            {markerLine(p50, "var(--neon-1)")}
            {markerLine(p95, "var(--neon-5)")}
            {markerLine(p99, "var(--neon-2)")}
            {markerText(p50, "p50", "var(--neon-1)", 4)}
            {markerText(p95, "p95", "var(--neon-5)", 18)}
            {markerText(p99, "p99", "var(--neon-2)", 32)}
            {[0, 250, 500, 750, 1000].map((ms) => (
              <text key={ms} x={xOf(ms)} y={H + 16} textAnchor={ms === 0 ? "start" : ms === 1000 ? "end" : "middle"} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
                {ms} ms
              </text>
            ))}
            <text x={W - 4} y={14} textAnchor="end" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
              count · sqrt scale
            </text>
          </svg>
        </div>

        <div className="bg-surface p-4 space-y-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[11px]">
            <Stat label="mean" value={`${Math.round(mean)} ms`} />
            <Stat label="p50 · median" value={`${Math.round(p50)} ms`} color="var(--neon-1)" />
            <Stat label="p95" value={`${Math.round(p95)} ms`} color="var(--neon-5)" />
            <Stat label="p99" value={`${Math.round(p99)} ms`} color="var(--neon-2)" />
          </div>
          <div className="border-t border-line-soft pt-3 font-mono text-[11px]">
            <p className="text-[10px] uppercase tracking-[0.12em] text-ink-2">a page waits for {fanOut} backend{fanOut > 1 ? "s" : ""}</p>
            <p className="mt-1">
              P(at least one slower than the backend p99) = 1 − 0.99<sup>{fanOut}</sup> ={" "}
              <span className="font-dot text-base" style={{ color: pAtLeastOne > 0.25 ? "var(--bad)" : undefined }}>
                {Math.round(pAtLeastOne * 100)}%
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Stat label="page p50" value={`${Math.round(page.p50)} ms`} />
              <Stat label="page p99" value={`${Math.round(page.p99)} ms`} color={page.p99 > p99 * 1.2 ? "var(--bad)" : undefined} />
            </div>
            <p className="text-ink-2 mt-2">
              {Math.round(page.slowShare * 100)}% of pages are slower than the backend p99 (simulated over {PAGES} pages).
            </p>
          </div>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        The mean hides the tail; the percentiles show it. With fan-out the user request is as slow as the slowest of
        its backend calls, so even 1% of slow calls turns into a large share of slow pages: tail latency
        amplification. This is why Amazon sets requirements on the p999 and why the backends&rsquo; p99 matters more
        the more services a page touches.
      </p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className="font-dot text-xl font-bold" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}
