"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Label, NEON, INK } from "../primitives";

/** Diamond-shaped decision node. */
function Diamond({ cx, cy, w, h, lines, accent }: { cx: number; cy: number; w: number; h: number; lines: string; accent?: string }) {
  const pts = `${cx - w / 2},${cy} ${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2}`;
  return (
    <g>
      <polygon points={pts} fill="#fff" stroke={accent ?? INK} strokeWidth={accent ? 2 : 1.5} />
      <Label x={cx} y={cy} lines={lines} size={11} weight={600} />
    </g>
  );
}

interface Leaf {
  key: string;
  title: string;
  y: number;
  q: number;
  why: string;
  arrow: number[];
  label: { x: number; y: number; text: string };
  note: string;
  color: keyof typeof NEON;
}

const LEAVES: Leaf[] = [
  {
    key: "doc",
    title: "Document",
    y: 16,
    q: 1,
    why: "one-to-many, tree loaded whole",
    arrow: [220, 90, 260, 90, 260, 36, 440, 36],
    label: { x: 350, y: 54, text: "one-to-many,\ntree loaded whole" },
    note: "A profile with its positions and degrees: a tree you read whole. Locality means one access. Keep documents small and update them rarely; thousands of children (comments on a viral post) push you back to tables.",
    color: "blue",
  },
  {
    key: "rel",
    title: "Relational",
    y: 76,
    q: 1,
    why: "simple many-to-many",
    arrow: [220, 90, 260, 90, 260, 96, 440, 96],
    label: { x: 350, y: 114, text: "simple\nmany-to-many" },
    note: "Many-to-one and many-to-many handled with join tables, foreign keys and secondary indexes. The default when all records have the same shape and the schema can document and protect them.",
    color: "green",
  },
  {
    key: "graph",
    title: "Graph",
    y: 140,
    q: 1,
    why: "everything connected, paths of variable length",
    arrow: [220, 90, 260, 90, 260, 160, 440, 160],
    label: { x: 350, y: 190, text: "everything connected,\npaths of variable\nlength" },
    note: "Anything can relate to anything and a query does not know how many hops it needs. WITHIN*0.. is one line in Cypher and a recursive CTE in SQL.",
    color: "magenta",
  },
  {
    key: "es",
    title: "Event sourcing + CQRS",
    y: 240,
    q: 2,
    why: "no single form serves all reads",
    arrow: [220, 260, 440, 260],
    label: { x: 330, y: 248, text: "yes" },
    note: "Write once, as immutable events in one log; derive as many read shapes as there are readers. The price: ordering across machines, deterministic replay, GDPR against immutability.",
    color: "orange",
  },
  {
    key: "df",
    title: "DataFrame",
    y: 330,
    q: 3,
    why: "analytics, ML, matrices",
    arrow: [220, 350, 440, 350],
    label: { x: 330, y: 338, text: "yes" },
    note: "Analytics and ML: a sequence of commands on your own copy of the data, matrices with thousands of sparse columns that a relational engine would not handle.",
    color: "violet",
  },
];

/**
 * Which model: three questions, five answers. Tap an answer to see
 * the path that leads there and the reason the chapter gives for it.
 */
export function DecisionTree() {
  const [active, setActive] = useState<string | null>(null);
  const leaf = LEAVES.find((l) => l.key === active);
  const hotQ = leaf?.q ?? 0;
  const hotColor = leaf ? NEON[leaf.color] : undefined;

  return (
    <Figure
      label="FIG 07"
      title="which model: the decision"
      caption={
        leaf ? (
          <span>
            <strong>{leaf.title}</strong> · {leaf.note}
          </span>
        ) : (
          "Tap a model. Two cross-cutting rules: the relationships decide, not fashion; and every model can emulate the others, but the emulation is awkward, so hybrids are often the best answer."
        )
      }
    >
      <Canvas w={800} h={400}>
        <Diamond cx={120} cy={90} w={200} h={84} lines={"Prevailing\nrelationships?"} accent={hotQ === 1 ? hotColor : undefined} />
        <Diamond cx={120} cy={260} w={200} h={84} lines={"No single form\nserves all reads?"} accent={hotQ === 2 ? hotColor : undefined} />
        <Diamond cx={120} cy={350} w={200} h={76} lines={"Analytics, ML,\nmatrices?"} accent={hotQ === 3 ? hotColor : undefined} />

        {LEAVES.map((l) => {
          const isActive = active === l.key;
          const dim = active !== null && !isActive;
          return (
            <g key={l.key} onClick={() => setActive(isActive ? null : l.key)} style={{ cursor: "pointer" }}>
              <Arrow pts={l.arrow} color={isActive ? l.color : dim ? "soft" : "ink"} width={isActive ? 2 : 1.5} />
              <Label x={l.label.x} y={l.label.y} lines={l.label.text} size={10} mono color={isActive ? NEON[l.color] : dim ? "var(--ink-3)" : "var(--ink-2)"} />
              <Box x={440} y={l.y} w={190} h={40} title={l.title} titleSize={12} accent={isActive ? NEON[l.color] : undefined} fill={dim ? "var(--surface-2)" : "#fff"} />
            </g>
          );
        })}

        <Label x={660} y={60} lines={"the relationships\ndecide, not fashion"} size={10} mono color="var(--ink-2)" anchor="start" />
        <Label x={660} y={300} lines={"every model emulates\nthe others, awkwardly:\nhybrids are often best"} size={10} mono color="var(--ink-2)" anchor="start" />
      </Canvas>
    </Figure>
  );
}
