"use client";

import { useState } from "react";
import { Arrow, Canvas, INK, INK2, Label, NEON } from "@/components/diagrams/primitives";

type NodeId = 0 | 1 | 2;
type Vec = [number, number, number];

const NODES: { id: NodeId; name: string; short: string; x: number; color: string }[] = [
  { id: 0, name: "Aaliyah", short: "A", x: 150, color: NEON.blue },
  { id: 1, name: "Bryce", short: "B", x: 370, color: NEON.magenta },
  { id: 2, name: "Caleb", short: "C", x: 590, color: NEON.green },
];

interface Ev {
  id: number;
  node: NodeId;
  /** n-th post of this node. */
  n: number;
  counter: number;
  vec: Vec;
  row: number;
}

interface Delivery {
  fromEvent: number;
  to: NodeId;
  counter: number;
  vec: Vec;
  row: number;
}

interface World {
  counters: Vec;
  vecs: [Vec, Vec, Vec];
  events: Ev[];
  deliveries: Delivery[];
  rows: number;
}

const EMPTY: World = {
  counters: [0, 0, 0],
  vecs: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  events: [],
  deliveries: [],
  rows: 0,
};

const MAX_ROWS = 12;
const ROW_H = 34;
const TOP = 58;

function post(w: World, node: NodeId): World {
  if (w.rows >= MAX_ROWS) return w;
  const counters: Vec = [...w.counters] as Vec;
  counters[node] += 1;
  const vecs = w.vecs.map((v) => [...v] as Vec) as [Vec, Vec, Vec];
  vecs[node][node] += 1;
  const n = w.events.filter((e) => e.node === node).length + 1;
  const ev: Ev = { id: w.events.length + 1, node, n, counter: counters[node], vec: [...vecs[node]] as Vec, row: w.rows };
  return { ...w, counters, vecs, events: [...w.events, ev], rows: w.rows + 1 };
}

/** Deliver the latest post of `from` to `to`: counters and vectors are merged, no new event. */
function deliver(w: World, from: NodeId, to: NodeId): World {
  if (w.rows >= MAX_ROWS) return w;
  const latest = [...w.events].reverse().find((e) => e.node === from);
  if (!latest) return w;
  const counters: Vec = [...w.counters] as Vec;
  counters[to] = Math.max(counters[to], latest.counter);
  const vecs = w.vecs.map((v) => [...v] as Vec) as [Vec, Vec, Vec];
  vecs[to] = vecs[to].map((x, i) => Math.max(x, latest.vec[i])) as Vec;
  const d: Delivery = { fromEvent: latest.id, to, counter: counters[to], vec: [...vecs[to]] as Vec, row: w.rows };
  return { ...w, counters, vecs, deliveries: [...w.deliveries, d], rows: w.rows + 1 };
}

/** The book's example: two posts that never saw each other, then Bryce's reply. */
function bookExample(): World {
  let w = post(EMPTY, 0);
  w = post(w, 2);
  w = deliver(w, 0, 1);
  w = deliver(w, 2, 1);
  w = post(w, 1);
  return w;
}

const leq = (a: Vec, b: Vec) => a.every((x, i) => x <= b[i]);
const same = (a: Vec, b: Vec) => a.every((x, i) => x === b[i]);
const lamportLess = (a: Ev, b: Ev) => a.counter < b.counter || (a.counter === b.counter && a.node < b.node);

const ts = (e: Ev) => `(${e.counter}, ${NODES[e.node].short})`;
const vs = (v: Vec) => `[${v.join(",")}]`;

/**
 * Lamport clocks vs vector clocks. Three nodes post and deliver their
 * posts to each other; every post gets both timestamps. Pick two posts
 * to see that Lamport always orders them, while only the vector clock
 * can tell "happened before" from "concurrent".
 */
