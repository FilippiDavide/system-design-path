"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Label, NEON } from "../primitives";

interface Layer {
  key: string;
  title: string;
  sub: string;
  who: string;
  note: string;
}

const LAYERS: Layer[] = [
  {
    key: "app",
    title: "Objects and APIs of the application",
    sub: "data structures in code · REST, GraphQL",
    who: "app developer",
    note: "The application developer models the world as objects and APIs. Nothing here knows about bytes: the layer below hides them.",
  },
  {
    key: "model",
    title: "General-purpose data model",
    sub: "tables · JSON documents · graph",
    who: "this chapter",
    note: "This chapter. The model decides how you write the code and how you think about the problem. Its languages (SQL, Cypher, SPARQL, Datalog) are declarative: you say what you want, and the engine is free to change algorithm, indexes and parallelism without you touching the query.",
  },
  {
    key: "bytes",
    title: "Bytes in memory, on disk, on the network",
    sub: "encodings · indexes · storage engines",
    who: "ch. 4",
    note: "The database engineer's layer: how a table or a document becomes bytes, how an index finds them again. Chapter 4.",
  },
  {
    key: "hw",
    title: "Currents, light, magnetic fields",
    sub: "hardware",
    who: "hardware",
    note: "The hardware engineer's layer. Every layer above pretends it does not exist, which is exactly the point of layering.",
  },
];

const BOX_X = 170;
const BOX_W = 400;
const BOX_H = 54;
const GAP = 16;
const TOP = 24;

/**
 * The stack of data models. Each layer hides the one below it; the
 * second one is the subject of the chapter. Tap a layer to read who
 * works at that level and what it hides.
 */
export function Layers() {
  const [active, setActive] = useState<string>("model");
  const info = LAYERS.find((l) => l.key === active) ?? LAYERS[1];

  return (
    <Figure
      label="FIG 02"
      title="layers of data models"
      caption={
        <span>
          <strong>{info.title}</strong> · {info.note}
        </span>
      }
    >
      <Canvas w={780} h={TOP + LAYERS.length * (BOX_H + GAP) + 10}>
        {LAYERS.map((l, i) => {
          const y = TOP + i * (BOX_H + GAP);
          const isActive = l.key === active;
          return (
            <g key={l.key} onClick={() => setActive(l.key)} style={{ cursor: "pointer" }}>
              <Box
                x={BOX_X}
                y={y}
                w={BOX_W}
                h={BOX_H}
                title={l.title}
                sub={l.sub}
                accent={isActive ? NEON.blue : undefined}
                fill={isActive ? "#fff" : "var(--surface-2)"}
                titleSize={12}
              />
              <Label
                x={BOX_X - 14}
                y={y + BOX_H / 2}
                lines={l.who}
                size={10}
                mono
                upper
                anchor="end"
                color={isActive ? NEON.blue : "var(--ink-2)"}
              />
              {i < LAYERS.length - 1 && (
                <Arrow pts={[BOX_X + BOX_W / 2, y + BOX_H, BOX_X + BOX_W / 2, y + BOX_H + GAP]} color="soft" />
              )}
            </g>
          );
        })}
        <Label x={BOX_X + BOX_W + 18} y={TOP + 6} lines="each layer hides" size={10} mono color="var(--ink-2)" anchor="start" />
        <Label x={BOX_X + BOX_W + 18} y={TOP + 20} lines="the one below" size={10} mono color="var(--ink-2)" anchor="start" />
        <Label
          x={BOX_X + BOX_W + 18}
          y={TOP + BOX_H + GAP + BOX_H / 2}
          lines={"declarative:\nWHAT, not HOW"}
          size={10}
          mono
          color={NEON.blue}
          anchor="start"
        />
      </Canvas>
    </Figure>
  );
}
