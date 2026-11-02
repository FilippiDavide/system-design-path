"use client";

import { useMemo, useState } from "react";
import { Arrow, Canvas, Label, INK } from "@/components/diagrams/primitives";

type NodeId = "maya" | "lucy" | "alain" | "idaho" | "us" | "na" | "london" | "england" | "uk" | "europe" | "stlo" | "normandy" | "france";

interface GNode {
  id: NodeId;
  name: string;
  kind: "person" | "place";
  sub?: string;
  x: number;
  y: number;
  w?: number;
}

interface GEdge {
  id: string;
  from: NodeId;
  to: NodeId;
  type: "BORN_IN" | "LIVES_IN" | "WITHIN";
  pts: number[];
}

const NODES: GNode[] = [
  { id: "maya", name: "Maya", kind: "person", x: 90, y: 48 },
  { id: "lucy", name: "Lucy", kind: "person", x: 90, y: 130 },
  { id: "alain", name: "Alain", kind: "person", x: 90, y: 220 },
  { id: "idaho", name: "Idaho", kind: "place", sub: "state", x: 210, y: 30, w: 100 },
  { id: "us", name: "United States", kind: "place", sub: "country", x: 360, y: 30, w: 110 },
  { id: "na", name: "North America", kind: "place", sub: "continent", x: 520, y: 30, w: 120 },
  { id: "london", name: "London", kind: "place", sub: "city", x: 210, y: 120, w: 100 },
  { id: "england", name: "England", kind: "place", sub: "country", x: 360, y: 120, w: 100 },
  { id: "uk", name: "UK", kind: "place", sub: "union", x: 510, y: 120, w: 70 },
  { id: "europe", name: "Europe", kind: "place", sub: "continent", x: 660, y: 120, w: 100 },
  { id: "stlo", name: "Saint-Lô", kind: "place", sub: "town", x: 210, y: 210, w: 100 },
  { id: "normandy", name: "Normandy", kind: "place", sub: "region", x: 360, y: 210, w: 100 },
  { id: "france", name: "France", kind: "place", sub: "country", x: 510, y: 210, w: 100 },
];

const EDGES: GEdge[] = [
  { id: "maya-b", from: "maya", to: "idaho", type: "BORN_IN", pts: [118, 40, 210, 40] },
  { id: "maya-l", from: "maya", to: "idaho", type: "LIVES_IN", pts: [118, 56, 210, 56] },
  { id: "lucy-b", from: "lucy", to: "idaho", type: "BORN_IN", pts: [118, 120, 160, 120, 160, 62, 210, 62] },
  { id: "lucy-l", from: "lucy", to: "london", type: "LIVES_IN", pts: [118, 140, 210, 140] },
  { id: "alain-l", from: "alain", to: "london", type: "LIVES_IN", pts: [118, 210, 160, 210, 160, 150, 210, 150] },
  { id: "alain-b", from: "alain", to: "stlo", type: "BORN_IN", pts: [118, 232, 210, 232] },
  { id: "w1", from: "idaho", to: "us", type: "WITHIN", pts: [310, 48, 360, 48] },
  { id: "w2", from: "us", to: "na", type: "WITHIN", pts: [470, 48, 520, 48] },
  { id: "w3", from: "london", to: "england", type: "WITHIN", pts: [310, 138, 360, 138] },
  { id: "w4", from: "england", to: "uk", type: "WITHIN", pts: [460, 138, 510, 138] },
  { id: "w5", from: "uk", to: "europe", type: "WITHIN", pts: [580, 138, 660, 138] },
  { id: "w6", from: "stlo", to: "normandy", type: "WITHIN", pts: [310, 228, 360, 228] },
  { id: "w7", from: "normandy", to: "france", type: "WITHIN", pts: [460, 228, 510, 228] },
  { id: "w8", from: "france", to: "europe", type: "WITHIN", pts: [610, 228, 710, 228, 710, 156] },
];

const CLAUSES = [
  "MATCH (person) -[:BORN_IN]-> (birth),",
  "      (birth) -[:WITHIN*0..]->\n          (:Location {name: 'United States'}),",
  "      (person) -[:LIVES_IN]-> (home),",
  "      (home) -[:WITHIN*0..]->\n          (:Location {name: 'Europe'})",
  "RETURN person.name",
];

