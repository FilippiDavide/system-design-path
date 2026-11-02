"use client";

import { useState } from "react";

type FormatId = "json" | "msgpack" | "protobuf" | "avro";
type Kind = "name" | "marker" | "value";

interface Rec {
  name: string;
  num: number | null;
  interests: string[];
}

/** One run of bytes with a single meaning. */
interface Seg {
  bytes: number[];
  kind: Kind;
  note: string;
  /** Text shown on the chip; defaults to the hex dump. */
  show?: string;
}

interface Encoded {
  segs: Seg[];
  omitted: string[];
}

const FORMATS: { id: FormatId; label: string }[] = [
  { id: "json", label: "JSON" },
  { id: "msgpack", label: "MessagePack" },
  { id: "protobuf", label: "Protobuf" },
  { id: "avro", label: "Avro" },
];

const KIND: Record<Kind, { label: string; color: string }> = {
  name: { label: "field name", color: "var(--neon-2)" },
  marker: { label: "type · tag · length", color: "var(--neon-1)" },
  value: { label: "value", color: "var(--ink)" },
};

const DEFAULT: Rec = { name: "Martin", num: 1337, interests: ["daydreaming", "hacking"] };
const MAX_INTERESTS = 6;
const MAX_NUM = 2 ** 53 - 1;

const enc = new TextEncoder();
const utf8 = (s: string): number[] => Array.from(enc.encode(s));
const hex = (b: number[]): string => b.map((x) => x.toString(16).padStart(2, "0")).join(" ");

/** Unsigned LEB128 varint (Protobuf and Avro share it). */
function varint(n: number): number[] {
  const out: number[] = [];
  let v = n;
  do {
    let b = v % 128;
    v = Math.floor(v / 128);
    if (v > 0) b |= 0x80;
    out.push(b);
  } while (v > 0);
  return out;
}

/** Big-endian fixed-width integer. */
function bigEndian(n: number, len: number): number[] {
  const out: number[] = [];
  let v = n;
  for (let i = 0; i < len; i++) {
    out.unshift(v % 256);
    v = Math.floor(v / 256);
  }
  return out;
}

function encodeJson(r: Rec): Encoded {
  const segs: Seg[] = [];
  const t = (text: string, kind: Kind, note: string) => segs.push({ bytes: utf8(text), kind, note, show: text });
  t('{"userName":', "name", "key");
  t(`${JSON.stringify(r.name)},`, "value", "string");
  t('"favoriteNumber":', "name", "key");
  t(`${r.num === null ? "null" : String(r.num)},`, "value", r.num === null ? "null" : "int or float? JSON does not say");
  t('"interests":[', "name", "key");
  r.interests.forEach((s, i) => t(`${JSON.stringify(s)}${i < r.interests.length - 1 ? "," : ""}`, "value", "string"));
  t("]}", "marker", "end");
  return { segs, omitted: [] };
}

function msgpackStr(s: string, kind: Kind, note: string): Seg[] {
  const b = utf8(s);
  const head = b.length < 32 ? [0xa0 | b.length] : b.length < 256 ? [0xd9, b.length] : [0xda, ...bigEndian(b.length, 2)];
  return [
    { bytes: head, kind: "marker", note: `${b.length < 32 ? "fixstr" : "str"} · len ${b.length}` },
    { bytes: b, kind, note },
  ];
}

function encodeMsgpack(r: Rec): Encoded {
  const segs: Seg[] = [{ bytes: [0x83], kind: "marker", note: "fixmap · 3 keys" }];
  segs.push(...msgpackStr("userName", "name", "key"));
  segs.push(...msgpackStr(r.name, "value", "string"));
  segs.push(...msgpackStr("favoriteNumber", "name", "key"));
  const n = r.num;
  if (n === null) segs.push({ bytes: [0xc0], kind: "marker", note: "nil" });
  else if (n < 128) segs.push({ bytes: [n], kind: "value", note: "positive fixint" });
  else if (n < 256) segs.push({ bytes: [0xcc], kind: "marker", note: "uint8" }, { bytes: [n], kind: "value", note: String(n) });
  else if (n < 65536) segs.push({ bytes: [0xcd], kind: "marker", note: "uint16" }, { bytes: bigEndian(n, 2), kind: "value", note: String(n) });
  else if (n < 2 ** 32) segs.push({ bytes: [0xce], kind: "marker", note: "uint32" }, { bytes: bigEndian(n, 4), kind: "value", note: String(n) });
  else segs.push({ bytes: [0xcf], kind: "marker", note: "uint64" }, { bytes: bigEndian(n, 8), kind: "value", note: String(n) });
  segs.push(...msgpackStr("interests", "name", "key"));
  segs.push({ bytes: [0x90 | r.interests.length], kind: "marker", note: `fixarray · ${r.interests.length} items` });
  r.interests.forEach((s) => segs.push(...msgpackStr(s, "value", "string")));
  return { segs, omitted: [] };
}

