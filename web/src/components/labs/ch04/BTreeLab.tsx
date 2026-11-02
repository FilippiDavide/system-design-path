"use client";

import { useState } from "react";
import { Canvas, Label } from "@/components/diagrams/primitives";

const MAX_KEYS = 3; // branching factor 4
const PAGE = 4096;
const SEQUENCE = [42, 17, 88, 5, 63, 29, 71, 94, 12, 55, 38, 80, 3, 66, 24, 49, 91, 8, 77, 33, 60];

interface Node {
  id: number;
  keys: number[];
  children?: Node[];
}

interface Ctx {
  nextId: number;
  touched: number[];
}

/** Insert `key` below `node`; returns the new node and a split, if any. */
function insert(node: Node, key: number, ctx: Ctx): { node: Node; split?: { key: number; right: Node } } {
  if (!node.children) {
    // The leaf is always rewritten; interior pages only when a split reaches them.
    ctx.touched.push(node.id);
    const keys = [...node.keys, key].sort((a, b) => a - b);
    if (keys.length <= MAX_KEYS) return { node: { ...node, keys } };
    const mid = Math.ceil(keys.length / 2);
    const right: Node = { id: ctx.nextId++, keys: keys.slice(mid) };
    ctx.touched.push(right.id);
    return { node: { ...node, keys: keys.slice(0, mid) }, split: { key: right.keys[0], right } };
  }
  let i = 0;
  while (i < node.keys.length && key >= node.keys[i]) i++;
  const r = insert(node.children[i], key, ctx);
  const children = [...node.children];
  children[i] = r.node;
  if (!r.split) return { node: { ...node, children } };
  ctx.touched.push(node.id);
  const keys = [...node.keys];
  keys.splice(i, 0, r.split.key);
  children.splice(i + 1, 0, r.split.right);
  if (keys.length <= MAX_KEYS) return { node: { ...node, keys, children } };
  const mid = Math.floor(keys.length / 2);
  const right: Node = { id: ctx.nextId++, keys: keys.slice(mid + 1), children: children.slice(mid + 1) };
  ctx.touched.push(right.id);
  return { node: { ...node, keys: keys.slice(0, mid), children: children.slice(0, mid + 1) }, split: { key: keys[mid], right } };
}

function insertRoot(root: Node, key: number, ctx: Ctx): Node {
  const r = insert(root, key, ctx);
  if (!r.split) return r.node;
  const newRoot: Node = { id: ctx.nextId++, keys: [r.split.key], children: [r.node, r.split.right] };
  ctx.touched.push(newRoot.id);
  return newRoot;
}

function depth(n: Node): number {
  return n.children ? 1 + depth(n.children[0]) : 1;
}

function leaves(n: Node): Node[] {
  return n.children ? n.children.flatMap(leaves) : [n];
}

interface State {
  root: Node;
  nextId: number;
  step: number;
  touched: number[];
  wal: boolean;
  pageWrites: number;
  walBytes: number;
  broken: boolean;
  note: string;
}

const START: State = {
  root: { id: 1, keys: [] },
  nextId: 2,
  step: 0,
  touched: [],
  wal: true,
  pageWrites: 0,
  walBytes: 0,
  broken: false,
  note: "Insert keys one at a time. Each page holds at most 3 keys; the fourth forces a split.",
};

const CELL = 22;
const ROW_H = 30;

/** Positions of every node, leaves evenly spaced, parents centred. */
function layout(root: Node, width: number): Map<number, { x: number; y: number; w: number }> {
  const pos = new Map<number, { x: number; y: number; w: number }>();
  const ls = leaves(root);
  const d = depth(root);
  const slot = width / ls.length;
  ls.forEach((l, i) => {
    const w = Math.max(1, l.keys.length) * CELL;
    pos.set(l.id, { x: 20 + slot * i + slot / 2 - w / 2, y: 20 + (d - 1) * 70, w });
  });
  const place = (n: Node, level: number) => {
    if (!n.children) return;
    n.children.forEach((c) => place(c, level + 1));
    const first = pos.get(n.children[0].id)!;
    const last = pos.get(n.children[n.children.length - 1].id)!;
    const cx = (first.x + last.x + last.w) / 2;
    const w = Math.max(1, n.keys.length) * CELL;
    pos.set(n.id, { x: cx - w / 2, y: 20 + level * 70, w });
  };
  place(root, 0);
  return pos;
}