export function LogicalClocksLab() {
  const [world, setWorld] = useState<World>(bookExample);
  const [node, setNode] = useState<NodeId>(1);
  const [sel, setSel] = useState<number[]>([1, 2]);

  const full = world.rows >= MAX_ROWS;
  const hasPost = (n: NodeId) => world.events.some((e) => e.node === n);
  const h = TOP + Math.max(world.rows, 3) * ROW_H + 24;

  const toggle = (id: number) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));
  const reset = (w: World) => {
    setWorld(w);
    setSel(w.events.length >= 2 ? [1, 2] : []);
  };

  const [e1, e2] = sel.map((id) => world.events.find((e) => e.id === id)).filter((e): e is Ev => !!e);
  let verdict: { lamport: string; vector: string; mismatch: boolean } | null = null;
  if (e1 && e2) {
    const [first, second] = lamportLess(e1, e2) ? [e1, e2] : [e2, e1];
    const tie = e1.counter === e2.counter;
    const lamport = `${ts(first)} < ${ts(second)}: ${NODES[first.node].name}'s post comes first in the total order${
      tie ? ", counters tie, so the node ID decides" : ""
    }.`;
    let vector: string;
    let mismatch = false;
    if (leq(e1.vec, e2.vec) && !same(e1.vec, e2.vec)) {
      vector = `${vs(e1.vec)} ≤ ${vs(e2.vec)}: ${NODES[e1.node].name}'s post happened before ${NODES[e2.node].name}'s. ${NODES[e2.node].name} had already seen it.`;
    } else if (leq(e2.vec, e1.vec) && !same(e1.vec, e2.vec)) {
      vector = `${vs(e2.vec)} ≤ ${vs(e1.vec)}: ${NODES[e2.node].name}'s post happened before ${NODES[e1.node].name}'s. ${NODES[e1.node].name} had already seen it.`;
    } else {
      vector = `${vs(e1.vec)} and ${vs(e2.vec)}: neither is ≤ the other, the posts are concurrent. Neither node knew about the other's post.`;
      mismatch = true;
    }
    verdict = { lamport, vector, mismatch };
  }

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line">
          {NODES.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setNode(n.id)}
              aria-pressed={node === n.id}
              className={`px-3 py-1.5 ${node === n.id ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {n.name}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => setWorld((w) => post(w, node))}
          disabled={full}
          className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40"
        >
          posts
        </button>
        {NODES.filter((n) => n.id !== node).map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setWorld((w) => deliver(w, node, n.id))}
            disabled={full || !hasPost(node)}
            className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40"
          >
            deliver to {n.name}
          </button>
        ))}
        <span className="ml-auto flex gap-3">
          <button type="button" onClick={() => reset(bookExample())} className="underline underline-offset-4 text-ink-2 hover:text-ink">
            book example
          </button>
          <button type="button" onClick={() => reset(EMPTY)} className="underline underline-offset-4 text-ink-2 hover:text-ink">
            clear
          </button>
        </span>
      </div>

      <div className="p-3 bg-grid overflow-x-auto">
        <Canvas w={740} h={h}>
          {NODES.map((n) => (
            <g key={n.id}>
              <Label x={n.x} y={22} lines={`${n.name} · node ${n.short}`} size={11} weight={600} />
              <Label x={n.x} y={38} lines={`counter ${world.counters[n.id]} · ${vs(world.vecs[n.id])}`} size={10} mono color={INK2} />
              <line x1={n.x} y1={48} x2={n.x} y2={h - 12} stroke={INK2} strokeWidth={1} strokeDasharray="3 4" />
            </g>
          ))}

          {/* Arrows first, then markers and labels, so no later arrow runs across an earlier label. */}
          {world.deliveries.map((d, i) => {
            const from = world.events.find((e) => e.id === d.fromEvent)!;
            const y = TOP + d.row * ROW_H;
            const fx = NODES[from.node].x;
            const tx = NODES[d.to].x;
            const dir = tx > fx ? 1 : -1;
            return <Arrow key={`a${i}`} pts={[fx + dir * 9, TOP + from.row * ROW_H, tx - dir * 7, y]} color="soft" width={1} />;
          })}
          {world.deliveries.map((d, i) => {
            const from = world.events.find((e) => e.id === d.fromEvent)!;
            const y = TOP + d.row * ROW_H;
            const fx = NODES[from.node].x;
            const tx = NODES[d.to].x;
            const dir = tx > fx ? 1 : -1;
            return (
              <g key={`d${i}`}>
                <circle cx={tx} cy={y} r={5} fill="#fff" stroke={INK} strokeWidth={1.5} />
                <rect x={dir > 0 ? tx + 10 : tx - 114} y={y - 7} width={104} height={14} fill="#fff" />
                <Label
                  x={tx + dir * 12}
                  y={y}
                  lines={`max → ${d.counter}  ${vs(d.vec)}`}
                  size={10}
                  mono
                  color={INK2}
                  anchor={dir > 0 ? "start" : "end"}
                />
              </g>
            );
          })}

          {world.events.map((e) => {
            const n = NODES[e.node];
            const y = TOP + e.row * ROW_H;
            const k = sel.indexOf(e.id);
            const ring = k === 0 ? NEON.blue : k === 1 ? NEON.magenta : null;
            return (
              <g key={e.id} onClick={() => toggle(e.id)} style={{ cursor: "pointer" }}>
                {ring && <circle cx={n.x} cy={y} r={12} fill="none" stroke={ring} strokeWidth={2} />}
                <circle cx={n.x} cy={y} r={7} fill={INK} />
                <Label x={n.x - 16} y={y} lines={ts(e)} size={11} mono anchor="end" />
                <Label x={n.x + 16} y={y} lines={vs(e.vec)} size={11} mono anchor="start" color={INK2} />
              </g>
            );
          })}
          {world.events.length === 0 && <Label x={370} y={TOP + ROW_H} lines="pick a node and post" size={11} mono color={INK2} />}
        </Canvas>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">compare two posts · tap in the diagram or here</p>
          <div className="flex flex-wrap gap-1.5">
            {world.events.map((e) => {
              const k = sel.indexOf(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e.id)}
                  aria-pressed={k >= 0}
                  className="border px-2 py-1 font-mono text-[11px] hover:border-ink"
                  style={{ borderColor: k === 0 ? NEON.blue : k === 1 ? NEON.magenta : "var(--line-soft)" }}
                >
                  {NODES[e.node].short}#{e.n} {ts(e)}
                </button>
              );
            })}
            {world.events.length === 0 && <span className="text-[12px] text-ink-2">no posts yet</span>}
          </div>
        </div>
        <div className="bg-surface p-3 text-[12px] leading-relaxed space-y-2">
          {verdict ? (
            <>
              <p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mr-2">Lamport</span>
                {verdict.lamport}
              </p>
              <p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mr-2">Vector</span>
                {verdict.vector}
              </p>
              {verdict.mismatch && (
                <p className="text-warn">
                  Lamport still ordered them: a total order has to put one first. Looking at the two Lamport timestamps alone you
                  cannot tell this pair was concurrent.
                </p>
              )}
            </>
          ) : (
            <p className="text-ink-2">Select two posts to compare their timestamps.</p>
          )}
        </div>
      </div>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        A post increments the node&apos;s counter; a delivery raises the receiver&apos;s counter to the sender&apos;s if it is
        larger. The Lamport timestamp (counter, node ID) is compact, unique and consistent with causality, so it is a fine
        txid for snapshot isolation, but it is not linearizable and it cannot reveal concurrency. The vector clock, one
        counter per node, can, at the cost of growing with the number of nodes.
      </p>
    </div>
  );
}
