"use client";

import { useState } from "react";

/** Two input shards of an access log; each shard gets one mapper. */
const SHARDS: string[][] = [
  ["10.0.0.1 GET /home", "10.0.0.2 GET /about", "10.0.0.1 GET /cart", "10.0.0.3 GET /home"],
  ["10.0.0.4 GET /pricing", "10.0.0.2 GET /home", "10.0.0.5 GET /login", "10.0.0.4 GET /cart"],
];

interface Pair {
  key: string;
  value: number;
  from: number;
}

/** Deterministic hash: sum of char codes. Enough to spread keys. */
const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
  return h;
};

const STEPS = [
  {
    title: "input on the DFS",
    text: "The log is split into shards; the framework starts one mapper per shard, close to where the bytes are. Every shard is broken into records, one per line.",
  },
  {
    title: "map: emit (key, value)",
    text: "The mapper extracts a key and a value from each record, with no state between records: (URL, 1). This is awk '{print $7}'. Zero or more pairs per record would be fine too.",
  },
  {
    title: "partition and sort locally",
    text: "Each mapper writes one local file per reducer, chosen by hash(key) mod R, and sorts each file by key. The same key hashes the same way on every mapper.",
  },
  {
    title: "copy and merge",
    text: "When the mappers are done, every reducer copies its file from each mapper and merges the sorted files. Equal keys are now adjacent, whichever shard they came from. This is the shuffle.",
  },
  {
    title: "reduce: equal keys adjacent",
    text: "The reducer is called once per key with an iterator over its values, so it sums without keeping a table in memory. This is uniq -c.",
  },
  {
    title: "output: one file per reducer",
    text: "Each reducer writes its shard of the result to the DFS. Sorting by count needs the data regrouped by a different key, so it is a second MapReduce job.",
  },
];

/**
 * MapReduce by hand on eight log lines: map emits (URL, 1), each mapper
 * partitions by hash(key) mod R into sorted local files, reducers copy
 * and merge, then sum. The reducer count changes who gets which key.
 */
