"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "write" | "read";

interface Rec {
  id: number;
  name: string;
  /** Present once the record carries the new field. null = column exists, not filled. */
  first: string | null | undefined;
}

const NAMES = ["Ada Lovelace", "Alan Turing", "Grace Hopper", "Edgar Codd", "Barbara Liskov", "Donald Knuth", "Frances Allen", "Dennis Ritchie"];
const NEW_NAMES = ["Margaret Hamilton", "Ken Thompson", "Radia Perlman", "Leslie Lamport"];

const initial = (): Rec[] => NAMES.map((n, i) => ({ id: i + 1, name: n, first: undefined }));

/**
 * Adding a field in both worlds. Schema-on-write: ALTER TABLE is
 * instant, the UPDATE that fills the column rewrites every row while
 * the table is busy. Schema-on-read: nothing is migrated, new documents
 * carry the field and the read path grows a second branch for old ones.
 */
export function SchemaLab() {
  const [mode, setMode] = useState<Mode>("write");
  const [recs, setRecs] = useState<Rec[]>(initial);
  const [fieldAdded, setFieldAdded] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [readId, setReadId] = useState(1);
  const [lastRead, setLastRead] = useState<{ id: number; path: string; value: string } | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const switchMode = (m: Mode) => {
    clearTimers();
    setMode(m);
    setRecs(initial());
    setFieldAdded(false);
    setMigrating(false);
    setLastRead(null);
    setReadId(1);
  };

  const addField = () => {
    if (fieldAdded) return;
    setFieldAdded(true);
    setLastRead(null);
    if (mode === "write") {
      // ALTER TABLE: every row gets the column, NULL for now. Instant.
      setRecs((rs) => rs.map((r) => ({ ...r, first: null })));
      // UPDATE: rewrite rows one by one.
      setMigrating(true);
      recs.forEach((r, k) => {
        timers.current.push(
          window.setTimeout(() => {
            setRecs((rs) => rs.map((x) => (x.id === r.id ? { ...x, first: x.name.split(" ")[0] } : x)));
            if (k === recs.length - 1) setMigrating(false);
          }, 350 * (k + 1)),
        );
      });
    }
  };

  const insert = () => {
    const n = NEW_NAMES[(recs.length - NAMES.length) % NEW_NAMES.length];
    const id = recs.length + 1;
    setRecs((rs) => [...rs, { id, name: n, first: fieldAdded ? n.split(" ")[0] : undefined }]);
    setLastRead(null);
  };

  const read = () => {
    const r = recs.find((x) => x.id === readId);
    if (!r) return;
    if (mode === "write") {
      if (!fieldAdded) setLastRead({ id: r.id, path: "SELECT name FROM users WHERE id = " + r.id, value: r.name });
      else if (r.first === null) setLastRead({ id: r.id, path: "first_name IS NULL → fill in on read: split(name)", value: r.name.split(" ")[0] + " (computed)" });
      else setLastRead({ id: r.id, path: "SELECT first_name FROM users WHERE id = " + r.id, value: r.first ?? "" });
    } else {
      if (!fieldAdded) setLastRead({ id: r.id, path: "return doc.name", value: r.name });
      else if (r.first) setLastRead({ id: r.id, path: "if (doc.first_name) → new document, fast path", value: r.first });
      else setLastRead({ id: r.id, path: "else → old document, split(doc.name) on read", value: r.name.split(" ")[0] + " (computed)" });
    }
  };

  const reset = () => switchMode(mode);
  const filled = recs.filter((r) => typeof r.first === "string").length;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex border border-line">
          {(
            [
              ["write", "Schema-on-write"],
              ["read", "Schema-on-read"],
            ] as [Mode, string][]
          ).map(([m, name]) => (
            <button key={m} type="button" onClick={() => switchMode(m)} aria-pressed={mode === m} className={`px-3 py-1.5 ${mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"}`}>
              {name}
            </button>
          ))}
        </span>
        <button type="button" onClick={addField} disabled={fieldAdded} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Add first_name
        </button>
        <button type="button" onClick={insert} disabled={migrating || recs.length >= 12} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Insert user
        </button>
        <label className="flex items-center gap-2">
          <button type="button" onClick={read} className="border border-line-soft px-3 py-1.5 hover:border-ink">
            Read
          </button>
          <select value={readId} onChange={(e) => setReadId(Number(e.target.value))} aria-label="Record to read" className="border border-line-soft bg-surface px-2 py-1.5 font-mono text-[11px]">
            {recs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        <div className="bg-surface p-3 min-w-0" style={{ boxShadow: `inset 4px 0 0 ${mode === "write" ? "var(--neon-1)" : "var(--neon-5)"}` }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-semibold text-sm">{mode === "write" ? "users table" : "users collection"}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
              {migrating ? (
                <span className="text-neon-5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-5 animate-pulse" /> UPDATE running · {filled}/{recs.length} rows rewritten
                </span>
              ) : mode === "write" ? (
                fieldAdded ? "schema: id, name, first_name" : "schema: id, name"
              ) : (
                `${filled} of ${recs.length} documents carry first_name`
              )}
            </span>
          </div>
          {mode === "write" ? (
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-ink-2 text-left">
                  <th className="font-normal py-0.5 w-10">id</th>
                  <th className="font-normal py-0.5">name</th>
                  {fieldAdded && <th className="font-normal py-0.5">first_name</th>}
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.id} className={lastRead?.id === r.id ? "bg-neon-1/10" : ""}>
                    <td className="py-0.5 text-ink-2">#{r.id}</td>
                    <td className="py-0.5">{r.name}</td>
                    {fieldAdded && <td className={`py-0.5 ${r.first === null ? "text-ink-3" : ""}`}>{r.first === null ? "NULL" : r.first}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="font-mono text-[11px] space-y-0.5">
              {recs.map((r) => (
                <li key={r.id} className={`py-0.5 ${lastRead?.id === r.id ? "bg-neon-5/10" : ""}`}>
                  {r.first ? `{ id: ${r.id}, name: "${r.name}", first_name: "${r.first}" }` : `{ id: ${r.id}, name: "${r.name}" }`}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-surface p-3 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">{mode === "write" ? "migration" : "read path · application code"}</p>
          {mode === "write" ? (
            <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto">
              <span className={`block ${fieldAdded ? "text-ink" : "text-ink-3"}`}>ALTER TABLE users ADD COLUMN first_name text;</span>
              <span className={`block ${fieldAdded ? "text-ok" : "text-ink-3"}`}>{fieldAdded ? "-- instant: NULL default, no row touched" : "-- not run yet"}</span>
              <span className={`block mt-2 ${fieldAdded ? "text-ink" : "text-ink-3"}`}>UPDATE users SET first_name = split_part(name, &apos; &apos;, 1);</span>
              <span className={`block ${migrating ? "text-neon-5" : fieldAdded ? "text-ok" : "text-ink-3"}`}>
                {migrating ? `-- rewriting every row: ${filled}/${recs.length}` : fieldAdded ? `-- done: ${recs.length} rows rewritten` : "-- not run yet"}
              </span>
            </pre>
          ) : (
            <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto">
              <span className="block text-ink">function firstName(doc) {"{"}</span>
              {fieldAdded ? (
                <>
                  <span className={`block ${lastRead?.path.startsWith("if") ? "bg-neon-5/10" : ""}`}>{"  if (doc.first_name) return doc.first_name;"}</span>
                  <span className={`block ${lastRead?.path.startsWith("else") ? "bg-neon-5/10" : ""}`}>{"  return doc.name.split(' ')[0]; // old docs"}</span>
                </>
              ) : (
                <span className={`block ${lastRead ? "bg-neon-5/10" : ""}`}>{"  return doc.name.split(' ')[0];"}</span>
              )}
              <span className="block text-ink">{"}"}</span>
            </pre>
          )}
          <div className="mt-3 border-t border-line-soft pt-2 font-mono text-[11px] min-h-[40px]">
            {lastRead ? (
              <>
                <p className="text-ink-2">{lastRead.path}</p>
                <p>
                  → <span className="font-semibold">{lastRead.value}</span>
                </p>
              </>
            ) : (
              <p className="text-ink-3">read a record to see which path it takes</p>
            )}
          </div>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {mode === "write"
          ? "The schema is explicit and enforced on write, like static type checking. Adding the column is cheap; filling it rewrites every row, which on a large table is slow and locks things up. The practical trick: leave the column NULL and fill it in on read, which is exactly what a document database does."
          : "Nothing is migrated. New documents carry the field, old ones do not, and the structure is now implicit: whoever reads has to handle both shapes forever, or until a background job rewrites the old ones. The schema did not disappear, it moved into the code. \"Schemaless\" means schema-on-read."}
      </p>
    </div>
  );
}