interface Frame {
  person: NodeId;
  nodes: NodeId[];
  edges: string[];
  clause: number;
  hops: number | null;
  msg: string;
  status: "ok" | "bad" | "none";
  results: string[];
  discarded: NodeId[];
}

const byName = (id: NodeId) => NODES.find((n) => n.id === id)?.name ?? id;
const edgeOut = (from: NodeId, type: GEdge["type"]) => EDGES.find((e) => e.from === from && e.type === type);

/**
 * Executes the Cypher query by hand, one binding at a time, and records
 * a frame for every step so the reader can walk through it.
 */
function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  const results: string[] = [];
  const discarded: NodeId[] = [];
  const people: NodeId[] = ["maya", "lucy", "alain"];

  const climb = (person: NodeId, start: NodeId, startEdge: string, goal: NodeId, clause: number, label: string): boolean => {
    let cur = start;
    const path: NodeId[] = [person, start];
    const used: string[] = [startEdge];
    let hops = 0;
    for (;;) {
      if (cur === goal) {
        frames.push({
          person,
          nodes: [...path],
          edges: [...used],
          clause,
          hops,
          msg: `${byName(cur)} is '${byName(goal)}' after ${hops} WITHIN hop${hops === 1 ? "" : "s"}: the pattern matches.`,
          status: "ok",
          results: [...results],
          discarded: [...discarded],
        });
        return true;
      }
      const next = edgeOut(cur, "WITHIN");
      if (!next) {
        frames.push({
          person,
          nodes: [...path],
          edges: [...used],
          clause,
          hops,
          msg: `${byName(cur)} has no WITHIN edge and is not '${byName(goal)}': no path, ${byName(person)} is discarded.`,
          status: "bad",
          results: [...results],
          discarded: [...discarded],
        });
        return false;
      }
      frames.push({
        person,
        nodes: [...path],
        edges: [...used],
        clause,
        hops,
        msg: `${byName(cur)} is not '${byName(goal)}'. ${label}: follow WITHIN one more time, hop ${hops + 1}.`,
        status: "none",
        results: [...results],
        discarded: [...discarded],
      });
      used.push(next.id);
      cur = next.to;
      path.push(cur);
      hops += 1;
    }
  };

  for (const p of people) {
    frames.push({
      person: p,
      nodes: [p],
      edges: [],
      clause: 0,
      hops: null,
      msg: `Bind person = ${byName(p)} and follow its BORN_IN edge.`,
      status: "none",
      results: [...results],
      discarded: [...discarded],
    });
    const born = edgeOut(p, "BORN_IN");
    if (!born) continue;
    frames.push({
      person: p,
      nodes: [p, born.to],
      edges: [born.id],
      clause: 1,
      hops: 0,
      msg: `birth = ${byName(born.to)}. Now WITHIN*0..: is it 'United States' already (0 hops)?`,
      status: "none",
      results: [...results],
      discarded: [...discarded],
    });
    if (!climb(p, born.to, born.id, "us", 1, "WITHIN*0.. keeps going")) {
      discarded.push(p);
      continue;
    }
    const lives = edgeOut(p, "LIVES_IN");
    if (!lives) continue;
    frames.push({
      person: p,
      nodes: [p, lives.to],
      edges: [lives.id],
      clause: 2,
      hops: 0,
      msg: `Born in the US. Now home = ${byName(lives.to)}; is it 'Europe' already (0 hops)?`,
      status: "none",
      results: [...results],
      discarded: [...discarded],
    });
    if (!climb(p, lives.to, lives.id, "europe", 3, "WITHIN*0.. keeps going")) {
      discarded.push(p);
      continue;
    }
    results.push(byName(p));
    frames.push({
      person: p,
      nodes: [p],
      edges: [],
      clause: 4,
      hops: null,
      msg: `${byName(p)} satisfies both patterns: RETURN person.name.`,
      status: "ok",
      results: [...results],
      discarded: [...discarded],
    });
  }
  frames.push({
    person: "alain",
    nodes: [],
    edges: [],
    clause: 4,
    hops: null,
    msg: `Done. Three people, three different path lengths, one answer: ${results.join(", ")}.`,
    status: "ok",
    results: [...results],
    discarded: [...discarded],
  });
  return frames;
}