export function MapReduceLab() {
  const [step, setStep] = useState(0);
  const [R, setR] = useState(2);

  const mapped: Pair[][] = SHARDS.map((lines, m) =>
    lines.map((l) => ({ key: l.split(" ")[2], value: 1, from: m })),
  );
  // files[m][r]: sorted pairs written by mapper m for reducer r.
  const files: Pair[][][] = mapped.map((pairs) =>
    Array.from({ length: R }, (_, r) =>
      pairs.filter((p) => hash(p.key) % R === r).sort((a, b) => a.key.localeCompare(b.key)),
    ),
  );
  // merged[r]: what reducer r sees after copying from every mapper.
  const merged: Pair[][] = Array.from({ length: R }, (_, r) =>
    files
      .flatMap((f) => f[r])
      .sort((a, b) => a.key.localeCompare(b.key) || a.from - b.from),
  );
  const reduced: { key: string; count: number }[][] = merged.map((pairs) => {
    const out: { key: string; count: number }[] = [];
    for (const p of pairs) {
      const last = out[out.length - 1];
      if (last && last.key === p.key) last.count += p.value;
      else out.push({ key: p.key, count: p.value });
    }
    return out;
  });

  const s = STEPS[step];
  const mapSide = step <= 2;
  const reduceSide = step >= 3;
  const mapperColor = ["var(--neon-1)", "var(--neon-4)"];

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line">
          <button
            type="button"
            onClick={() => setStep((v) => Math.max(0, v - 1))}
            disabled={step === 0}
            className="px-3 py-1.5 hover:bg-surface-2 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 font-dot text-sm font-bold border-x border-line">
            {step + 1}/{STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
            disabled={step === STEPS.length - 1}
            className="px-3 py-1.5 border-ink hover:bg-ink hover:text-surface disabled:opacity-40"
          >
            Next
          </button>
        </span>
        <span className="flex items-center gap-2">
          reducers
          <span className="flex gap-px border border-line">
            {[2, 3].map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={R === k}
                onClick={() => setR(k)}
                className={`px-2.5 py-1 ${R === k ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
              >
                {k}
              </button>
            ))}
          </span>
        </span>
        <span className="normal-case tracking-normal font-sans text-[13px] text-ink-2 basis-full md:basis-auto md:flex-1">
          <strong className="text-ink">{s.title}.</strong> {s.text}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        {/* map side */}
        <div className={`bg-surface p-3 ${mapSide ? "" : "opacity-50"}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">map side · 2 mappers</p>
          <div className="grid grid-cols-2 gap-2">
            {SHARDS.map((lines, m) => (
              <div key={m} className="border border-line-soft p-2 min-w-0" style={{ boxShadow: `inset 3px 0 0 ${mapperColor[m]}` }}>
                <p className="font-semibold text-[12px] mb-1">
                  m{m + 1} <span className="font-mono text-[10px] text-ink-2 font-normal">shard {m + 1}</span>
                </p>
                {step === 0 && (
                  <ul className="font-mono text-[11px] space-y-0.5">
                    {lines.map((l) => (
                      <li key={l} className="truncate">{l}</li>
                    ))}
                  </ul>
                )}
                {step === 1 && (
                  <ul className="font-mono text-[11px] space-y-0.5">
                    {mapped[m].map((p, i) => (
                      <li key={i}>
                        ({p.key}, {p.value})
                      </li>
                    ))}
                  </ul>
                )}
                {step >= 2 && (
                  <div className="space-y-1.5">
                    {files[m].map((f, r) => (
                      <div key={r} className="border border-dashed border-line-soft p-1">
                        <p className="font-mono text-[10px] text-ink-2">
                          file m{m + 1},r{r + 1} · sorted
                        </p>
                        <p className="font-mono text-[11px]">
                          {f.length === 0 ? <span className="text-ink-3">empty</span> : f.map((p) => `(${p.key},1)`).join(" ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {step === 2 && (
            <p className="mt-2 font-mono text-[10px] text-ink-2">
              {[...new Set(mapped.flat().map((p) => p.key))]
                .sort()
                .map((k) => `${k}→r${(hash(k) % R) + 1}`)
                .join("  ")}
            </p>
          )}
        </div>

        {/* reduce side */}
        <div className={`bg-surface p-3 ${reduceSide ? "" : "opacity-50"}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">reduce side · {R} reducers</p>
          <div className={`grid gap-2 ${R === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {merged.map((pairs, r) => (
              <div key={r} className="border border-line-soft p-2 min-w-0">
                <p className="font-semibold text-[12px] mb-1">
                  r{r + 1}{" "}
                  <span className="font-mono text-[10px] text-ink-2 font-normal">
                    {step >= 3 ? `${pairs.length} pairs` : "waiting"}
                  </span>
                </p>
                {step === 3 && (
                  <ul className="font-mono text-[11px] space-y-0.5">
                    {pairs.map((p, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: mapperColor[p.from] }} />
                        ({p.key},1)
                      </li>
                    ))}
                    {pairs.length === 0 && <li className="text-ink-3">nothing hashed here</li>}
                  </ul>
                )}
                {step >= 4 && (
                  <ul className="font-mono text-[11px] space-y-0.5">
                    {reduced[r].map((x) => (
                      <li key={x.key} className="flex justify-between gap-2">
                        <span>{x.key}</span>
                        <span className="font-dot text-sm font-bold">{x.count}</span>
                      </li>
                    ))}
                    {reduced[r].length === 0 && <li className="text-ink-3">empty</li>}
                  </ul>
                )}
                {step === 5 && <p className="mt-1 font-mono text-[10px] text-ink-2">→ part-{r + 1} on DFS</p>}
              </div>
            ))}
          </div>
          {step === 3 && (
            <p className="mt-2 font-mono text-[10px] text-ink-2">dot colour = which mapper the pair came from</p>
          )}
          {step === 5 && (
            <p className="mt-2 font-mono text-[10px] text-ink-2">
              busiest reducer: {Math.max(...merged.map((p) => p.length))} of {mapped.flat().length} pairs
            </p>
          )}
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Switch between 2 and 3 reducers at step 3: keys move, but a key never splits across reducers, because the
        hash is a function of the key alone. Mapper and reducer are stateless functions of their input, which is why the
        framework can retry any single task after a failure and parallelise freely. The shuffle is the only step that
        moves data across the network.
      </p>
    </div>
  );
}
