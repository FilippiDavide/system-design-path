"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Group, Label, NEON, INK, INK2, MONO } from "../primitives";

/** Small relational table drawn as a header row plus mono rows. */
function Table({
  x,
  y,
  w,
  title,
  cols,
  rows,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  cols: string[];
  rows: string[][];
  accent?: string;
}) {
  const head = 22;
  const rh = 18;
  const h = head + rows.length * rh;
  const cw = w / cols.length;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke={accent ?? INK} strokeWidth={accent ? 2 : 1.5} />
      <rect x={x} y={y} width={w} height={head} fill="var(--surface-2)" stroke="none" />
      <line x1={x} y1={y + head} x2={x + w} y2={y + head} stroke={INK} strokeWidth={1} />
      <text x={x + 8} y={y + head / 2} dominantBaseline="middle" fontFamily={MONO} fontSize={11} fontWeight={600} fill={INK}>
        {title}
      </text>
      {cols.map((c, i) => (
        <text
          key={c}
          x={x + 6 + i * cw}
          y={y + head + rh / 2}
          dominantBaseline="middle"
          fontFamily={MONO}
          fontSize={10}
          fill={INK2}
          style={{ letterSpacing: "0.04em" }}
        >
          {c}
        </text>
      ))}
      {rows.map((r, ri) => (
        <g key={ri}>
          <line x1={x} y1={y + head + (ri + 1) * rh} x2={x + w} y2={y + head + (ri + 1) * rh} stroke="var(--line-soft)" strokeWidth={1} />
          {r.map((cell, ci) => (
            <text key={ci} x={x + 6 + ci * cw} y={y + head + (ri + 1.5) * rh} dominantBaseline="middle" fontFamily={MONO} fontSize={10} fill={INK}>
              {cell}
            </text>
          ))}
        </g>
      ))}
    </g>
  );
}

const CHILDREN = [
  { title: "position", sub: "President\n2009–2017" },
  { title: "position", sub: "Senator\n2005–2008" },
  { title: "education", sub: "Harvard\nJD" },
  { title: "education", sub: "Columbia\nBA" },
  { title: "contact_info", sub: "blog, twitter" },
];

/**
 * One résumé, two shapes. As a document the one-to-many relationships
 * are an explicit tree stored contiguously; as tables they are shredded
 * across four relations that a read has to join back together.
 */
export function OneToMany() {
  const [doc, setDoc] = useState(true);

  return (
    <Figure
      label="FIG 03"
      title={doc ? "one-to-many as a document tree" : "one-to-many shredded into tables"}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {(["Document", "Relational"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDoc(m === "Document")}
                aria-pressed={(m === "Document") === doc}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  (m === "Document") === doc ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {m}
              </button>
            ))}
          </span>
          <span>
            {doc
              ? "The tree is explicit and the whole profile is one contiguous string: one read brings everything back. Worth it only if you need the document whole and update it rarely."
              : "The same profile shredded into four tables with foreign keys. Rebuilding it costs a multi-way join or four queries; the structure lives in the schema, not in the record."}
          </span>
        </div>
      }
    >
      {doc ? (
        <Canvas w={780} h={290}>
          <Group x={15} y={14} w={750} h={226} label="one JSON document · user 251" />
          <Box x={315} y={30} w={150} h={50} title="user 251" sub="Barack Obama" accent={NEON.blue} />
          {CHILDREN.map((c, i) => {
            const x = 25 + i * 150;
            const cx = x + 65;
            return (
              <g key={i}>
                <Arrow pts={[390, 80, 390, 118, cx, 118, cx, 158]} />
                <Box x={x} y={158} w={130} h={62} title={c.title} sub={c.sub} titleSize={12} />
              </g>
            );
          })}
          <Label x={390} y={265} lines="locality · one access reads the whole tree · no joins" size={10} mono color={NEON.blue} />
        </Canvas>
      ) : (
        <Canvas w={780} h={290}>
          <Table
            x={30}
            y={30}
            w={220}
            title="users"
            cols={["user_id", "first_name", "region_id"]}
            rows={[["251", "Barack", "us:91"]]}
            accent={NEON.blue}
          />
          <Table
            x={300}
            y={30}
            w={230}
            title="positions"
            cols={["user_id", "job_title", "org"]}
            rows={[
              ["251", "President", "US gov"],
              ["251", "Senator", "US Senate"],
            ]}
          />
          <Table
            x={560}
            y={30}
            w={200}
            title="education"
            cols={["user_id", "school", "degree"]}
            rows={[
              ["251", "Harvard", "JD"],
              ["251", "Columbia", "BA"],
            ]}
          />
          <Table
            x={300}
            y={160}
            w={230}
            title="contact_info"
            cols={["user_id", "type", "value"]}
            rows={[
              ["251", "blog", "obama.org"],
              ["251", "twitter", "@BarackObama"],
            ]}
          />
          {/* foreign keys back to users.user_id */}
          <Arrow pts={[300, 62, 250, 62]} dashed color="soft" label="FK" labelOffset={-8} />
          <Arrow pts={[560, 62, 540, 62, 540, 20, 265, 20, 265, 44, 250, 44]} dashed color="soft" />
          <Arrow pts={[300, 190, 140, 190, 140, 70]} dashed color="soft" label="FK" labelOffset={12} />
          <Label x={565} y={220} lines={"3 joins or 4 queries\nto rebuild one profile"} size={10} mono color={NEON.orange} anchor="start" />
          <Label x={390} y={265} lines="shredding · the tree is implicit in the foreign keys" size={10} mono color="var(--ink-2)" />
        </Canvas>
      )}
    </Figure>
  );
}