function encodeProtobuf(r: Rec): Encoded {
  const segs: Seg[] = [];
  const omitted: string[] = [];
  const lenDelimited = (tag: number, s: string, field: string) => {
    const b = utf8(s);
    segs.push(
      { bytes: [(tag << 3) | 2], kind: "marker", note: `tag ${tag} · len-delimited` },
      { bytes: varint(b.length), kind: "marker", note: `len ${b.length}` },
      { bytes: b, kind: "value", note: field },
    );
  };
  if (r.name.length > 0) lenDelimited(1, r.name, "user_name");
  else omitted.push("user_name is empty: proto3 writes nothing for a default value");
  if (r.num === null || r.num === 0) {
    omitted.push(`favorite_number is ${r.num === null ? "null" : "0"}: proto3 has no null, a default value is simply absent`);
  } else {
    segs.push({ bytes: [(2 << 3) | 0], kind: "marker", note: "tag 2 · varint" }, { bytes: varint(r.num), kind: "value", note: `varint ${r.num}` });
  }
  r.interests.forEach((s) => lenDelimited(3, s, "interests (repeated)"));
  return { segs, omitted };
}

function encodeAvro(r: Rec): Encoded {
  const segs: Seg[] = [];
  const str = (s: string, field: string) => {
    const b = utf8(s);
    segs.push({ bytes: varint(2 * b.length), kind: "marker", note: `len ${b.length} (zigzag)` });
    if (b.length > 0) segs.push({ bytes: b, kind: "value", note: field });
  };
  str(r.name, "userName");
  if (r.num === null) segs.push({ bytes: [0x00], kind: "marker", note: "union branch 0 · null" });
  else segs.push({ bytes: [0x02], kind: "marker", note: "union branch 1 · long" }, { bytes: varint(2 * r.num), kind: "value", note: `zigzag ${r.num}` });
  if (r.interests.length > 0) {
    segs.push({ bytes: varint(2 * r.interests.length), kind: "marker", note: `array block · ${r.interests.length} items` });
    r.interests.forEach((s) => str(s, "interests item"));
  }
  segs.push({ bytes: [0x00], kind: "marker", note: "end of array" });
  return { segs, omitted: [] };
}

const ENCODERS: Record<FormatId, (r: Rec) => Encoded> = {
  json: encodeJson,
  msgpack: encodeMsgpack,
  protobuf: encodeProtobuf,
  avro: encodeAvro,
};

const size = (e: Encoded) => e.segs.reduce((a, s) => a + s.bytes.length, 0);

/**
 * The same record encoded four ways. Edit the record and watch the
 * byte counts move; pick a format to see every byte annotated with
 * what it is for: a field name, a type/tag/length marker, or a value.
 */