/**
 * The chapter's "who emigrated from the US to Europe" query executed
 * step by step over a small property graph. The point is the
 * variable-length WITHIN*0.. part: nobody knows in advance how many
 * hops separate a birthplace from its country.
 */
export function GraphTraversalLab() {
  const frames = useMemo(() => buildFrames(), []);
  const [i, setI] = useState(0);
  const f = frames[i];
  const last = i === frames.length - 1;

  const nodeStroke = (n: GNode) => {
    if (f.nodes.includes(n.id)) {
      if (f.status === "ok" && n.id === f.nodes[f.nodes.length - 1] && f.clause !== 4) return "var(--ok)";
      if (f.status === "bad" && n.id === f.nodes[f.nodes.length - 1]) return "var(--bad)";
      return "var(--neon-1)";
    }
    if (f.discarded.includes(n.id)) return "var(--ink-3)";
    if (f.results.includes(n.name)) return "var(--ok)";
    return INK;
  };
  const edgeColor = (e: GEdge): "blue" | "ink" | "soft" => (f.edges.includes(e.id) ? "blue" : f.nodes.length ? "soft" : "ink");

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => setI((n) => Math.min(frames.length - 1, n + 1))} disabled={last} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Next step
        </button>
        <button type="button" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Prev
        </button>
        <span className="text-ink-2">
          step <span className="font-dot text-sm">{i + 1}</span>/{frames.length}
          {f.hops !== null && (
            <>
              {" "}
              · hops <span className="font-dot text-sm">{f.hops}</span>
            </>
          )}
        </span>
        <button type="button" onClick={() => setI(0)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="p-3 bg-grid overflow-x-auto">
        <Canvas w={800} h={270} minWidth={620}>
          {EDGES.map((e) => (
            <Arrow key={e.id} pts={e.pts} color={edgeColor(e)} dashed={e.type === "BORN_IN"} width={f.edges.includes(e.id) ? 2.5 : 1.5} />
          ))}
          {NODES.map((n) => {
            const stroke = nodeStroke(n);
            const hot = stroke !== INK && stroke !== "var(--ink-3)";
            if (n.kind === "person") {
              return (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={28} fill="#fff" stroke={stroke} strokeWidth={hot ? 2.5 : 1.5} />
                  <Label x={n.x} y={n.y} lines={n.name} size={12} weight={600} color={stroke === "var(--ink-3)" ? "var(--ink-3)" : INK} />
                </g>
              );
            }
            const w = n.w ?? 100;
            return (
              <g key={n.id}>
                <rect x={n.x} y={n.y} width={w} height={36} fill="#fff" stroke={stroke} strokeWidth={hot ? 2.5 : 1.5} />
                <Label x={n.x + w / 2} y={n.y + 13} lines={n.name} size={11} weight={600} />
                {n.sub && <Label x={n.x + w / 2} y={n.y + 26} lines={n.sub} size={10} mono color="var(--ink-2)" />}
              </g>
            );
          })}
          <Label x={30} y={262} lines="- - BORN_IN    — LIVES_IN    → WITHIN" size={10} mono color="var(--ink-2)" anchor="start" />
        </Canvas>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-3 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">cypher · 4 lines, one of them recursive</p>
          <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto">
            {CLAUSES.map((c, k) => (
              <span key={k} className={`block px-1 ${k === f.clause ? "bg-neon-1/10 text-ink" : "text-ink-2"}`}>
                {c}
              </span>
            ))}
          </pre>
        </div>
        <div className="bg-surface p-3 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">engine</p>
          <p className={`text-sm leading-snug ${f.status === "bad" ? "text-bad" : f.status === "ok" ? "text-ok" : ""}`}>{f.msg}</p>
          <p className="mt-3 font-mono text-[11px]">
            result so far: <span className="font-semibold">{f.results.length ? f.results.join(", ") : "—"}</span>
          </p>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Idaho reaches the United States in 1 hop; London reaches Europe in 3; Saint-Lô never reaches the US at all. The query does not say how many hops: WITHIN*0.. means
        &quot;zero or more&quot;, like * in a regex. In SQL the same question needs WITH RECURSIVE and some 30 lines, because the join depth has to be built by hand.
      </p>
    </div>
  );
}
