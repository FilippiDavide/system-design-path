"use client";

import { useState } from "react";

type Family = "Sharks" | "Mammals" | "Birds";

const ANIMALS: { name: string; family: Family }[] = [
  { name: "great white", family: "Sharks" },
  { name: "tiger", family: "Mammals" },
  { name: "eagle", family: "Birds" },
  { name: "hammerhead", family: "Sharks" },
  { name: "whale", family: "Mammals" },
  { name: "owl", family: "Birds" },
  { name: "bat", family: "Mammals" },
  { name: "penguin", family: "Birds" },
  { name: "mako", family: "Sharks" },
  { name: "human", family: "Mammals" },
  { name: "kiwi", family: "Birds" },
  { name: "dolphin", family: "Mammals" },
];

interface CodeLine {
  text: string;
  /** Line exists only because of the environment (index, cores): the reader wrote it. */
  env?: boolean;
  /** Line exists because of the question (filter, sort, limit). */
  q?: boolean;
}

/**
 * The same question asked declaratively (SQL) and imperatively (a
 * loop). Change the environment, an index or more cores, and watch
 * which text has to change: the SQL stays put while the engine picks a
 * new plan, the loop has to be rewritten by hand.
 */
export function DeclarativeLab() {
  const [family, setFamily] = useState<Family>("Sharks");
  const [sort, setSort] = useState(false);
  const [limit, setLimit] = useState(false);
  const [index, setIndex] = useState(false);
  const [cores, setCores] = useState(false);

  const matching = ANIMALS.filter((a) => a.family === family);
  const examined = index ? matching.length : ANIMALS.length;
  const result = (() => {
    let r = [...matching];
    if (sort) r = r.sort((a, b) => (a.name < b.name ? -1 : 1));
    if (limit) r = r.slice(0, 3);
    return r;
  })();

  const sql = [`SELECT * FROM animals`, `WHERE family = '${family}'`, ...(sort ? ["ORDER BY name"] : []), ...(limit ? ["LIMIT 3"] : [])];

  const plan: { step: string; detail: string }[] = [];
  if (index) plan.push({ step: "Index Scan", detail: `animals_family_idx = '${family}' · ${matching.length} rows` });
  else if (cores) plan.push({ step: "Parallel Seq Scan", detail: `4 workers · ${ANIMALS.length} rows, 3 each · filter family` });
  else plan.push({ step: "Seq Scan", detail: `${ANIMALS.length} rows · filter family = '${family}'` });
  if (sort && limit) plan.push({ step: "Top-N heapsort", detail: "keep the 3 smallest names, never sort the rest" });
  else if (sort) plan.push({ step: "Sort", detail: "by name" });
  if (limit) plan.push({ step: "Limit", detail: "3" });

  const code: CodeLine[] = [{ text: "function getAnimals() {" }, { text: "  const out = [];" }];
  if (cores && !index) {
    code.push(
      { text: "  const chunks = split(animals, 4);", env: true },
      { text: "  const parts = await Promise.all(", env: true },
      { text: "    chunks.map((c) => worker(c, (a) =>", env: true },
      { text: `      a.family === '${family}')));`, env: true },
      { text: "  for (const p of parts) out.push(...p);", env: true },
    );
  } else if (index) {
    code.push({ text: `  for (const a of byFamily.get('${family}')) {`, env: true }, { text: "    out.push(a);", env: true }, { text: "  }" });
  } else {
    code.push({ text: "  for (const a of animals) {" }, { text: `    if (a.family === '${family}') out.push(a);`, q: true }, { text: "  }" });
  }
  if (sort) code.push({ text: "  out.sort((x, y) => (x.name < y.name ? -1 : 1));", q: true });
  if (limit) code.push({ text: "  return out.slice(0, 3);", q: true });
  else code.push({ text: "  return out;" });
  code.push({ text: "}" });
  const envLines = code.filter((l) => l.env).length;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-ink-2">question</span>
        <span className="flex border border-line">
          {(["Sharks", "Mammals", "Birds"] as Family[]).map((f) => (
            <button key={f} type="button" onClick={() => setFamily(f)} aria-pressed={family === f} className={`px-3 py-1.5 ${family === f ? "bg-ink text-surface" : "hover:bg-surface-2"}`}>
              {f}
            </button>
          ))}
        </span>
        <Toggle on={sort} set={setSort} label="sort by name" />
        <Toggle on={limit} set={setLimit} label="limit 3" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-ink-2">environment</span>
        <Toggle on={index} set={setIndex} label="index on family" />
        <Toggle on={cores} set={setCores} label="4 cores" />
        <span className="ml-auto text-ink-2">
          rows examined <span className="font-dot text-sm">{examined}</span> / {ANIMALS.length}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        <div className="bg-surface p-3" style={{ boxShadow: "inset 4px 0 0 var(--neon-1)" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-semibold text-sm">Declarative · SQL</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ok">0 lines changed by you</span>
          </div>
          <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto">
            {sql.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </pre>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mt-3 mb-1">plan · chosen by the engine</p>
          <ol className="font-mono text-[11px] space-y-0.5">
            {plan.map((p) => (
              <li key={p.step} className="flex gap-2">
                <span className="font-semibold text-neon-1 w-36 shrink-0">{p.step}</span>
                <span className="text-ink-2">{p.detail}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-surface p-3" style={{ boxShadow: `inset 4px 0 0 ${envLines ? "var(--neon-2)" : "var(--neon-5)"}` }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-semibold text-sm">Imperative · code</span>
            <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${envLines ? "text-neon-2" : "text-ink-2"}`}>{envLines} lines changed by you</span>
          </div>
          <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto">
            {code.map((l, k) => (
              <span key={k} className={`block px-1 ${l.env ? "bg-neon-2/10 text-ink" : l.q ? "text-ink" : "text-ink-2"}`}>
                {l.text}
              </span>
            ))}
          </pre>
        </div>
      </div>

      <div className="border-t border-line-soft p-3 font-mono text-[11px]">
        <span className="text-ink-2">result · </span>
        {result.map((a) => a.name).join(", ")}
        <span className="text-ink-2">
          {" "}
          · {result.length} rows · identical in both
        </span>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        The declarative query names the result, not the procedure, so the engine owns the access method, the sort algorithm and the parallelism: add an index and the plan changes
        while the SQL does not. The loop spells out the how, so every change in the environment is a change you make, and the next optimization is yours to write too. That is the
        whole argument for declarative languages in SQL, Cypher, SPARQL and Datalog.
      </p>
    </div>
  );
}

/** Pressed/unpressed toggle in the lab's control-bar style. */
function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => set(!on)} aria-pressed={on} className={`border px-3 py-1.5 ${on ? "bg-ink text-surface border-ink" : "border-line-soft hover:border-ink"}`}>
      {label}
    </button>
  );
}
