"use client";

import { useEffect, useState } from "react";

type Engine = "mapreduce" | "spark" | "flink";
type Kind = "read" | "compute" | "dfs" | "exchange" | "redo";

interface Seg {
  id: number;
  kind: Kind;
  label: string;
  ticks: number;
}

interface Tick {
  seg: number;
  kind: Kind;
  label: string;
}

interface Sim {
  queue: Seg[];
  done: Tick[];
  running: boolean;
  kills: number;
  log: string[];
}

const TICK_MS = 380;
const CKPT_EVERY = 3;

const ENGINES: { id: Engine; name: string; state: string; chain: string[] }[] = [
  {
    id: "mapreduce",
    name: "MapReduce",
    state: "written to the DFS after every job, replicated",
    chain: ["job 1 · map", "DFS", "job 2 · filter", "DFS", "job 3 · sort, count", "DFS"],
  },
  {
    id: "spark",
    name: "Spark",
    state: "in memory, spilled to local disk; lineage remembers how it was computed",
    chain: ["map · filter (fused)", "memory", "count", "DFS"],
  },
  {
    id: "flink",
    name: "Flink",
    state: `in memory, pipelined between operators; checkpoint every ${CKPT_EVERY} ticks`,
    chain: ["map → filter → count (pipelined)", "DFS"],
  },
];

/** The schedule each engine runs for the same three-operator job. */
function plan(engine: Engine): Seg[] {
  let n = 0;
  const seg = (kind: Kind, label: string, ticks: number): Seg => ({ id: n++, kind, label, ticks });
  if (engine === "mapreduce") {
    return [
      seg("read", "read input", 1),
      seg("compute", "map", 3),
      seg("dfs", "write ×3", 2),
      seg("read", "read", 1),
      seg("compute", "filter", 2),
      seg("dfs", "write ×3", 2),
      seg("read", "read", 1),
      seg("exchange", "shuffle, sort", 2),
      seg("compute", "count", 3),
      seg("dfs", "write ×3", 2),
    ];
  }
  if (engine === "spark") {
    return [
      seg("read", "read input", 1),
      seg("compute", "map · filter", 5),
      seg("exchange", "shuffle", 1),
      seg("compute", "count", 3),
      seg("dfs", "write ×3", 2),
    ];
  }
  return [seg("read", "read input", 1), seg("compute", "map · filter · count", 6), seg("dfs", "write ×3", 2)];
}

const fresh = (engine: Engine): Sim => ({ queue: plan(engine), done: [], running: false, kills: 0, log: [] });

/** Execute one tick of the head segment. */
function step(s: Sim): Sim {
  const head = s.queue[0];
  if (!head) return { ...s, running: false };
  const done = [...s.done, { seg: head.id, kind: head.kind, label: head.label }];
  const rest = head.ticks > 1 ? [{ ...head, ticks: head.ticks - 1 }, ...s.queue.slice(1)] : s.queue.slice(1);
  const log = rest.length === 0 ? [...s.log, `done in ${done.length} ticks`] : s.log;
  return { ...s, done, queue: rest, running: rest.length > 0, log };
}

const COLOR: Record<Kind, string> = {
  read: "var(--surface-2)",
  compute: "var(--neon-1)",
  dfs: "var(--neon-5)",
  exchange: "var(--neon-4)",
  redo: "var(--bad)",
};

/**
 * One job, three engines. Run it and count the ticks spent writing to
 * the DFS; kill a node mid-run and see what each engine has to redo:
 * MapReduce re-reads from the DFS, Spark recomputes lost partitions
 * from the lineage, Flink rewinds to its last checkpoint.
 */