/**
 * A B-tree with branching factor 4, grown by hand. Every insert shows
 * which pages were overwritten, how many bytes went to the WAL first,
 * and what a crash in the middle of a split does with and without it.
 */
export function BTreeLab() {
  const [s, setS] = useState<State>(START);
  const done = s.step >= SEQUENCE.length;

  const apply = (crash: boolean) => {
    setS((p) => {
      if (p.step >= SEQUENCE.length || p.broken) return p;
      const key = SEQUENCE[p.step];
      const ctx: Ctx = { nextId: p.nextId, touched: [] };
      const root = insertRoot(p.root, key, ctx);
      const pages = [...new Set(ctx.touched)];
      const split = pages.length > 1;
      const walBytes = p.wal ? p.walBytes + 16 : p.walBytes;
      // Carry the id counter forward, otherwise two splits would mint the same page id.
      const base = { ...p, nextId: ctx.nextId, step: p.step + 1, touched: pages, pageWrites: p.pageWrites + pages.length, walBytes };
      if (crash && !split) {
        return { ...base, root, note: `Insert ${key}: crash during a single-page write. The torn page is a risk even here, but ${p.wal ? "the WAL replays the record" : "we got lucky this time: the write had finished"}.` };
      }
      if (crash && split) {
        if (p.wal) {
          return {
            ...base,
            root,
            note: `Insert ${key} split ${pages.length} pages and the process crashed halfway. The WAL already held "insert ${key}", so recovery replayed it and the tree is consistent.`,
          };
        }
        return {
          ...base,
          root,
          broken: true,
          note: `Insert ${key} needed to overwrite ${pages.length} pages and the process crashed after the first. Without a WAL the new page exists but no parent points to it: an orphan page and a key that is gone. The tree is corrupt.`,
        };
      }
      return {
        ...base,
        root,
        note: split
          ? `Insert ${key}: a page was full, so it was split into two half-full pages and the parent updated. ${pages.length} pages (${(pages.length * PAGE) / 1024} KiB) rewritten for one ${p.wal ? "16-byte record, after 16 bytes in the WAL" : "16-byte record"}.`
          : `Insert ${key}: found the leaf, overwrote it in place. 1 page (4 KiB) rewritten for a 16-byte record${p.wal ? ", plus 16 bytes appended to the WAL first" : ""}.`,
      };
    });
  };

  const pos = layout(s.root, 740);
  const d = depth(s.root);
  const h = 20 + (d - 1) * 70 + ROW_H + 30;
  const allNodes: Node[] = [];
  const walk = (n: Node) => {
    allNodes.push(n);
    n.children?.forEach(walk);
  };
  walk(s.root);
  const written = s.pageWrites * PAGE + s.walBytes;
  const useful = s.step * 16;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => apply(false)} disabled={done || s.broken} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Insert {done ? "done" : SEQUENCE[s.step]}
        </button>
        <button type="button" onClick={() => apply(true)} disabled={done || s.broken} className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad disabled:opacity-40">
          Insert + crash midway
        </button>
        <button
          type="button"
          onClick={() => setS((p) => ({ ...p, wal: !p.wal }))}
          aria-pressed={s.wal}
          className={`border px-3 py-1.5 ${s.wal ? "border-ink bg-ink text-surface" : "border-line-soft"}`}
        >
          WAL {s.wal ? "on" : "off"}
        </button>
        <button type="button" onClick={() => setS(START)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="p-3 bg-grid overflow-x-auto">
        <Canvas w={780} h={h} minWidth={520}>
          {allNodes.map((n) => {
            const p = pos.get(n.id)!;
            return (
              <g key={n.id}>
                {n.children?.map((c, i) => {
                  const cp = pos.get(c.id)!;
                  const sx = p.x + i * CELL;
                  return <line key={c.id} x1={sx} y1={p.y + ROW_H} x2={cp.x + cp.w / 2} y2={cp.y} stroke="var(--ink-2)" strokeWidth={1} />;
                })}
              </g>
            );
          })}
          {allNodes.map((n) => {
            const p = pos.get(n.id)!;
            const hot = s.touched.includes(n.id);
            const torn = s.broken && hot && n.id === Math.max(...s.touched);
            const stroke = torn ? "var(--bad)" : hot ? "var(--neon-1)" : "var(--ink)";
            return (
              <g key={n.id}>
                <rect x={p.x} y={p.y} width={p.w} height={ROW_H} fill={torn ? "var(--surface-2)" : "#fff"} stroke={stroke} strokeWidth={hot ? 2 : 1.5} strokeDasharray={torn ? "4 3" : undefined} />
                {n.keys.map((k, i) => (
                  <g key={k}>
                    {i > 0 && <line x1={p.x + i * CELL} y1={p.y} x2={p.x + i * CELL} y2={p.y + ROW_H} stroke={stroke} strokeWidth={1} />}
                    <Label x={p.x + i * CELL + CELL / 2} y={p.y + ROW_H / 2} lines={String(k)} size={11} weight={600} mono color={torn ? "var(--bad)" : "var(--ink)"} />
                  </g>
                ))}
                {n.keys.length === 0 && <Label x={p.x + CELL / 2} y={p.y + ROW_H / 2} lines="·" size={11} mono color="var(--ink-2)" />}
                <Label x={p.x + p.w / 2} y={p.y - 9} lines={`p${n.id}`} size={10} mono color={torn ? "var(--bad)" : hot ? "var(--neon-1)" : "var(--ink-3)"} />
              </g>
            );
          })}
          {s.broken && (
            <Label x={390} y={h - 12} lines="orphan page: written, but the parent was never updated → corrupt tree" size={10} mono color="var(--bad)" />
          )}
        </Canvas>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line-soft border-t border-line-soft">
        <Stat label="keys inserted" value={String(s.step)} sub={`depth ${d}`} />
        <Stat label="last insert" value={`${s.touched.length || 0} pg`} sub={s.touched.length > 1 ? "split" : s.touched.length ? "in place" : "–"} />
        <Stat label="written to disk" value={`${(written / 1024).toFixed(0)} KiB`} sub={`${s.pageWrites} pages${s.wal ? " + WAL" : ""}`} />
        <Stat label="write amplification" value={useful ? `${Math.round(written / useful)}×` : "–"} sub={`${useful} B of records`} bad={s.broken} />
      </div>
      {s.broken && (
        <div className="px-3 py-2 border-t border-line-soft font-mono text-[11px] uppercase tracking-[0.12em] text-bad flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-bad" /> corrupt · no log to replay
          <button type="button" onClick={() => setS({ ...START, wal: true })} className="ml-auto border border-line-soft px-2 py-1 text-ink hover:border-ink">
            rebuild with WAL on
          </button>
        </div>
      )}
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {s.note} The B-tree overwrites fixed-size pages in place: one 16-byte key costs a whole 4 KiB page, and a
        split touches two or three. That is why every change is appended to the write-ahead log before any page is
        overwritten: after a crash the WAL restores a consistent tree. Switch the WAL off, keep inserting until a
        split is due, and crash midway.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, bad }: { label: string; value: string; sub: string; bad?: boolean }) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className={`font-dot text-2xl font-bold mt-1 ${bad ? "text-bad" : ""}`}>{value}</p>
      <p className="font-mono text-[10px] text-ink-3">{sub}</p>
    </div>
  );
}
