"use client";

import { useEffect, useRef, useState } from "react";

interface Node {
  value: string;
  version: number;
  down: boolean;
  /** A write is still on its way to this node. */
  pending: boolean;
}

interface LastOp {
  kind: "write" | "read";
  nodes: number[];
  ok: boolean;
  text: string;
  repaired?: number[];
}

/** How long a write takes to reach the nodes beyond the first w. */
const SLOW_MS = 3000;

const mkNodes = (n: number): Node[] => Array.from({ length: n }, () => ({ value: "v0", version: 0, down: false, pending: false }));

/**
 * Leaderless quorum simulator. A write is confirmed by the first w
 * reachable nodes from the writer's side and dribbles to the others
 * later; a read collects the first r nodes from the reader's side and
 * keeps the highest version, repairing stale copies it saw. Tap a node
 * to take it down.
 */
export function QuorumLab() {
  const [n, setN] = useState(5);
  const [w, setW] = useState(3);
  const [r, setR] = useState(3);
  const [nodes, setNodes] = useState<Node[]>(() => mkNodes(5));
  const [latest, setLatest] = useState(0);
  const [last, setLast] = useState<LastOp | null>(null);
  const [staleReads, setStaleReads] = useState(0);
  const [reads, setReads] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pickN = (v: number) => {
    timers.current.forEach(clearTimeout);
    setN(v);
    setW((x) => Math.min(x, v));
    setR((x) => Math.min(x, v));
    setNodes(mkNodes(v));
    setLatest(0);
    setLast(null);
    setStaleReads(0);
    setReads(0);
  };

  const toggle = (i: number) =>
    setNodes((ns) => ns.map((x, j) => (j === i ? { ...x, down: !x.down, pending: false } : x)));

  const write = () => {
    const version = latest + 1;
    const value = `v${version}`;
    const alive = nodes.map((x, i) => (x.down ? -1 : i)).filter((i) => i >= 0);
    const fast = alive.slice(0, w);
    const slow = alive.slice(w);
    const ok = alive.length >= w;
    setLatest(version);
    setNodes((ns) =>
      ns.map((x, i) => (fast.includes(i) ? { ...x, value, version, pending: false } : slow.includes(i) ? { ...x, pending: true } : x)),
    );
    if (slow.length > 0) {
      timers.current.push(
        window.setTimeout(() => {
          setNodes((ns) => ns.map((x, i) => (slow.includes(i) && !x.down && x.version < version ? { ...x, value, version, pending: false } : x)));
        }, SLOW_MS),
      );
    }
    setLast({
      kind: "write",
      nodes: fast,
      ok,
      text: ok
        ? `${value} confirmed by ${fast.length} node${fast.length > 1 ? "s" : ""} (${fast.map((i) => i + 1).join(", ")}); the other${slow.length === 1 ? "" : "s"} get it in ${SLOW_MS / 1000} s`
        : `${value} FAILED: only ${fast.length} of the required ${w} nodes reachable. It stays on ${fast.length > 0 ? `node${fast.length > 1 ? "s" : ""} ${fast.map((i) => i + 1).join(", ")}` : "nobody"}: not rolled back`,
    });
  };

  const read = () => {
    const alive = nodes.map((x, i) => (x.down ? -1 : i)).filter((i) => i >= 0).reverse();
    const set = alive.slice(0, r);
    if (set.length < r) {
      setLast({ kind: "read", nodes: set, ok: false, text: `read FAILED: only ${set.length} of the required ${r} nodes reachable` });
      return;
    }
    const best = set.reduce((a, i) => (nodes[i].version > nodes[a].version ? i : a), set[0]);
    const got = nodes[best];
    const stale = got.version < latest;
    const repaired = set.filter((i) => nodes[i].version < got.version);
    if (repaired.length > 0) {
      setNodes((ns) => ns.map((x, i) => (repaired.includes(i) ? { ...x, value: got.value, version: got.version, pending: false } : x)));
    }
    setReads((c) => c + 1);
    if (stale) setStaleReads((c) => c + 1);
    setLast({
      kind: "read",
      nodes: set,
      ok: !stale,
      repaired,
      text: stale
        ? `read ${got.value} from nodes ${set.map((i) => i + 1).join(", ")}: STALE, the latest confirmed write is v${latest}`
        : `read ${got.value} from nodes ${set.map((i) => i + 1).join(", ")}: latest` +
          (repaired.length > 0 ? ` · read repair fixed node${repaired.length > 1 ? "s" : ""} ${repaired.map((i) => i + 1).join(", ")}` : ""),
    });
  };

  const reset = () => pickN(n);
  const safe = w + r > n;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={write} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Write
        </button>
        <button type="button" onClick={read} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Read
        </button>
        <span className="flex gap-px border border-line w-fit">
          {[3, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => pickN(v)}
              aria-pressed={n === v}
              className={`px-2.5 py-1.5 ${n === v ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              n={v}
            </button>
          ))}
        </span>
        <label className="flex items-center gap-2">
          w
          <input type="range" min={1} max={n} value={w} onChange={(e) => setW(Number(e.target.value))} className="w-16 accent-black" aria-label="write quorum" />
          <span className="font-dot text-sm w-3">{w}</span>
        </label>
        <label className="flex items-center gap-2">
          r
          <input type="range" min={1} max={n} value={r} onChange={(e) => setR(Number(e.target.value))} className="w-16 accent-black" aria-label="read quorum" />
          <span className="font-dot text-sm w-3">{r}</span>
        </label>
        <span className={safe ? "text-ok" : "text-warn"}>
          w+r={w + r} {safe ? ">" : "≤"} n
        </span>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="p-3 bg-grid">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">
          <span>writer · confirms from here →</span>
          <span>← reader · asks from here</span>
        </div>
        <div className={`grid gap-1.5 ${n === 5 ? "grid-cols-5" : "grid-cols-3"}`}>
          {nodes.map((nd, i) => {
            const inW = last?.kind === "write" && last.nodes.includes(i);
            const inR = last?.kind === "read" && last.nodes.includes(i);
            const fixed = last?.kind === "read" && last.repaired?.includes(i);
            const behind = !nd.down && nd.version < latest;
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={nd.down}
                title={nd.down ? "bring node back" : "take node down"}
                className={`text-left bg-surface border p-2 min-h-[88px] ${
                  nd.down ? "border-line-soft opacity-50 border-dashed" : inW ? "border-ok" : inR ? "border-neon-2" : "border-ink"
                }`}
                style={{ borderWidth: inW || inR ? 2 : 1 }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-dot text-lg font-bold leading-none">{i + 1}</span>
                  {inW && <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ok">w</span>}
                  {inR && <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-neon-2">r</span>}
                </div>
                <p className={`font-mono text-[13px] mt-1 ${behind ? "text-warn" : ""}`}>{nd.value}</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-2 leading-tight">
                  {nd.down ? "down" : nd.pending ? "receiving…" : fixed ? "repaired" : behind ? "stale" : "latest"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-4 flex sm:flex-col gap-6 sm:gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">reads</p>
            <p className="font-dot text-3xl font-bold">{reads}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">stale</p>
            <p className={`font-dot text-3xl font-bold ${staleReads > 0 ? "text-bad" : ""}`}>{staleReads}</p>
          </div>
        </div>
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">last operation</p>
          <p className={`font-mono text-[12px] leading-snug ${last ? (last.ok ? "" : "text-bad") : "text-ink-3"}`}>
            {last ? last.text : "write a value, then read it back; try w + r ≤ n, then take a node down right after a write"}
          </p>
          <p className="mt-2 text-[12px] text-ink-2 leading-snug">
            Writes tolerate {n - w} node{n - w === 1 ? "" : "s"} down, reads {n - r}.{" "}
            {safe
              ? `Any ${r} nodes overlap any ${w} nodes in at least ${w + r - n}: a read always meets a confirmed copy.`
              : "The read set can miss the write set entirely: stale reads are a matter of luck."}
          </p>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Requests always go to all n nodes; w and r only say how many answers to wait for. With w + r &gt; n every
        read overlaps the last write, and read repair pushes the newest version to the stale copies it noticed.
        The guarantee has holes: a write that reaches fewer than w nodes is reported failed but stays where it
        landed, and a node that comes back carries its old value until someone repairs it.
      </p>
    </div>
  );
}