export function EncodingSizeLab() {
  const [rec, setRec] = useState<Rec>(DEFAULT);
  const [draft, setDraft] = useState("");
  const [format, setFormat] = useState<FormatId>("json");

  const encoded = Object.fromEntries(FORMATS.map((f) => [f.id, ENCODERS[f.id](rec)])) as Record<FormatId, Encoded>;
  const sizes = FORMATS.map((f) => ({ ...f, bytes: size(encoded[f.id]) }));
  const max = Math.max(...sizes.map((s) => s.bytes), 1);
  const jsonBytes = sizes[0].bytes;
  const current = encoded[format];

  const addInterest = () => {
    const s = draft.trim();
    if (!s || rec.interests.length >= MAX_INTERESTS) return;
    setRec({ ...rec, interests: [...rec.interests, s] });
    setDraft("");
  };

  const inputCls = "border border-line bg-surface px-2 py-1 font-mono text-[12px] min-w-0";

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-ink-2">byte layout of</span>
        <span className="flex flex-wrap gap-px border border-line">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              aria-pressed={format === f.id}
              className={`px-3 py-1.5 ${format === f.id ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {f.label}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => {
            setRec(DEFAULT);
            setDraft("");
          }}
          className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink"
        >
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_1.3fr] gap-px bg-line-soft">
        {/* Record editor */}
        <div className="bg-surface p-3 grid gap-3 content-start">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">the record · edit it</p>
          <label className="grid gap-1 text-[12px]">
            <span className="font-mono text-[11px]">userName</span>
            <input
              type="text"
              value={rec.name}
              maxLength={40}
              onChange={(e) => setRec({ ...rec, name: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="grid gap-1 text-[12px]">
            <span className="font-mono text-[11px]">favoriteNumber</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={MAX_NUM}
                step={1}
                value={rec.num ?? ""}
                disabled={rec.num === null}
                onChange={(e) => {
                  const v = Math.floor(Number(e.target.value));
                  setRec({ ...rec, num: Number.isFinite(v) ? Math.min(MAX_NUM, Math.max(0, v)) : 0 });
                }}
                className={`${inputCls} flex-1 disabled:opacity-40`}
              />
              <label className="flex items-center gap-1.5 font-mono text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rec.num === null}
                  onChange={(e) => setRec({ ...rec, num: e.target.checked ? null : DEFAULT.num })}
                  className="accent-black"
                />
                null
              </label>
            </span>
          </label>
          <div className="grid gap-1 text-[12px]">
            <span className="font-mono text-[11px]">interests</span>
            <span className="flex flex-wrap gap-1">
              {rec.interests.map((s, i) => (
                <span key={`${s}-${i}`} className="flex items-center gap-1 border border-line-soft px-2 py-0.5 font-mono text-[11px]">
                  {s}
                  <button
                    type="button"
                    aria-label={`remove ${s}`}
                    onClick={() => setRec({ ...rec, interests: rec.interests.filter((_, j) => j !== i) })}
                    className="text-ink-2 hover:text-bad"
                  >
                    ×
                  </button>
                </span>
              ))}
            </span>
            <span className="flex gap-1">
              <input
                type="text"
                value={draft}
                maxLength={40}
                placeholder={rec.interests.length >= MAX_INTERESTS ? "max 6 items" : "add an interest"}
                disabled={rec.interests.length >= MAX_INTERESTS}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInterest();
                  }
                }}
                className={`${inputCls} flex-1 disabled:opacity-40`}
              />
              <button
                type="button"
                onClick={addInterest}
                disabled={rec.interests.length >= MAX_INTERESTS || draft.trim() === ""}
                className="border border-ink px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-ink hover:text-surface disabled:opacity-40"
              >
                add
              </button>
            </span>
          </div>
        </div>

        {/* Sizes */}
        <div className="bg-surface p-3 grid gap-2 content-start">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">encoded size · bytes</p>
          {sizes.map((s) => {
            const sel = s.id === format;
            const delta = Math.round((1 - s.bytes / jsonBytes) * 100);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setFormat(s.id)}
                aria-pressed={sel}
                className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-left hover:bg-surface-2"
              >
                <span className={`font-mono text-[11px] ${sel ? "font-semibold" : "text-ink-2"}`}>{s.label}</span>
                <span className="h-3 border border-line-soft">
                  <span
                    className="block h-full transition-[width]"
                    style={{ width: `${(s.bytes / max) * 100}%`, background: sel ? "var(--neon-1)" : "var(--ink)" }}
                  />
                </span>
                <span className="font-dot text-lg font-bold leading-none">
                  {s.bytes}
                  {s.id !== "json" && jsonBytes > 0 && (
                    <span className="font-mono text-[9px] text-ink-2 font-normal"> {delta >= 0 ? `-${delta}` : `+${-delta}`}%</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Byte layout */}
      <div className="border-t border-line-soft p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
          <span>
            {FORMATS.find((f) => f.id === format)?.label} · {size(current)} bytes
          </span>
          {(Object.keys(KIND) as Kind[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5" style={{ background: KIND[k].color }} />
              {KIND[k].label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {current.segs.map((s, i) => (
            <span
              key={i}
              className="inline-grid border border-line-soft px-1.5 py-0.5 max-w-full"
              style={{ borderLeft: `3px solid ${KIND[s.kind].color}` }}
            >
              <span className="font-mono text-[11px] break-all">{s.show ?? hex(s.bytes)}</span>
              <span className="font-mono text-[9px] text-ink-2 whitespace-nowrap">
                {s.note} · {s.bytes.length} B
              </span>
            </span>
          ))}
        </div>
        {current.omitted.map((o) => (
          <p key={o} className="mt-2 font-mono text-[10px] text-warn">
            {o}
          </p>
        ))}
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        The binary JSON variants still spell out every field name, so they save little. Protobuf replaces names
        with one-byte tags; Avro drops even those and writes bare values, which is why it needs the
        writer&apos;s schema to decode. Make the names longer than the values (or the values longer than the
        names) and watch which formats care.
      </p>
    </div>
  );
}
