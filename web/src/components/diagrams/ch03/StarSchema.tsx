"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Label, NEON } from "../primitives";

type Mode = "star" | "snowflake" | "obt";

interface Dim {
  key: string;
  name: string;
  x: number;
  y: number;
  w: number;
  q: string;
  note: string;
  line: number[];
}

const FACT = { x: 320, y: 160, w: 160, h: 72 };

const DIMS: Dim[] = [
  {
    key: "product",
    name: "dim_product",
    x: 40,
    y: 90,
    w: 130,
    q: "what",
    note: "WHAT was sold: name, brand, category, hundreds of attributes. Wide tables are normal here.",
    line: [170, 112, 320, 170],
  },
  {
    key: "store",
    name: "dim_store",
    x: 630,
    y: 90,
    w: 130,
    q: "where",
    note: "WHERE it was sold: city, region, store format. Many sales point to the same store: many-to-one.",
    line: [630, 112, 480, 170],
  },
  {
    key: "customer",
    name: "dim_customer",
    x: 40,
    y: 290,
    w: 130,
    q: "who",
    note: "WHO bought: segment, loyalty tier, sign-up date. Almost all relationships in a star are many-to-one.",
    line: [170, 312, 320, 232],
  },
  {
    key: "date",
    name: "dim_date",
    x: 630,
    y: 290,
    w: 130,
    q: "when",
    note: "WHEN: even the date is a dimension, one row per day with weekday and holiday flags, so analysts can tell a holiday apart.",
    line: [630, 312, 480, 232],
  },
  {
    key: "promotion",
    name: "dim_promotion",
    x: 340,
    y: 20,
    w: 120,
    q: "why",
    note: "WHY: which campaign or discount was running when the sale happened.",
    line: [400, 64, 400, 160],
  },
];

const SUBDIMS = [
  { name: "dim_brand", x: 40, y: 20, w: 130, line: [105, 90, 105, 64] },
  { name: "dim_category", x: 190, y: 20, w: 130, line: [150, 90, 150, 76, 255, 76, 255, 64] },
  { name: "dim_region", x: 630, y: 20, w: 130, line: [695, 90, 695, 64] },
];

const CAPTIONS: Record<Mode, string> = {
  star: "Tap a table. The fact table has one event per row (a sale) with its numbers and a foreign key per dimension; the dimensions answer who, what, where, when, why. Simple for analysts, so it is the preferred shape.",
  snowflake:
    "Dimensions broken into sub-dimensions: more normalized, more joins per query. The same data as the star, with less duplication and more work for the analyst.",
  obt: "One big table: the dimensions are folded into the fact table as plain columns. More space, sometimes faster queries, and denormalization does no harm here because the data is historical and never changes.",
};

/**
 * Star schema with three ways of normalizing the same sales facts.
 * Tap a dimension for the question it answers; switch to snowflake to
 * split dimensions further, or to one big table to drop them.
 */
export function StarSchema() {
  const [mode, setMode] = useState<Mode>("star");
  const [active, setActive] = useState<string | null>(null);
  const dim = DIMS.find((d) => d.key === active);

  return (
    <Figure
      label="FIG 04"
      title={mode === "star" ? "star schema" : mode === "snowflake" ? "snowflake schema" : "one big table"}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {(
              [
                ["star", "Star"],
                ["snowflake", "Snowflake"],
                ["obt", "One big table"],
              ] as [Mode, string][]
            ).map(([m, name]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setActive(null);
                }}
                aria-pressed={mode === m}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
              >
                {name}
              </button>
            ))}
          </span>
          <span>
            {mode !== "obt" && active === "fact" ? (
              <>
                <strong>fact_sales</strong> · one event per row: a sale, a click. Numeric attributes (price, cost) plus a foreign key to every dimension. It grows to petabytes.
              </>
            ) : mode !== "obt" && dim ? (
              <>
                <strong>{dim.name}</strong> · {dim.note}
              </>
            ) : (
              CAPTIONS[mode]
            )}
          </span>
        </div>
      }
    >
      <Canvas w={800} h={350}>
        {mode === "obt" ? (
          <>
            <Box x={60} y={70} w={680} h={60} title="fact_sales · one big table" sub="one event per row · every dimension copied in as columns" accent={NEON.magenta} />
            {[
              ["sale_id", "date", "weekday", "is_holiday", "price", "cost"],
              ["product_name", "brand", "category", "store_city", "store_region"],
              ["customer_name", "segment", "promotion_name", "discount", "..."],
            ].map((row, i) => (
              <g key={i}>
                <rect x={60} y={150 + i * 40} width={680} height={36} fill="#fff" stroke="var(--line-soft)" strokeWidth={1} />
                {row.map((c, j) => (
                  <Label key={c} x={60 + 12 + j * 113} y={168 + i * 40} lines={c} size={10} mono anchor="start" color={i === 0 ? "var(--ink)" : "var(--ink-2)"} />
                ))}
              </g>
            ))}
            <Label x={400} y={300} lines="no joins · duplicated text in every row · harmless because history does not change" size={10} mono color={NEON.magenta} />
          </>
        ) : (
          <>
            {DIMS.map((d) => {
              const isActive = active === d.key;
              return (
                <g key={d.key} onClick={() => setActive(isActive ? null : d.key)} style={{ cursor: "pointer" }}>
                  <Arrow pts={d.line} noHead color={isActive ? "blue" : "ink"} width={isActive ? 2 : 1.5} />
                  <Box x={d.x} y={d.y} w={d.w} h={44} title={d.name} titleSize={12} accent={isActive ? NEON.blue : undefined} />
                </g>
              );
            })}
            {mode === "snowflake" &&
              SUBDIMS.map((s) => (
                <g key={s.name}>
                  <Arrow pts={s.line} noHead color="magenta" />
                  <Box x={s.x} y={s.y} w={s.w} h={44} title={s.name} titleSize={12} accent={NEON.magenta} />
                </g>
              ))}
            <g onClick={() => setActive(active === "fact" ? null : "fact")} style={{ cursor: "pointer" }}>
              <Box
                x={FACT.x}
                y={FACT.y}
                w={FACT.w}
                h={FACT.h}
                title="fact_sales"
                sub={"one event per row\nFKs + price, cost"}
                accent={active === "fact" ? NEON.blue : NEON.green}
              />
            </g>
            <Label x={400} y={262} lines="each edge: many-to-one" size={10} mono color="var(--ink-2)" />
            <Label
              x={400}
              y={330}
              lines={mode === "snowflake" ? "more normalized · one more join per sub-dimension" : "one join per dimension · simplest for analysts"}
              size={10}
              mono
              color={mode === "snowflake" ? NEON.magenta : NEON.green}
            />
          </>
        )}
      </Canvas>
    </Figure>
  );
}
