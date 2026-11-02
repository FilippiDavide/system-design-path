"use client";

import { useState } from "react";

type Format = "protobuf" | "avro";
type Verdict = "ok" | "warn" | "bad";

interface Side {
  v: Verdict;
  text: string;
}

interface Op {
  id: string;
  label: string;
  /** The v2 schema, as lines. */
  schema: string[];
  /** Backward: new code reads old data. */
  backward: Side;
  /** Forward: old code reads new data. */
  forward: Side;
  /** The rule that decides the verdicts. */
  rule: string;
  violated: boolean;
}

const PROTO_V1 = [
  "message Person {",
  "  string user_name = 1;",
  "  int32 favorite_number = 2;",
  "  repeated string interests = 3;",
  "}",
];

const AVRO_V1 = [
  "record Person {",
  "  string userName;",
  "  union { null, long } favoriteNumber = null;",
  "  array<string> interests;",
  "}",
];

const PROTO_OPS: Op[] = [
  {
    id: "add",
    label: "Add a field",
    schema: [...PROTO_V1.slice(0, 4), "  string email = 4;", "}"],
    backward: { v: "ok", text: "Old bytes have no tag 4, so the new code fills email with its default (an empty string)." },
    forward: {
      v: "ok",
      text: "Old code meets tag 4 for the first time. The wire type packed into the tag byte says how many bytes to skip, so it skips them, and must keep them for a later write-back.",
    },
    rule: "A new field gets a new tag and must be optional (with a default), so that old data still decodes.",
    violated: false,
  },
  {
    id: "remove",
    label: "Remove a field",
    schema: [PROTO_V1[0], PROTO_V1[1], "  reserved 2;", PROTO_V1[3], "}"],
    backward: { v: "ok", text: "Old bytes still carry tag 2; the new code skips it like any unknown field." },
    forward: { v: "ok", text: "New bytes have no tag 2; the old code fills favorite_number with its default." },
    rule: "The removed tag is declared reserved: it may never be given to another field.",
    violated: false,
  },
  {
    id: "reuse",
    label: "Reuse its tag",
    schema: [PROTO_V1[0], PROTO_V1[1], "  string email = 2;", PROTO_V1[3], "}"],
    backward: {
      v: "bad",
      text: "Old bytes carry tag 2 as a varint; the new code expects a length-delimited string at tag 2. Wire-type mismatch: decode error or garbage.",
    },
    forward: { v: "bad", text: "New bytes carry tag 2 as a string; the old code reads it as favorite_number: garbage." },
    rule: "A tag is the identity of a field and is never reused.",
    violated: true,
  },
  {
    id: "rename",
    label: "Rename a field",
    schema: [PROTO_V1[0], "  string display_name = 1;", PROTO_V1[2], PROTO_V1[3], "}"],
    backward: { v: "ok", text: "The bytes contain tags, not names: tag 1 is still tag 1 and decodes into display_name." },
    forward: { v: "ok", text: "The old code reads tag 1 into user_name. The name only exists in the generated code." },
    rule: "Renaming is free: field names never reach the wire.",
    violated: false,
  },
  {
    id: "retag",
    label: "Change a tag",
    schema: [PROTO_V1[0], "  string user_name = 5;", PROTO_V1[2], PROTO_V1[3], "}"],
    backward: {
      v: "bad",
      text: "Every existing record stores the name under tag 1. The new code knows no tag 1: it skips it, and user_name comes out empty.",
    },
    forward: { v: "bad", text: "New records store the name under tag 5; the old code skips tag 5 and sees an empty user_name." },
    rule: "Changing a tag invalidates all existing data.",
    violated: true,
  },
  {
    id: "widen",
    label: "int32 to int64",
    schema: [PROTO_V1[0], PROTO_V1[1], "  int64 favorite_number = 2;", PROTO_V1[3], "}"],
    backward: { v: "ok", text: "A varint written by int32 code is a small number; reading it into an int64 loses nothing." },
    forward: {
      v: "warn",
      text: "The old code reads a 64-bit varint into a 32-bit variable: any value above 2^31 is truncated, silently.",
    },
    rule: "Type changes are possible, but a wider value read by old code is truncated.",
    violated: true,
  },
];

