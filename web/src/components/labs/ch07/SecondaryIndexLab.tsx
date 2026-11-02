"use client";

import { useState } from "react";

type Mode = "local" | "global";
type Op = "red" | "redFord" | "write";

interface Car {
  id: number;
  color: string;
  make: string;
}

const CARS: Car[] = [
  { id: 101, color: "red", make: "ford" },
  { id: 142, color: "blue", make: "kia" },
  { id: 215, color: "silver", make: "bmw" },
  { id: 342, color: "red", make: "bmw" },
  { id: 412, color: "silver", make: "kia" },
  { id: 477, color: "black", make: "ford" },
  { id: 520, color: "red", make: "ford" },
  { id: 603, color: "red", make: "tesla" },
  { id: 688, color: "blue", make: "bmw" },
  { id: 780, color: "silver", make: "tesla" },
  { id: 877, color: "blue", make: "ford" },
  { id: 912, color: "black", make: "kia" },
];

const DATA_SHARDS = 4;
const INDEX_SHARDS = [
  { name: "terms a–h", test: (t: string) => t[0] <= "h" },
  { name: "terms i–q", test: (t: string) => t[0] > "h" && t[0] <= "q" },
  { name: "terms r–z", test: (t: string) => t[0] > "q" },
];

const dataShardOf = (id: number) => Math.floor(id / 250);
const indexShardOf = (term: string) => INDEX_SHARDS.findIndex((s) => s.test(term));

const OPS: Record<Op, string> = { red: "read: color = red", redFord: "read: red AND ford", write: "write: 603 red → blue" };

/**
 * Local vs global secondary index. Run a one-term query, a two-term
 * query and a write; count the shards each one touches, and watch an
 * asynchronous global index go stale after the write.
 */
