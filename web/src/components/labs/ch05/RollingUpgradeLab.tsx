"use client";

import { useState } from "react";

type Version = 1 | 2;
type Status = "ok" | "warn" | "bad";

interface Rec {
  name: string;
  age: number;
  /** The field that only v2 knows about. */
  nickname: string | null;
  writtenBy: Version;
}

interface Event {
  n: number;
  who: string;
  text: string;
  status: Status;
}

const INITIAL: Rec = { name: "ada", age: 30, nickname: null, writtenBy: 1 };
const NICK = "ada_l";

const DOT: Record<Status, string> = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" };

/**
 * Rolling upgrade through a database. Three app instances share one
 * record; upgrade them one at a time and read or read-modify-write
 * from each. v2 adds a `nickname` field. Whether a read breaks depends
 * on the field's default; whether a write-back loses the field depends
 * on whether old code preserves unknown fields.
 */
export function RollingUpgradeLab() {
  const [versions, setVersions] = useState<Version[]>([1, 1, 1]);
  const [rec, setRec] = useState<Rec>(INITIAL);
  const [preserve, setPreserve] = useState(false);
  const [hasDefault, setHasDefault] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [counter, setCounter] = useState(0);
  const [lost, setLost] = useState(0);

  const log = (who: string, text: string, status: Status) => {
    const n = counter + 1;
    setCounter(n);
    setEvents((e) => [...e, { n, who, text, status }].slice(-7));
  };

  const who = (i: number) => `app-${i + 1} · v${versions[i]}`;

  /** What instance `i` sees when it decodes the stored record. */
  const decode = (i: number): { ok: boolean; text: string; status: Status } => {
    if (versions[i] === 1) {
      if (rec.nickname === null) return { ok: true, text: `reads {name: ${rec.name}, age: ${rec.age}}`, status: "ok" };
      return preserve
        ? { ok: true, text: `reads {name, age} · unknown field nickname kept as opaque bytes`, status: "ok" }
        : { ok: true, text: `reads {name, age} · unknown field nickname dropped from the in-memory object`, status: "warn" };
    }
    if (rec.nickname === null) {
      return hasDefault
        ? { ok: true, text: `reads {name, age, nickname: null} · missing field took its default`, status: "ok" }
        : { ok: false, text: `decode error: nickname missing and no default · backward compatibility broken`, status: "bad" };
    }
    return { ok: true, text: `reads {name: ${rec.name}, age: ${rec.age}, nickname: ${rec.nickname}}`, status: "ok" };
  };

  const read = (i: number) => {
    const d = decode(i);
    log(who(i), d.text, d.status);
  };

  const bump = (i: number) => {
    const d = decode(i);
    if (!d.ok) {
      log(who(i), `${d.text} · write aborted`, "bad");
      return;
    }
    if (versions[i] === 1) {
      const keep = preserve ? rec.nickname : null;
      const dropped = rec.nickname !== null && !preserve;
      setRec({ ...rec, age: rec.age + 1, nickname: keep, writtenBy: 1 });
      if (dropped) {
        setLost((l) => l + 1);
        log(who(i), `writes back {name, age: ${rec.age + 1}} · nickname silently lost`, "bad");
      } else {
        log(who(i), `writes back {name, age: ${rec.age + 1}${keep ? ", nickname (unknown bytes passed through)" : ""}}`, "ok");
      }
      return;
    }
    const nick = rec.nickname ?? NICK;
    setRec({ ...rec, age: rec.age + 1, nickname: nick, writtenBy: 2 });
    log(who(i), `writes back {name, age: ${rec.age + 1}, nickname: ${nick}}${rec.nickname === null ? " · new field written" : ""}`, "ok");
  };

  const upgrade = (i: number) => {
    setVersions((v) => v.map((x, j) => (j === i ? 2 : x)) as Version[]);
    log(`app-${i + 1} · v1`, "restarted on v2", "ok");
  };

  const reset = () => {
    setVersions([1, 1, 1]);
    setRec(INITIAL);
    setEvents([]);
    setCounter(0);
    setLost(0);
  };

  const smallBtn = "border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-40";

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} className="accent-black" />
          v1 keeps unknown fields
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={hasDefault} onChange={(e) => setHasDefault(e.target.checked)} className="accent-black" />
          v2 field has a default
        </label>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      {/* Instances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line-soft">
        {versions.map((v, i) => (
          <div key={i} className="bg-surface p-3" style={{ boxShadow: `inset 0 4px 0 ${v === 2 ? "var(--neon-1)" : "var(--ink)"}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">app-{i + 1}</span>
              <span
                className={`font-dot text-sm font-bold px-1.5 border ${v === 2 ? "border-neon-1 text-neon-1" : "border-ink"}`}
              >
                v{v}
              </span>
            </div>
            <p className="font-mono text-[10px] text-ink-2 mb-2 h-[28px] leading-snug">
              {v === 1 ? "knows name, age" : `knows name, age, nickname${hasDefault ? " = null" : " (no default)"}`}
            </p>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => upgrade(i)}
                disabled={v === 2}
                className={`${smallBtn} border-ink hover:bg-ink hover:text-surface`}
              >
                Upgrade
              </button>
              <button type="button" onClick={() => read(i)} className={`${smallBtn} border-line-soft hover:border-ink`}>
                Read
              </button>
              <button type="button" onClick={() => bump(i)} className={`${smallBtn} border-line-soft hover:border-ink`}>
                Bump age
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr_1.4fr] gap-px bg-line-soft border-t border-line-soft">
        {/* Database */}
        <div className="bg-surface p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-semibold text-sm">Database · user 42</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">written by v{rec.writtenBy}</span>
          </div>
          <div className="flex flex-wrap gap-1 font-mono text-[11px]">
            <span className="border border-line-soft px-2 py-0.5">name: {rec.name}</span>
            <span className="border border-line-soft px-2 py-0.5">age: {rec.age}</span>
            {rec.nickname !== null && (
              <span className="border px-2 py-0.5" style={{ borderColor: "var(--neon-1)", color: "var(--neon-1)" }}>
                nickname: {rec.nickname}
              </span>
            )}
          </div>
          <p className={`mt-3 font-dot text-2xl font-bold ${lost > 0 ? "text-bad" : "text-ink-3"}`}>
            {lost}
            <span className="font-sans text-xs font-normal"> × nickname lost</span>
          </p>
        </div>

        {/* Log */}
        <div className="bg-surface p-3 min-h-[120px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">log</p>
          {events.length === 0 ? (
            <p className="text-[12px] text-ink-3">
              Upgrade app-1, bump the age from it, then read or bump from app-2 while it is still on v1.
            </p>
          ) : (
            <ol className="font-mono text-[11px] space-y-1">
              {events.map((e) => (
                <li key={e.n} className="flex gap-2 items-start">
                  <span className="font-dot text-sm w-5 shrink-0">{e.n}</span>
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${DOT[e.status]}`} />
                  <span className="text-ink-2 w-[86px] shrink-0">{e.who}</span>
                  <span className={e.status === "bad" ? "text-bad" : ""}>{e.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        During a rolling upgrade old and new code read the same rows. v2 reading a v1 row needs backward
        compatibility (a default for the new field); v1 reading a v2 row needs forward compatibility (skip what
        it does not know). The third case is the trap: v1 reads, modifies and writes back, and unless it kept the
        unknown field as opaque bytes, the nickname written by v2 is gone.
      </p>
    </div>
  );
}