const AVRO_OPS: Op[] = [
  {
    id: "add-default",
    label: "Add with default",
    schema: [...AVRO_V1.slice(0, 4), '  string email = "";', "}"],
    backward: { v: "ok", text: "email is in the reader's schema but not in the writer's: the reader fills in the default." },
    forward: { v: "ok", text: "email is in the writer's schema but not in the reader's: it is ignored." },
    rule: "A field can be added only with a default value.",
    violated: false,
  },
  {
    id: "add-nodefault",
    label: "Add without default",
    schema: [...AVRO_V1.slice(0, 4), "  string email;", "}"],
    backward: {
      v: "bad",
      text: "The reader expects email, the writer's schema has no such field and there is no default: schema resolution fails.",
    },
    forward: { v: "ok", text: "Old readers ignore the field they do not know." },
    rule: "Add only fields with a default. null is not an implicit default: write union { null, string } email = null.",
    violated: true,
  },
  {
    id: "remove-default",
    label: "Remove with default",
    schema: [AVRO_V1[0], AVRO_V1[1], AVRO_V1[3], "}"],
    backward: { v: "ok", text: "favoriteNumber is in the writer's schema but not in the reader's: ignored." },
    forward: {
      v: "ok",
      text: "The old reader expects favoriteNumber, the new writer did not write it: the reader uses the default null.",
    },
    rule: "Remove only fields that have a default value.",
    violated: false,
  },
  {
    id: "remove-nodefault",
    label: "Remove without default",
    schema: [AVRO_V1[0], AVRO_V1[2], AVRO_V1[3], "}"],
    backward: { v: "ok", text: "userName is in the writer's schema but not in the reader's: ignored." },
    forward: {
      v: "bad",
      text: "The old reader expects userName, which has no default, and the new writer does not write it: schema resolution fails.",
    },
    rule: "Remove only fields that have a default value.",
    violated: true,
  },
  {
    id: "rename",
    label: "Rename with alias",
    schema: [AVRO_V1[0], '  string displayName; // aliases: ["userName"]', AVRO_V1[2], AVRO_V1[3], "}"],
    backward: { v: "ok", text: "The new reader's alias matches the old writer's userName by name." },
    forward: {
      v: "bad",
      text: "The old reader looks for userName; the new writer has displayName and the old reader knows no alias: resolution fails.",
    },
    rule: "Aliases live in the reader's schema: renaming is backward but not forward compatible.",
    violated: true,
  },
  {
    id: "union",
    label: "Add a union branch",
    schema: [AVRO_V1[0], AVRO_V1[1], "  union { null, long, string } favoriteNumber = null;", AVRO_V1[3], "}"],
    backward: { v: "ok", text: "The new reader accepts every branch the old writer could have written." },
    forward: {
      v: "bad",
      text: "When the new writer uses the string branch, the old reader's union has no such branch: resolution fails.",
    },
    rule: "Adding a union branch is backward but not forward compatible.",
    violated: true,
  },
];

const VERDICT: Record<Verdict, { label: string; cls: string; dot: string }> = {
  ok: { label: "reads fine", cls: "text-ok", dot: "bg-ok" },
  warn: { label: "reads, silently wrong", cls: "text-warn", dot: "bg-warn" },
  bad: { label: "cannot read", cls: "text-bad", dot: "bg-bad" },
};

/**
 * Schema evolution simulator. Pick a format and a change to the
 * schema; the two verdict cards say whether new code can still read
 * old data (backward) and old code can still read new data (forward),
 * and which rule of the format decides it.
 */
export function SchemaEvolutionLab() {
  const [format, setFormat] = useState<Format>("protobuf");
  const [opId, setOpId] = useState<string>("add");

  const ops = format === "protobuf" ? PROTO_OPS : AVRO_OPS;
  const v1 = format === "protobuf" ? PROTO_V1 : AVRO_V1;
  const op = ops.find((o) => o.id === opId) ?? ops[0];

  const pick = (f: Format) => {
    setFormat(f);
    setOpId(f === "protobuf" ? PROTO_OPS[0].id : AVRO_OPS[0].id);
  };

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line">
          {(["protobuf", "avro"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => pick(f)}
              aria-pressed={format === f}
              className={`px-3 py-1.5 ${format === f ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {f === "protobuf" ? "Protocol Buffers" : "Avro"}
            </button>
          ))}
        </span>
        <span className="text-ink-2 hidden sm:inline">· change v1 into v2:</span>
        {ops.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOpId(o.id)}
            aria-pressed={op.id === o.id}
            className={`px-3 py-1.5 border ${op.id === o.id ? "border-ink bg-ink text-surface" : "border-line-soft hover:border-ink"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        <div className="bg-surface p-3 grid gap-3">
          <Schema title="v1 · old code" lines={v1} other={op.schema} removed />
          <Schema title="v2 · new code" lines={op.schema} other={v1} />
        </div>
        <div className="bg-surface p-3 grid gap-3 content-start">
          <VerdictCard
            dir="Backward"
            who="new code (v2) reads data written by v1"
            side={op.backward}
            accent="var(--neon-1)"
          />
          <VerdictCard
            dir="Forward"
            who="old code (v1) reads data written by v2"
            side={op.forward}
            accent="var(--neon-2)"
          />
          <div className="border border-line-soft p-3 text-[12px] leading-relaxed">
            <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${op.violated ? "text-bad" : "text-ink-2"}`}>
              {op.violated ? "rule violated" : "rule respected"}
            </span>
            <p className="mt-1">{op.rule}</p>
          </div>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        In Protobuf the tag is the identity of a field: names are free, tags are forever. In Avro there are no
        tags, fields are matched by name between the writer&apos;s and the reader&apos;s schema, so every field you add
        or remove needs a default value for the side that does not have it. Both let old and new code coexist
        during a rolling upgrade as long as you stay inside these rules.
      </p>
    </div>
  );
}

/** A schema listing; lines absent from `other` are highlighted. */
function Schema({ title, lines, other, removed = false }: { title: string; lines: string[]; other: string[]; removed?: boolean }) {
  return (
    <div className="border border-line-soft">
      <p className="px-3 py-1.5 border-b border-line-soft font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{title}</p>
      <pre className="px-3 py-2 font-mono text-[11px] leading-relaxed overflow-x-auto">
        {lines.map((l, i) => {
          const changed = !other.includes(l);
          const cls = changed ? (removed ? "line-through text-ink-3" : "text-neon-1 font-semibold") : "";
          return (
            <span key={i} className={`block ${cls}`}>
              {l}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

function VerdictCard({ dir, who, side, accent }: { dir: string; who: string; side: Side; accent: string }) {
  const v = VERDICT[side.v];
  return (
    <div className="border border-line-soft p-3" style={{ boxShadow: `inset 4px 0 0 ${accent}` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold text-sm">{dir}</span>
        <span className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${v.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
          {v.label}
        </span>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mt-0.5">{who}</p>
      <p className="mt-2 text-[12px] leading-relaxed">{side.text}</p>
    </div>
  );
}
