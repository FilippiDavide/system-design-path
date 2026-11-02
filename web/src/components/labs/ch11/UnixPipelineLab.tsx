"use client";

import { useState } from "react";

interface Line {
  ip: string;
  url: string;
  status: string;
}

/** Ten lines of an NGINX-style access log: ip, url, status. */
const LOG: Line[] = [
  { ip: "10.0.0.1", url: "/home", status: "200" },
  { ip: "10.0.0.2", url: "/about", status: "200" },
  { ip: "10.0.0.1", url: "/cart", status: "500" },
  { ip: "10.0.0.3", url: "/home", status: "200" },
  { ip: "10.0.0.4", url: "/pricing", status: "200" },
  { ip: "10.0.0.2", url: "/home", status: "404" },
  { ip: "10.0.0.5", url: "/login", status: "200" },
  { ip: "10.0.0.4", url: "/cart", status: "200" },
  { ip: "10.0.0.1", url: "/home", status: "200" },
  { ip: "10.0.0.3", url: "/cart", status: "500" },
];

type Field = 1 | 7 | 9;
const FIELDS: { f: Field; name: string; pick: (l: Line) => string }[] = [
  { f: 7, name: "URL", pick: (l) => l.url },
  { f: 1, name: "client IP", pick: (l) => l.ip },
  { f: 9, name: "status", pick: (l) => l.status },
];

const raw = (l: Line): string => `${l.ip} - - [30/Oct/2026:10:00:00] "GET ${l.url} HTTP/1.1" ${l.status} 512`;

/**
 * The chapter's one-liner, one stage at a time. The reader picks which
 * awk field to extract and how many lines head keeps, then taps a stage
 * to see the stream at that point. The log file never changes.
 */
export function UnixPipelineLab() {
  const [field, setField] = useState<Field>(7);
  const [n, setN] = useState(3);
  const [stage, setStage] = useState(5);

  const pick = FIELDS.find((x) => x.f === field)!.pick;

  // Each stage is a pure function of the previous stage's output.
  const s0 = LOG.map(raw);
  const s1 = LOG.map(pick);
  const s2 = [...s1].sort();
  const runs: { c: number; v: string }[] = [];
  for (const v of s2) {
    const last = runs[runs.length - 1];
    if (last && last.v === v) last.c += 1;
    else runs.push({ c: 1, v });
  }
  const fmt = (r: { c: number; v: string }): string => `${String(r.c).padStart(4)} ${r.v}`;
  const s3 = runs.map(fmt);
  const s4 = [...runs].sort((a, b) => b.c - a.c || a.v.localeCompare(b.v)).map(fmt);
  const s5 = s4.slice(0, n);
  const outputs = [s0, s1, s2, s3, s4, s5];
  const distinct = new Set(s1).size;

  const STAGES = [
    { cmd: "cat access.log", what: "read the immutable input, one record per line" },
    { cmd: `awk '{print $${field}}'`, what: "extract one field per record: the logic lives here" },
    { cmd: "sort", what: "make repetitions adjacent; spills to disk if it must" },
    { cmd: "uniq -c", what: "count runs of identical adjacent lines" },
    { cmd: "sort -r -n", what: "sort again, by the count" },
    { cmd: `head -n ${n}`, what: "keep the top lines, stop reading the rest" },
  ];

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex items-center gap-2">
          awk field
          <span className="flex gap-px border border-line">
            {FIELDS.map((x) => (
              <button
                key={x.f}
                type="button"
                aria-pressed={field === x.f}
                onClick={() => setField(x.f)}
                className={`px-2.5 py-1 ${field === x.f ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
              >
                ${x.f} {x.name}
              </button>
            ))}
          </span>
        </span>
        <label className="flex items-center gap-2">
          head -n
          <input type="range" min={1} max={5} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-20 accent-black" />
          <span className="font-dot text-sm w-4">{n}</span>
        </label>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-px bg-line-soft">
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">pipeline · tap a stage</p>
          <ol className="space-y-1">
            {STAGES.map((st, i) => {
              const on = stage === i;
              return (
                <li key={st.cmd} className="flex items-stretch gap-2">
                  <span className="font-dot text-sm font-bold w-5 pt-1.5">{i + 1}</span>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStage(i)}
                    className={`flex-1 min-w-0 text-left border px-2.5 py-1.5 ${on ? "border-ink bg-ink text-surface" : "border-line-soft hover:border-ink"}`}
                  >
                    <span className="block font-mono text-[12px]">
                      {i > 0 && <span className="text-ink-3">| </span>}
                      {st.cmd}
                    </span>
                    <span className={`block text-[11px] leading-snug ${on ? "text-surface/70" : "text-ink-2"}`}>{st.what}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="bg-surface p-3 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
              stream after stage {stage + 1}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{outputs[stage].length} lines</p>
          </div>
          <pre className="font-mono text-[11px] leading-[1.5] whitespace-pre overflow-x-auto border border-line-soft bg-surface-2 p-2 min-h-[160px]">
            {outputs[stage].join("\n")}
          </pre>
          <div className="grid grid-cols-2 gap-px bg-line-soft border border-line-soft mt-3">
            <div className="bg-surface p-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">in-memory hash</p>
              <p className="font-dot text-xl font-bold">
                {distinct} <span className="text-ink-3 text-sm">keys</span>
              </p>
              <p className="text-[11px] text-ink-2 leading-snug">working set = distinct values; must fit in RAM</p>
            </div>
            <div className="bg-surface p-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">sort</p>
              <p className="font-dot text-xl font-bold">
                0 <span className="text-ink-3 text-sm">working set</span>
              </p>
              <p className="text-[11px] text-ink-2 leading-snug">{LOG.length} lines streamed; mergesort spills to disk</p>
            </div>
          </div>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Change the field or the head count and nothing is recomputed in place: <code>access.log</code> is read-only and
        every stage regenerates its output from the previous one. Each program does one thing; the pipe is the wiring.
        The analysis changed, and only an argument of <code>awk</code> moved. This is the shape MapReduce copies:
        <code> awk</code> is the mapper, <code>sort</code> is implicit, <code>uniq -c</code> is the reducer.
      </p>
    </div>
  );
}
