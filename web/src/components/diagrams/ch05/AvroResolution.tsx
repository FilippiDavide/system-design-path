"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, INK, INK2, Label, MONO, NEON } from "../primitives";

/** Bytes of the example record, Avro-encoded: values only. */
const BYTES = ["0c", "4d", "61", "72", "74", "69", "6e", "02", "f2", "14", "04", "16", "64", "61"];

type Status = "match" | "ignored" | "default";

interface Field {
  name: string;
  type: string;
  status: Status;
}

const WRITER_FIELDS: Field[] = [
  { name: "userName", type: "string", status: "match" },
  { name: "favoriteNumber", type: "long", status: "ignored" },
  { name: "interests", type: "array", status: "match" },
];
const READER_FIELDS: Field[] = [
  { name: "interests", type: "array", status: "match" },
  { name: "userName", type: "string", status: "match" },
  { name: "email", type: 'string = ""', status: "default" },
];

const STEPS = [
  {
    title: "the writer encodes",
    text: "The writer walks its own schema in field order and writes the values one after the other.",
  },
  {
    title: "values only",
    text: "The bytes carry no field names, no tags and no type markers. Without the writer's schema they cannot be decoded at all.",
  },
  {
    title: "fetch the writer's schema",
    text: "The reader needs the exact schema the data was written with: once at the start of a container file, by version number from a schema registry, or negotiated when a connection opens.",
  },
  {
    title: "resolution by name",
    text: "Avro matches the two schemas field by field, by name. Different order: fine. favoriteNumber exists only in the writer: ignored. email exists only in the reader: it takes its default. A reader field with no match and no default is a resolution error.",
  },
  {
    title: "the reader decodes",
    text: "The result is a record shaped like the reader's schema, whatever the writer's schema looked like.",
  },
];

const STATUS_COLOR: Record<Status, string> = {
  match: "var(--ok)",
  ignored: "var(--warn)",
  default: NEON.blue,
};

/**
 * Avro's schema resolution as a five-step walkthrough: writer, bytes,
 * the writer's schema arriving at the reader, the by-name match
 * against the reader's schema, and the decoded record.
 */
export function AvroResolution() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const on = (...steps: number[]) => (steps.includes(step) ? 1 : 0.3);
  const resolved = step >= 3;

  return (
    <Figure
      label="FIG 03"
      title={`avro · ${s.title}`}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            <button
              type="button"
              onClick={() => setStep((x) => Math.max(0, x - 1))}
              disabled={step === 0}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-3 py-1 font-dot text-sm font-bold border-x border-line">
              {step + 1}/{STEPS.length}
            </span>
            <button
              type="button"
              onClick={() => setStep((x) => Math.min(STEPS.length - 1, x + 1))}
              disabled={step === STEPS.length - 1}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Next
            </button>
          </span>
          <span>{s.text}</span>
        </div>
      }
    >
      <Canvas w={780} h={320}>
        {/* Top row: writer → bytes → reader */}
        <g opacity={on(0, 1)}>
          <Box x={30} y={30} w={110} h={54} title="Writer" accent={step === 0 ? NEON.magenta : undefined} />
          <Arrow pts={[140, 57, 186, 57]} color={step === 0 ? "magenta" : "ink"} />
        </g>
        <g opacity={on(0, 1, 4)}>
          {BYTES.map((b, i) => (
            <g key={i}>
              <rect
                x={190 + i * 20}
                y={44}
                width={20}
                height={26}
                fill={step === 1 ? "var(--surface-2)" : "#fff"}
                stroke={INK}
                strokeWidth={1}
              />
              <text x={200 + i * 20} y={57} textAnchor="middle" dominantBaseline="middle" fontFamily={MONO} fontSize={10} fill={INK}>
                {b}
              </text>
            </g>
          ))}
          <Label x={480} y={57} lines="…" size={12} />
          <Label x={330} y={86} lines="values only · no names, no tags, no types" size={10} mono color={step === 1 ? NEON.magenta : INK2} />
        </g>
        <g opacity={on(1, 4)}>
          <Arrow pts={[490, 57, 626, 57]} color={step === 4 ? "magenta" : "ink"} />
          <Box x={630} y={30} w={110} h={54} title="Reader" accent={step === 4 ? NEON.magenta : undefined} />
        </g>

        {/* Writer's schema */}
        <g opacity={on(0, 2, 3)}>
          <Arrow pts={[85, 84, 85, 146]} dashed noHead color="soft" />
          <Label x={94} y={115} lines="uses" size={10} mono color={INK2} anchor="start" />
          <SchemaBox
            x={30}
            y={150}
            title="Writer's schema"
            fields={WRITER_FIELDS}
            resolved={resolved}
            accent={step === 0 || step === 2 ? NEON.magenta : undefined}
          />
          <Label
            x={135}
            y={292}
            lines={"shipped once: container file,\nregistry version, connection setup"}
            size={10}
            mono
            color={step === 2 ? NEON.magenta : INK2}
          />
          <Arrow pts={[240, 220, 278, 220]} color={step === 2 ? "magenta" : "ink"} />
        </g>

        {/* Reader's schema */}
        <g opacity={on(3)}>
          <SchemaBox x={540} y={150} title="Reader's schema" fields={READER_FIELDS} resolved={resolved} accent={step === 3 ? NEON.magenta : undefined} />
          <Arrow pts={[540, 220, 502, 220]} color={step === 3 ? "magenta" : "ink"} />
        </g>

        {/* Resolution diamond */}
        <g opacity={on(2, 3, 4)}>
          <polygon
            points="390,172 500,220 390,268 280,220"
            fill="#fff"
            stroke={step === 3 ? NEON.magenta : INK}
            strokeWidth={step === 3 ? 2 : 1.5}
          />
          <Label x={390} y={220} lines={"Resolution\nby name"} size={13} weight={600} />
        </g>
        <g opacity={on(4)}>
          <Arrow
            pts={[390, 172, 390, 120, 685, 120, 685, 88]}
            color={step === 4 ? "magenta" : "ink"}
            label="record in the reader's shape"
            labelOffset={-10}
          />
        </g>
      </Canvas>
    </Figure>
  );
}

/** A schema as a titled list of fields; statuses appear once resolved. */
function SchemaBox({
  x,
  y,
  title,
  fields,
  resolved,
  accent,
}: {
  x: number;
  y: number;
  title: string;
  fields: Field[];
  resolved: boolean;
  accent?: string;
}) {
  const w = 210;
  const h = 120;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke={accent ?? INK} strokeWidth={accent ? 2 : 1.5} />
      <Label x={x + 10} y={y + 16} lines={title} size={10} mono upper color={INK2} anchor="start" />
      {fields.map((f, i) => {
        const fy = y + 42 + i * 24;
        const color = resolved ? STATUS_COLOR[f.status] : INK;
        return (
          <g key={f.name}>
            <text x={x + 10} y={fy} dominantBaseline="middle" fontFamily={MONO} fontSize={11} fill={color}>
              {f.name}
              <tspan fill={INK2}>: {f.type}</tspan>
            </text>
            {resolved && (
              <text x={x + w - 8} y={fy} textAnchor="end" dominantBaseline="middle" fontFamily={MONO} fontSize={9} fill={color}>
                {f.status}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
