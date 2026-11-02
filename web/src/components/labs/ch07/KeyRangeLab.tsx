"use client";

import { useState } from "react";
import { Canvas, Label } from "@/components/diagrams/primitives";
import { fnv } from "./hash";

type Scheme = "range" | "hash" | "compound";
type Action = "burst" | "march" | "sensorB";

const SENSORS = ["A", "B", "C", "D"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Reading {
  sensor: number;
  month: number;
  burst?: boolean;
}

/** The stored history: one reading per sensor per month. */
const STORED: Reading[] = MONTHS.flatMap((_, m) => SENSORS.map((_, s) => ({ sensor: s, month: m })));

/** Today's writes: every sensor reports twice, all in December. */
const BURST: Reading[] = SENSORS.flatMap((_, s) => [
  { sensor: s, month: 11, burst: true },
  { sensor: s, month: 11, burst: true },
]);

const SCHEMES: Record<Scheme, { name: string; key: string; shardLabel: (i: number) => string }> = {
  range: { name: "Key range · timestamp", key: "timestamp:sensor", shardLabel: (i) => ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"][i] },
  hash: { name: "Hash of key", key: "hash(timestamp:sensor)", shardLabel: (i) => `hash % 4 = ${i}` },
  compound: { name: "Key range · sensor + timestamp", key: "sensor:timestamp", shardLabel: (i) => `sensor ${SENSORS[i]}` },
};

/** Which shard a reading lands on under each scheme. */
function shardOf(r: Reading, scheme: Scheme, seq: number): number {
  if (scheme === "range") return Math.floor(r.month / 3);
  if (scheme === "compound") return r.sensor;
  return fnv(`2024-${r.month + 1}-${seq}:${SENSORS[r.sensor]}`) % 4;
}

/** Shards a query must touch under each scheme. */
function touched(action: Action, scheme: Scheme): number[] {
  if (action === "burst") return [];
  if (scheme === "hash") return [0, 1, 2, 3];
  if (action === "march") return scheme === "range" ? [0] : [0, 1, 2, 3];
  // sensor B, March to May
  return scheme === "range" ? [0, 1] : [1];
}

const QUERY_NOTE: Record<Action, Record<Scheme, string>> = {
  burst: {
    range: "All of today's readings have nearby keys, so they all land in the Oct–Dec shard: one shard takes every write while three sit idle. This is the hot spot.",
    hash: "The same eight writes scatter across the shards: hashing destroys the proximity that caused the hot spot.",
    compound: "The sensor id comes first, so today's writes spread over the four sensor shards, and inside each shard they stay sorted by time.",
  },
  march: {
    range: "March is a contiguous range of keys: one shard, one sequential scan. This is what key-range sharding is for.",
    hash: "March readings are scattered everywhere, so the range query becomes four scans, one per shard, and a merge.",
    compound: "The partition key is the sensor, so 'all sensors in March' is one range query per sensor: four shards, four scans.",
  },
  sensorB: {
    range: "March to May spans two quarters: two shards, and each scan also has to skip the other sensors' readings.",
    hash: "Nothing is ordered: every shard must be asked.",
    compound: "Sensor B is one shard and Mar–May is one sorted range inside it: a single scan. This is the pattern the chapter recommends.",
  },
};

/**
 * Key-range vs hash sharding for a sensor table. Toggle the scheme,
 * then write today's readings (hot spot) or run range queries (shards
 * touched) and see what each scheme makes cheap and what it makes dear.
 */
export function KeyRangeLab() {
  const [scheme, setScheme] = useState<Scheme>("range");
  const [action, setAction] = useState<Action | null>(null);

  const stored = STORED.map((r, i) => ({ ...r, shard: shardOf(r, scheme, i) }));
  const burst = action === "burst" ? BURST.map((r, i) => ({ ...r, shard: shardOf(r, scheme, 100 + i) })) : [];
  const hits = action ? touched(action, scheme) : [];
  const perShard = [0, 1, 2, 3].map((s) => ({
    stored: stored.filter((r) => r.shard === s),
    burst: burst.filter((r) => r.shard === s),
    hit: hits.includes(s),
  }));
  const maxBurst = Math.max(0, ...perShard.map((p) => p.burst.length));
  const hot = action === "burst" && maxBurst >= 6;

  const btn = (active: boolean) =>
    `px-3 py-1.5 border ${active ? "bg-ink text-surface border-ink" : "border-line-soft hover:border-ink"}`;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-ink-2 mr-1">key</span>
        {(Object.keys(SCHEMES) as Scheme[]).map((s) => (
          <button key={s} type="button" aria-pressed={scheme === s} onClick={() => setScheme(s)} className={btn(scheme === s)}>
            {SCHEMES[s].name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" aria-pressed={action === "burst"} onClick={() => setAction("burst")} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface aria-pressed:bg-ink aria-pressed:text-surface">
          Write today&apos;s readings
        </button>
        <button type="button" aria-pressed={action === "march"} onClick={() => setAction("march")} className={btn(action === "march")}>
          Query: all sensors, March
        </button>
        <button type="button" aria-pressed={action === "sensorB"} onClick={() => setAction("sensorB")} className={btn(action === "sensorB")}>
          Query: sensor B, Mar–May
        </button>
        <button type="button" onClick={() => setAction(null)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink normal-case tracking-normal">
          clear
        </button>
      </div>

      <div className="p-3 bg-grid overflow-x-auto">
        <Canvas w={720} h={236} minWidth={520}>
          <Label x={12} y={16} lines={`partition key: ${SCHEMES[scheme].key}`} size={10} mono upper color="var(--ink-2)" anchor="start" />
          {perShard.map((p, s) => {
            const x = 12 + s * 178;
            const stroke = p.hit ? "var(--neon-1)" : hot && p.burst.length === maxBurst ? "var(--bad)" : "var(--ink)";
            return (
              <g key={s}>
                <rect x={x} y={30} width={166} height={170} fill="#fff" stroke={stroke} strokeWidth={p.hit || stroke === "var(--bad)" ? 2 : 1.5} />
                <Label x={x + 10} y={46} lines={`shard ${s}`} size={12} weight={600} anchor="start" />
                <Label x={x + 156} y={46} lines={SCHEMES[scheme].shardLabel(s)} size={10} mono color="var(--ink-2)" anchor="end" />
                {/* stored readings: one cell each, 8 per row */}
                {p.stored.map((r, i) => (
                  <rect
                    key={`s${i}`}
                    x={x + 10 + (i % 8) * 18}
                    y={60 + Math.floor(i / 8) * 18}
                    width={14}
                    height={14}
                    fill={p.hit ? "var(--neon-1)" : "var(--surface-2)"}
                    fillOpacity={p.hit ? 0.25 : 1}
                    stroke="var(--ink-2)"
                    strokeWidth={1}
                  />
                ))}
                {p.burst.map((r, i) => {
                  const n = p.stored.length + i;
                  return (
                    <rect
                      key={`b${i}`}
                      x={x + 10 + (n % 8) * 18}
                      y={60 + Math.floor(n / 8) * 18}
                      width={14}
                      height={14}
                      fill={stroke === "var(--bad)" ? "var(--bad)" : "var(--neon-5)"}
                      stroke="var(--ink)"
                      strokeWidth={1}
                    />
                  );
                })}
                <Label
                  x={x + 10}
                  y={186}
                  lines={
                    action === "burst"
                      ? `${p.stored.length} stored · +${p.burst.length} writes`
                      : p.hit
                        ? `${p.stored.length} stored · scanned`
                        : `${p.stored.length} stored`
                  }
                  size={10}
                  mono
                  color={p.hit ? "var(--neon-1)" : stroke === "var(--bad)" ? "var(--bad)" : "var(--ink-2)"}
                  anchor="start"
                />
              </g>
            );
          })}
          <Label
            x={360}
            y={222}
            lines={
              action === null
                ? "48 readings · 4 sensors × 12 months · 4 shards"
                : action === "burst"
                  ? hot
                    ? `hot spot: ${maxBurst} of 8 writes on one shard`
                    : `8 writes spread over ${perShard.filter((p) => p.burst.length > 0).length} shards (max ${maxBurst} on one)`
                  : `shards touched: ${hits.length} of 4`
            }
            size={11}
            mono
            color={hot ? "var(--bad)" : action === null ? "var(--ink-2)" : "var(--ink)"}
          />
        </Canvas>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {action
          ? QUERY_NOTE[action][scheme]
          : "Key range keeps nearby keys together: cheap range scans, but time-ordered keys turn every write into a hot spot. Hashing spreads the load and loses the order. Putting the sensor first and the timestamp second is the chapter's compromise."}
      </p>
    </div>
  );
}
