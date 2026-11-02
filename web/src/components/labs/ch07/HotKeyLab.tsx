"use client";

import { useState } from "react";
import { Canvas, Label } from "@/components/diagrams/primitives";
import { fnv } from "./hash";

const SHARDS = 8;
const CAPACITY = 500; // writes/s one shard can take
const ORDINARY_KEYS = 120;
const WRITES_PER_ORDINARY_KEY = 10;
const SPLITS = [1, 10, 100] as const;

/** Ordinary traffic: 120 keys, hashed, 10 writes/s each. */
const BASE = Array.from({ length: SHARDS }, () => 0);
for (let i = 0; i < ORDINARY_KEYS; i++) BASE[fnv(`user-${i}`) % SHARDS] += WRITES_PER_ORDINARY_KEY;

/**
 * Hot key simulator: one celebrity post takes a slider's worth of
 * writes per second. Append random digits to the key to spread the
 * writes over 10 or 100 keys and see what reads then cost.
 */
export function HotKeyLab() {
  const [celeb, setCeleb] = useState(1500);
  const [split, setSplit] = useState<(typeof SPLITS)[number]>(1);
  const [reading, setReading] = useState(false);

  // Sub-keys: "post-42" or "post-42#00".."post-42#99", each hashed on its own.
  const subKeys = Array.from({ length: split }, (_, i) => (split === 1 ? "post-42" : `post-42#${String(i).padStart(2, "0")}`));
  const subShard = subKeys.map((k) => fnv(k) % SHARDS);
  const load = [...BASE];
  subShard.forEach((s) => {
    load[s] += celeb / split;
  });
  const readShards = [...new Set(subShard)];
  const hottest = Math.max(...load);
  const hotShards = load.filter((l) => l > CAPACITY).length;
  const avg = load.reduce((a, b) => a + b, 0) / SHARDS;

  const W = 720;
  const H = 230;
  const x0 = 50;
  const barW = 60;
  const gap = 22;
  const yOf = (v: number) => 190 - (Math.min(v, 2000) / 2000) * 160;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <label className="flex items-center gap-2">
          celebrity writes
          <input type="range" min={0} max={3000} step={100} value={celeb} onChange={(e) => setCeleb(Number(e.target.value))} className="w-28 accent-black" aria-label="Writes per second to the hot key" />
          <span className="font-dot text-sm w-14">{celeb}/s</span>
        </label>
        <span className="flex items-center gap-2">
          split key into
          <span className="flex gap-px border border-line">
            {SPLITS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={split === s}
                onClick={() => setSplit(s)}
                className={`px-3 py-1 ${split === s ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
              >
                {s === 1 ? "1 key" : `${s} keys`}
              </button>
            ))}
          </span>
        </span>
        <button
          type="button"
          aria-pressed={reading}
          onClick={() => setReading((r) => !r)}
          className={`px-3 py-1.5 border ${reading ? "bg-ink text-surface border-ink" : "border-ink hover:bg-ink hover:text-surface"}`}
        >
          Read the post
        </button>
      </div>

      <div className="grid grid-cols-3 gap-px bg-line-soft border-b border-line-soft">
        <Stat label="hottest shard" value={`${Math.round(hottest)}/s`} bad={hottest > CAPACITY} sub={`capacity ${CAPACITY}/s · avg ${Math.round(avg)}/s`} />
        <Stat label="shards over capacity" value={String(hotShards)} bad={hotShards > 0} />
        <Stat label="one read costs" value={`${split} key${split > 1 ? "s" : ""}`} sub={`${readShards.length} shard${readShards.length > 1 ? "s" : ""}, then combine`} />
      </div>

      <div className="p-3 bg-grid overflow-x-auto">
        <Canvas w={W} h={H} minWidth={520}>
          <Label x={12} y={16} lines="writes per second, per shard" size={10} mono upper color="var(--ink-2)" anchor="start" />
          <line x1={x0 - 10} y1={yOf(CAPACITY)} x2={W - 10} y2={yOf(CAPACITY)} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="4 4" />
          <Label x={W - 12} y={yOf(CAPACITY) - 9} lines={`capacity ${CAPACITY}/s`} size={10} mono color="var(--ink-2)" anchor="end" />
          {load.map((v, s) => {
            const x = x0 + s * (barW + gap);
            const over = v > CAPACITY;
            const isRead = reading && readShards.includes(s);
            const celebHere = subShard.filter((sh) => sh === s).length;
            return (
              <g key={s}>
                <rect x={x} y={yOf(v)} width={barW} height={190 - yOf(v)} fill={over ? "var(--bad)" : "var(--surface-2)"} stroke={isRead ? "var(--neon-1)" : "var(--ink)"} strokeWidth={isRead ? 2 : 1.5} />
                {celebHere > 0 && (
                  <rect x={x} y={yOf(v)} width={barW} height={Math.max(2, 190 - yOf(v) - (190 - yOf(BASE[s])))} fill={over ? "var(--bad)" : "var(--neon-2)"} fillOpacity={over ? 1 : 0.5} stroke="none" />
                )}
                <Label x={x + barW / 2} y={yOf(v) - 10} lines={v > 2000 ? `${Math.round(v)} ↑` : String(Math.round(v))} size={10} mono color={over ? "var(--bad)" : "var(--ink)"} />
                <Label x={x + barW / 2} y={204} lines={`shard ${s}`} size={10} mono color={isRead ? "var(--neon-1)" : "var(--ink-2)"} />
                {celebHere > 0 && <Label x={x + barW / 2} y={220} lines={`${celebHere} hot key${celebHere > 1 ? "s" : ""}`} size={9} mono color={over ? "var(--bad)" : "var(--neon-2)"} />}
              </g>
            );
          })}
        </Canvas>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {split === 1
          ? "A uniform hash does not give uniform load: the whole celebrity post hashes to one key, one shard. Splitting that key by appending random digits spreads the writes."
          : `The writes are now spread over ${split} keys on ${readShards.length} shards, but a read must fetch all ${split} keys and combine them, and the application has to remember which keys are split and when to merge them back once the post calms down.`}
        {reading && ` Reading the post touches ${readShards.length} shard${readShards.length > 1 ? "s" : ""} (blue).`}
      </p>
    </div>
  );
}

function Stat({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="bg-surface p-3 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className={`font-dot text-2xl font-bold mt-1 ${bad ? "text-bad" : ""}`}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-ink-2 leading-tight">{sub}</p>}
    </div>
  );
}