export function DataflowLab() {
  const [engine, setEngine] = useState<Engine>("mapreduce");
  const [sim, setSim] = useState<Sim>(() => fresh("mapreduce"));

  // One interval while the job runs; cleared when it stops or unmounts.
  useEffect(() => {
    if (!sim.running) return;
    const id = window.setInterval(() => setSim(step), TICK_MS);
    return () => window.clearInterval(id);
  }, [sim.running]);

  const run = () => setSim((s) => ({ ...(s.queue.length === 0 ? fresh(engine) : s), running: true }));
  const reset = (e: Engine = engine) => setSim(fresh(e));
  const pick = (e: Engine) => {
    setEngine(e);
    reset(e);
  };

  /** Node 2 dies in the middle of the current segment. */
  const kill = () => {
    setSim((s) => {
      const head = s.queue[0];
      if (!head || !s.running) return s;
      const elapsed = s.done.filter((t) => t.seg === head.id).length;
      const redo: Seg[] = [];
      let why = "";
      const rid = 1000 + s.kills * 10;
      if (engine === "mapreduce") {
        redo.push({ id: rid, kind: "redo", label: "re-read from DFS", ticks: 1 });
        if (elapsed > 0) redo.push({ id: rid + 1, kind: "redo", label: `redo ${head.label}`, ticks: elapsed });
        why = `node 2 died during "${head.label}": its input is on the DFS, replicated, so only that task is relaunched elsewhere`;
      } else if (engine === "spark") {
        const upstream = s.done.filter((t) => t.kind === "compute" && t.seg !== head.id).length;
        const lost = Math.ceil(upstream / 3);
        if (lost > 0) redo.push({ id: rid, kind: "redo", label: "recompute lost partitions (lineage)", ticks: lost });
        if (elapsed > 0) redo.push({ id: rid + 1, kind: "redo", label: `redo ${head.label}`, ticks: elapsed });
        why =
          lost > 0
            ? `node 2 died during "${head.label}": its share of the intermediate state was in its memory and local disk, so Spark recomputes those partitions from the lineage, then reruns the task`
            : `node 2 died during "${head.label}": the input is immutable on the DFS, so the task simply restarts`;
      } else {
        const t = s.done.length;
        const since = t - Math.floor(t / CKPT_EVERY) * CKPT_EVERY;
        if (since > 0) redo.push({ id: rid, kind: "redo", label: "rewind to checkpoint, replay", ticks: since });
        why = `node 2 died at tick ${t}: every operator rewinds to checkpoint #${Math.floor(t / CKPT_EVERY)} and replays ${since} tick${since === 1 ? "" : "s"}`;
      }
      // The current segment keeps its remaining ticks; the redo work goes first.
      return { ...s, queue: [...redo, ...s.queue], kills: s.kills + 1, log: [...s.log, why] };
    });
  };

  const eng = ENGINES.find((e) => e.id === engine)!;
  const dfsTicks = sim.done.filter((t) => t.kind === "dfs").length;
  const redoTicks = sim.done.filter((t) => t.kind === "redo").length;
  const finished = !sim.running && sim.queue.length === 0 && sim.done.length > 0;

  // Group consecutive ticks of the same segment for the labels.
  const groups: { seg: number; kind: Kind; label: string; n: number }[] = [];
  for (const t of sim.done) {
    const last = groups[groups.length - 1];
    if (last && last.seg === t.seg) last.n += 1;
    else groups.push({ ...t, n: 1 });
  }

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line">
          {ENGINES.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={engine === e.id}
              onClick={() => pick(e.id)}
              className={`px-3 py-1.5 ${engine === e.id ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {e.name}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={run}
          disabled={sim.running}
          className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40"
        >
          {finished ? "Run again" : "Run job"}
        </button>
        <button
          type="button"
          onClick={kill}
          disabled={!sim.running}
          className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad disabled:opacity-40"
        >
          Kill node 2
        </button>
        <button type="button" onClick={() => reset()} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      {/* structure of the job on this engine */}
      <div className="p-3 border-b border-line-soft">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">how {eng.name} runs the job</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {eng.chain.map((c, i) => {
            const store = c === "DFS" || c === "memory";
            return (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-3">→</span>}
                <span
                  className={`px-2 py-1 text-[11px] font-mono ${
                    store ? "border border-dashed border-line-soft text-ink-2" : "border border-ink"
                  }`}
                  style={c === "DFS" ? { boxShadow: "inset 0 -3px 0 var(--neon-5)" } : undefined}
                >
                  {c}
                </span>
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-ink-2">
          Intermediate state: <span className="text-ink">{eng.state}</span>.
        </p>
      </div>

      {/* timeline */}
      <div className="p-3 bg-grid overflow-x-auto">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">
          timeline · {sim.done.length} ticks{sim.running ? " · running" : finished ? " · done" : ""}
        </p>
        <div className="flex min-h-[20px]">
          {sim.done.map((t, i) => (
            <span
              key={i}
              className="block w-[12px] h-5 mr-[2px] border border-ink shrink-0"
              style={{ background: COLOR[t.kind] }}
              title={t.label}
            />
          ))}
          {sim.done.length === 0 && <span className="text-[12px] text-ink-3">press Run job</span>}
        </div>
        {engine === "flink" && sim.done.length > 0 && (
          <div className="flex mt-1">
            {sim.done.map((_, i) => (
              <span key={i} className="block w-[12px] mr-[2px] text-center font-mono text-[9px] text-ink-2">
                {(i + 1) % CKPT_EVERY === 0 ? "▲" : ""}
              </span>
            ))}
            <span className="font-mono text-[9px] text-ink-2 ml-1">checkpoint</span>
          </div>
        )}
        {groups.length > 0 && (
          <ol className="flex flex-wrap gap-1 mt-2">
            {groups.map((g, i) => (
              <li
                key={i}
                className={`flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] bg-surface ${
                  g.kind === "redo" ? "border-bad text-bad" : "border-line-soft text-ink-2"
                }`}
              >
                <span className="block w-2 h-2 border border-ink" style={{ background: COLOR[g.kind] }} />
                {g.label} ×{g.n}
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 font-mono text-[10px] text-ink-2">
          {(
            [
              ["compute", "compute"],
              ["dfs", "write to DFS (replicated)"],
              ["exchange", "shuffle"],
              ["read", "read"],
              ["redo", "work redone after a failure"],
            ] as [Kind, string][]
          ).map(([k, name]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="block w-3 h-3 border border-ink" style={{ background: COLOR[k] }} />
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-line-soft border-t border-line-soft">
        <Stat label="ticks so far" value={sim.done.length} />
        <Stat label="ticks writing to DFS" value={dfsTicks} warn={dfsTicks >= 6} />
        <Stat label="ticks redone" value={redoTicks} bad={redoTicks > 0} />
      </div>

      {sim.log.length > 0 && (
        <ol className="border-t border-line-soft divide-y divide-line-soft font-mono text-[11px]">
          {sim.log.slice(-3).map((l, i) => (
            <li key={i} className="px-3 py-1.5 text-ink-2">
              {l}
            </li>
          ))}
        </ol>
      )}

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Run the same job on all three. MapReduce writes every intermediate result to the DFS, replicated, and sorts
        between every map and reduce, which is safe and slow; a killed task just re-reads its input. Spark fuses map and
        filter into one task, keeps the exchange in memory and local disk and writes only the final output, but a dead
        node takes its slice of the intermediate state with it, so the lineage is replayed for those partitions. Flink
        pipelines the operators and pays for periodic checkpoints instead, so a failure costs the work since the last one.
      </p>
    </div>
  );
}

function Stat({ label, value, warn = false, bad = false }: { label: string; value: number; warn?: boolean; bad?: boolean }) {
  return (
    <div className="bg-surface p-3 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className={`font-dot text-2xl font-bold mt-0.5 ${bad ? "text-bad" : warn ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
}
