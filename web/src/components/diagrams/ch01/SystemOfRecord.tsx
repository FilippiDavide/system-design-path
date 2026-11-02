"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Label, NEON } from "../primitives";

const DERIVED = [
  { key: "cache", title: "Caches", why: "Faster reads of hot keys." },
  { key: "index", title: "Indexes", why: "Find records by something other than the primary key." },
  { key: "mv", title: "Materialized views", why: "Pre-computed joins and denormalizations." },
  { key: "ml", title: "ML models", why: "A compressed, lossy view of the data." },
  { key: "dw", title: "Data warehouse", why: "The same facts, reshaped for analysts." },
];

/**
 * The hub: one system of record, many derived copies. Tap a derived
 * node to see why it exists; every one of them can be rebuilt from the
 * source, which is what the dashed arrows say.
 */
export function SystemOfRecord() {
  const [active, setActive] = useState<string | null>(null);
  const info = DERIVED.find((d) => d.key === active);

  return (
    <Figure
      label="FIG 03"
      title="system of record vs derived data"
      caption={
        info ? (
          <span>
            <strong>{info.title}</strong> · {info.why} Redundant by design: delete it and it can be recreated from the source.
          </span>
        ) : (
          "Tap a derived store. The source of truth holds each fact exactly once; everything else is a redundant, recreatable view kept for read performance."
        )
      }
    >
      <Canvas w={780} h={300}>
        <Box x={20} y={122} w={100} h={56} title="User input" />
        <Arrow pts={[120, 150, 170, 150]} />
        <Cylinder x={170} y={96} w={170} h={108} title="System of record" sub={"source of truth\neach fact once"} accent={NEON.blue} />

        {DERIVED.map((d, i) => {
          const y = 22 + i * 54;
          const isActive = active === d.key;
          const cx = 520;
          return (
            <g key={d.key} onClick={() => setActive(isActive ? null : d.key)} style={{ cursor: "pointer" }}>
              <Arrow pts={[340, 150, 420, 150, 420, y + 23, cx, y + 23]} color={isActive ? "magenta" : "ink"} />
              <Arrow pts={[cx + 150, y + 30, 660, y + 30, 660, 260, 255, 260, 255, 204]} dashed color={isActive ? "magenta" : "soft"} width={1} />
              <Cylinder x={cx} y={y} w={150} h={46} title={d.title} accent={isActive ? NEON.magenta : undefined} fill={isActive ? "#fff" : "#fff"} />
            </g>
          );
        })}
        <Label x={460} y={275} lines="recreatable from the source" size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}