export function SecondaryIndexLab() {
  const [mode, setMode] = useState<Mode>("local");
  const [op, setOp] = useState<Op | null>(null);
  const [async, setAsync] = useState(false);
  const [written, setWritten] = useState(false);
  const [indexLag, setIndexLag] = useState(false);

  const cars = CARS.map((c) => (written && c.id === 603 ? { ...c, color: "blue" } : c));
  // The global index reflects the write only once it has caught up.
  const indexed = indexLag ? CARS : cars;

  const local = mode === "local";
  const terms = op === "red" ? ["red"] : op === "redFord" ? ["red", "ford"] : [];
  const matches = (list: Car[]) => list.filter((c) => terms.every((t) => c.color === t || c.make === t));

  // Shards touched, by role.
  const dataHit = new Set<number>();
  const indexHit = new Set<number>();
  const indexLater = new Set<number>();
  let result: Car[] = [];
  let steps: string[] = [];
  let roundTrips = 0;
  if (op === "write") {
    dataHit.add(dataShardOf(603));
    if (!local) {
      const idx = [indexShardOf("red"), indexShardOf("blue")];
      idx.forEach((i) => (async ? indexLater : indexHit).add(i));
      roundTrips = async ? 1 : 2;
      steps = async
        ? ["1 · data shard 2 updates the record and acks", "2 · index shards r–z (drop red) and a–h (add blue) catch up later"]
        : ["1 · data shard 2 updates the record", "2 · index shard r–z drops 603 from red, a–h adds it to blue", "3 · all three commit together: a distributed transaction"];
    } else {
      roundTrips = 1;
      steps = ["1 · data shard 2 updates the record and its own index entries in one local transaction"];
    }
  } else if (op) {
    if (local) {
      for (let s = 0; s < DATA_SHARDS; s++) dataHit.add(s);
      result = matches(cars);
      roundTrips = 1;
      steps = [`1 · scatter: the query goes to all ${DATA_SHARDS} shards; each one checks its local index${terms.length > 1 ? " and does the AND locally" : ""}`, `2 · gather: ${result.length} hits merged by the coordinator`];
    } else {
      terms.forEach((t) => indexHit.add(indexShardOf(t)));
      const ids = matches(indexed).map((c) => c.id);
      ids.forEach((id) => dataHit.add(dataShardOf(id)));
      result = ids.map((id) => cars.find((c) => c.id === id)!);
      roundTrips = terms.length > 1 ? 3 : 2;
      steps =
        terms.length > 1
          ? [`1 · index shards ${[...indexHit].map((i) => INDEX_SHARDS[i].name.slice(6)).join(" and ")} return the postings lists for red and ford`, "2 · the two lists travel over the network and are intersected", `3 · ${ids.length} records fetched from ${dataHit.size} data shard${dataHit.size === 1 ? "" : "s"}`]
          : [`1 · one index shard (${INDEX_SHARDS[indexShardOf("red")].name}) returns the postings list: ${ids.join(", ")}`, `2 · ${ids.length} records fetched from ${dataHit.size} data shard${dataHit.size === 1 ? "" : "s"}`];
    }
  }
  const touchedCount = dataHit.size + indexHit.size;
  const isWrite = op === "write";
  const hitClass = isWrite ? "border-neon-5" : "border-neon-1";

  const run = (o: Op) => {
    setOp(o);
    if (o === "write") {
      setWritten(true);
      if (!local && async) setIndexLag(true);
    }
  };
  const catchUp = () => setIndexLag(false);
  const reset = () => {
    setOp(null);
    setWritten(false);
    setIndexLag(false);
  };

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line">
          {(["local", "global"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setOp(null);
                setIndexLag(false);
              }}
              className={`px-3 py-1 ${mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {m} index
            </button>
          ))}
        </span>
        <label className={`flex items-center gap-2 cursor-pointer ${local ? "opacity-40" : ""}`}>
          <input type="checkbox" checked={async} disabled={local} onChange={(e) => setAsync(e.target.checked)} className="accent-black" />
          asynchronous index
        </label>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink normal-case tracking-normal">
          reset
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        {(Object.keys(OPS) as Op[]).map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={op === o}
            onClick={() => run(o)}
            disabled={o === "write" && written}
            className={`px-3 py-1.5 border disabled:opacity-40 ${op === o ? "bg-ink text-surface border-ink" : o === "write" ? "border-ink hover:bg-ink hover:text-surface" : "border-line-soft hover:border-ink"}`}
          >
            {OPS[o]}
          </button>
        ))}
        {indexLag && (
          <button type="button" onClick={catchUp} className="px-3 py-1.5 border border-warn text-warn hover:bg-warn hover:text-surface">
            Let the index catch up
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-px bg-line-soft border-b border-line-soft">
        <Stat label="shards touched" value={op ? String(touchedCount) : "–"} sub={op ? `${dataHit.size} data · ${indexHit.size} index${indexLater.size ? ` · ${indexLater.size} later` : ""}` : undefined} />
        <Stat label="round trips" value={op ? String(roundTrips) : "–"} sub={op ? (local && !isWrite ? "in parallel, slowest shard wins" : !local && !isWrite ? "index first, then the records" : local ? "one local transaction" : !async ? "commit across 3 shards" : "index updated later") : undefined} />
        <Stat
          label="result"
          value={isWrite ? "ok" : op ? `${result.length} cars` : "–"}
          bad={!isWrite && op !== null && indexLag && !local && result.some((c) => c.id === 603)}
          sub={!isWrite && op !== null && !local && indexLag ? (result.some((c) => c.id === 603) ? "stale: index still lists 603, now blue" : "index not yet caught up") : op && !isWrite ? result.map((c) => c.id).join(", ") || "none" : undefined}
        />
      </div>

      <div className="p-3 bg-grid space-y-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">data shards · by car id</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: DATA_SHARDS }, (_, s) => {
              const own = cars.filter((c) => dataShardOf(c.id) === s);
              const hit = dataHit.has(s);
              return (
                <div key={s} className={`bg-surface border p-2 min-w-0 ${hit ? `${hitClass} border-2` : "border-line"}`}>
                  <div className="flex justify-between items-baseline gap-1">
                    <span className="font-semibold text-xs">shard {s}</span>
                    <span className="font-mono text-[10px] text-ink-2">
                      {s * 250}–{s * 250 + 249}
                    </span>
                  </div>
                  <ul className="mt-1 font-mono text-[10px] leading-snug">
                    {own.map((c) => {
                      const isHit = !isWrite && result.some((r) => r.id === c.id);
                      const isTarget = isWrite && c.id === 603;
                      return (
                        <li key={c.id} className={isHit ? "text-neon-1" : isTarget ? "text-neon-5" : "text-ink-2"}>
                          {c.id} {c.color} {c.make}
                          {isTarget && " ←"}
                        </li>
                      );
                    })}
                  </ul>
                  {local && (
                    <p className="mt-1 pt-1 border-t border-line-soft font-mono text-[9px] text-ink-2 leading-tight">
                      local index: {[...new Set(own.flatMap((c) => [c.color, c.make]))].sort().join(" ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {!local && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">index shards · by term</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {INDEX_SHARDS.map((sh, i) => {
                const hit = indexHit.has(i);
                const later = indexLater.has(i);
                const termList = [...new Set(indexed.flatMap((c) => [c.color, c.make]))].filter(sh.test).sort();
                return (
                  <div key={sh.name} className={`bg-surface border p-2 min-w-0 ${hit ? `${hitClass} border-2` : later || (indexLag && i !== 1) ? "border-warn border-dashed" : "border-line"}`}>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="font-semibold text-xs">index {i}</span>
                      <span className="font-mono text-[10px] text-ink-2">{sh.name}</span>
                    </div>
                    <ul className="mt-1 font-mono text-[10px] leading-snug text-ink-2">
                      {termList.map((t) => (
                        <li key={t} className={terms.includes(t) ? "text-neon-1" : ""}>
                          {t} → {indexed.filter((c) => c.color === t || c.make === t).map((c) => c.id).join(", ")}
                        </li>
                      ))}
                    </ul>
                    {(later || (indexLag && i !== 1)) && <p className="mt-1 font-mono text-[9px] text-warn">pending: 603 red → blue</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {steps.length > 0 && (
          <ol className="bg-surface border border-line p-2 font-mono text-[11px] leading-relaxed">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {local
          ? "Document-partitioned: each shard indexes only its own records, so a write stays on one shard, but a read that does not know the partition key must ask every shard (scatter/gather). The slowest shard sets the latency, and adding shards does not raise query throughput."
          : "Term-partitioned: one index over all records, sharded by the indexed value. A one-term read goes to a single index shard; a write touches the data shard plus one index shard per changed term, so it needs a distributed transaction or an asynchronous index that readers may see stale (DynamoDB)."}
      </p>
    </div>
  );
}

function Stat({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="bg-surface p-3 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className={`font-dot text-2xl font-bold mt-1 ${bad ? "text-bad" : ""}`}>{value}</p>
      {sub && <p className={`font-mono text-[10px] leading-tight ${bad ? "text-bad" : "text-ink-2"}`}>{sub}</p>}
    </div>
  );
}
