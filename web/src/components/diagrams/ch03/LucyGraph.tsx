"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Group, Label, NEON, INK } from "../primitives";

type EdgeType = "BORN_IN" | "LIVES_IN" | "WITHIN" | "MARRIED_TO";

interface Edge {
  type: EdgeType;
  pts: number[];
  label?: { x: number; y: number; anchor?: "start" | "middle" | "end" };
}

const EDGES: Edge[] = [
  { type: "BORN_IN", pts: [112, 128, 160, 128, 160, 62, 210, 62], label: { x: 152, y: 100, anchor: "end" } },
  { type: "LIVES_IN", pts: [112, 172, 160, 172, 160, 232, 210, 232], label: { x: 152, y: 205, anchor: "end" } },
  { type: "MARRIED_TO", pts: [90, 184, 90, 270], label: { x: 80, y: 227, anchor: "end" } },
  { type: "LIVES_IN", pts: [120, 300, 270, 300, 270, 254], label: { x: 195, y: 290 } },
  { type: "WITHIN", pts: [330, 62, 380, 62], label: { x: 355, y: 50 } },
  { type: "WITHIN", pts: [510, 62, 560, 62], label: { x: 535, y: 50 } },
  { type: "WITHIN", pts: [330, 232, 380, 232], label: { x: 355, y: 220 } },
  { type: "WITHIN", pts: [490, 232, 540, 232], label: { x: 515, y: 220 } },
  { type: "WITHIN", pts: [610, 232, 660, 232], label: { x: 635, y: 220 } },
];

const COLOR: Record<EdgeType, keyof typeof NEON> = {
  BORN_IN: "orange",
  LIVES_IN: "blue",
  WITHIN: "magenta",
  MARRIED_TO: "violet",
};

const NOTES: Record<EdgeType, string> = {
  BORN_IN: "Lucy was born in Idaho, a state. Alain's birthplace (Saint-Lô, a town in Normandy) sits at a different granularity. Same edge label, different depth: a graph does not care.",
  LIVES_IN: "Both live in London, a city. 'Who lives in Europe?' has to climb WITHIN edges from here, and the number of hops is not known in advance.",
  WITHIN: "WITHIN links a place to a larger place. Two hops take Idaho to its continent, four take London to Europe: paths of variable length, hence WITHIN*0.. in Cypher.",
  MARRIED_TO: "Any vertex can link to any other with any label: one graph holds people, places and several kinds of relationship at once.",
};

/**
 * The chapter's running example as a property graph. Tap an edge type
 * to see what it carries: two countries with different regional
 * structures and facts recorded at different granularities.
 */
export function LucyGraph() {
  const [focus, setFocus] = useState<EdgeType | null>(null);

  const colorOf = (t: EdgeType): keyof typeof NEON | "ink" | "soft" => (focus === null ? "ink" : focus === t ? COLOR[t] : "soft");
  const labelColor = (t: EdgeType) => (focus === null ? "var(--ink-2)" : focus === t ? NEON[COLOR[t]] : "var(--ink-3)");

  return (
    <Figure
      label="FIG 05"
      title="a property graph: people, places, relationships"
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {(["BORN_IN", "LIVES_IN", "WITHIN", "MARRIED_TO"] as EdgeType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFocus(focus === t ? null : t)}
                aria-pressed={focus === t}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${focus === t ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
              >
                {t}
              </button>
            ))}
          </span>
          <span>
            {focus
              ? NOTES[focus]
              : "Tap an edge type. Vertices are people and places; every edge has a label. Birth is recorded at state level, residence at city level, and the two countries have different regional structures: natural in a graph, awkward in a fixed table."}
          </span>
        </div>
      }
    >
      <Canvas w={800} h={345}>
        <Group x={200} y={22} w={500} h={84} label="united states · state → country → continent" />
        <Group x={200} y={192} w={580} h={84} label="europe · city → country → union → continent" />

        {EDGES.map((e, i) => (
          <g key={i}>
            <Arrow pts={e.pts} color={colorOf(e.type)} width={focus === e.type ? 2 : 1.5} />
            {e.label && <Label x={e.label.x} y={e.label.y} lines={e.type} size={10} mono color={labelColor(e.type)} anchor={e.label.anchor ?? "middle"} />}
          </g>
        ))}

        {/* people */}
        <circle cx={90} cy={150} r={34} fill="#fff" stroke={INK} strokeWidth={1.5} />
        <Label x={90} y={146} lines="Lucy" size={13} weight={600} />
        <Label x={90} y={162} lines="Person" size={10} mono color="var(--ink-2)" />
        <circle cx={90} cy={300} r={30} fill="#fff" stroke={INK} strokeWidth={1.5} />
        <Label x={90} y={296} lines="Alain" size={13} weight={600} />
        <Label x={90} y={312} lines="Person" size={10} mono color="var(--ink-2)" />

        {/* places, US chain */}
        <Box x={210} y={40} w={120} h={44} title="Idaho" sub="state" titleSize={12} />
        <Box x={380} y={40} w={130} h={44} title="United States" sub="country" titleSize={12} />
        <Box x={560} y={40} w={130} h={44} title="North America" sub="continent" titleSize={12} />

        {/* places, Europe chain */}
        <Box x={210} y={210} w={120} h={44} title="London" sub="city" titleSize={12} />
        <Box x={380} y={210} w={110} h={44} title="England" sub="country" titleSize={12} />
        <Box x={540} y={210} w={70} h={44} title="UK" sub="union" titleSize={12} />
        <Box x={660} y={210} w={110} h={44} title="Europe" sub="continent" titleSize={12} />

        <Label x={520} y={322} lines="every vertex: id, label, properties, in/out edges · every edge: tail, head, label, properties" size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}
