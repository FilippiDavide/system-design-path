"use client";

import { useState } from "react";

interface User {
  id: number;
  name: string;
  regionId: string;
}

/** A denormalized profile carries the region text as a copy. */
interface Doc extends User {
  regionText: string;
}

interface Op {
  kind: "rename" | "crash" | "read" | "add";
  normWrites: number;
  normReads: number;
  denormWrites: number;
  denormReads: number;
  hlNormUsers: number[];
  hlRegion: boolean;
  hlDocs: number[];
}

const DC = "us:91";
const CA = "us:06";
const NAMES_DC = ["Ada", "Bob", "Cy", "Dee", "Eli", "Fay", "Gus", "Hal", "Ivy", "Jo", "Kim", "Lou"];
const SPELLINGS = ["Washington, DC", "District of Columbia"];

function initialUsers(): User[] {
  return [
    { id: 1, name: "Ada", regionId: DC },
    { id: 2, name: "Bob", regionId: CA },
    { id: 3, name: "Cy", regionId: DC },
    { id: 4, name: "Dee", regionId: DC },
    { id: 5, name: "Eli", regionId: CA },
    { id: 6, name: "Fay", regionId: DC },
  ];
}

/**
 * One region, two stores. The normalized store keeps the region's
 * name once and references it by ID; the denormalized store copies the
 * text into every profile. Renaming the region costs one write in the
 * first and one per profile in the second, and a crash halfway leaves
 * the copies disagreeing with each other.
 */
export function NormalizationLab() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [regions, setRegions] = useState<Record<string, string>>({ [DC]: SPELLINGS[0], [CA]: "California" });
  const [docs, setDocs] = useState<Doc[]>(() => initialUsers().map((u) => ({ ...u, regionText: u.regionId === DC ? SPELLINGS[0] : "California" })));
  const [op, setOp] = useState<Op | null>(null);
  const [readId, setReadId] = useState(3);

  const dcUsers = users.filter((u) => u.regionId === DC);
  const nextSpelling = regions[DC] === SPELLINGS[0] ? SPELLINGS[1] : SPELLINGS[0];
  const dcSpellings = new Set(docs.filter((d) => d.regionId === DC).map((d) => d.regionText));
  const inconsistent = dcSpellings.size > 1;

  const rename = (crash: boolean) => {
    const target = nextSpelling;
    setRegions((r) => ({ ...r, [DC]: target }));
    const victims = docs.filter((d) => d.regionId === DC).map((d) => d.id);
    const written = crash ? victims.slice(0, Math.ceil(victims.length / 2)) : victims;
    setDocs((ds) => ds.map((d) => (written.includes(d.id) ? { ...d, regionText: target } : d)));
    setOp({
      kind: crash ? "crash" : "rename",
      normWrites: 1,
      normReads: 0,
      denormWrites: written.length,
      denormReads: 0,
      hlNormUsers: [],
      hlRegion: true,
      hlDocs: written,
    });
  };

  const read = () => {
    setOp({
      kind: "read",
      normWrites: 0,
      normReads: 2,
      denormWrites: 0,
      denormReads: 1,
      hlNormUsers: [readId],
      hlRegion: true,
      hlDocs: [readId],
    });
  };

  const addUsers = () => {
    if (users.length >= 12) return;
    const start = users.length;
    const fresh: User[] = [0, 1, 2].map((k) => ({ id: start + k + 1, name: NAMES_DC[start + k], regionId: DC }));
    setUsers((u) => [...u, ...fresh]);
    setDocs((ds) => [...ds, ...fresh.map((u) => ({ ...u, regionText: regions[DC] }))]);
    setOp({
      kind: "add",
      normWrites: fresh.length,
      normReads: 0,
      denormWrites: fresh.length,
      denormReads: 0,
      hlNormUsers: fresh.map((u) => u.id),
      hlRegion: false,
      hlDocs: fresh.map((u) => u.id),
    });
  };

  const reset = () => {
    setUsers(initialUsers());
    setRegions({ [DC]: SPELLINGS[0], [CA]: "California" });
    setDocs(initialUsers().map((u) => ({ ...u, regionText: u.regionId === DC ? SPELLINGS[0] : "California" })));
    setOp(null);
    setReadId(3);
  };

  const readUser = users.find((u) => u.id === readId);
  const readDoc = docs.find((d) => d.id === readId);

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => rename(false)} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Rename region → {nextSpelling}
        </button>
        <button type="button" onClick={() => rename(true)} className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad">
          Rename, crash halfway
        </button>
        <label className="flex items-center gap-2">
          <button type="button" onClick={read} className="border border-line-soft px-3 py-1.5 hover:border-ink">
            Read profile
          </button>
          <select
            value={readId}
            onChange={(e) => setReadId(Number(e.target.value))}
            aria-label="Profile to read"
            className="border border-line-soft bg-surface px-2 py-1.5 font-mono text-[11px]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                #{u.id} {u.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={addUsers} disabled={users.length >= 12} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Add 3 users in DC
        </button>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        {/* Normalized */}
        <div className="bg-surface p-3" style={{ boxShadow: "inset 4px 0 0 var(--neon-1)" }}>
          <Header title="Normalized" tag="region_id, one copy of the name" writes={op?.normWrites} reads={op?.normReads} />
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mt-3 mb-1">regions</p>
          <table className="w-full font-mono text-[11px]">
            <tbody>
              {Object.entries(regions).map(([id, name]) => (
                <tr key={id} className={op?.hlRegion && id === DC ? "bg-neon-1/10" : ""}>
                  <td className="py-0.5 pr-3 text-ink-2 w-16">{id}</td>
                  <td className="py-0.5">{name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mt-3 mb-1">users</p>
          <table className="w-full font-mono text-[11px]">
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={op?.hlNormUsers.includes(u.id) ? "bg-neon-1/10" : ""}>
                  <td className="py-0.5 pr-3 text-ink-2 w-10">#{u.id}</td>
                  <td className="py-0.5 pr-3">{u.name}</td>
                  <td className="py-0.5 text-ink-2">{u.regionId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {op?.kind === "read" && readUser && (
            <p className="mt-3 font-mono text-[11px] border-t border-line-soft pt-2">
              JOIN regions ON region_id → <span className="font-semibold">{regions[readUser.regionId]}</span>
            </p>
          )}
        </div>

        {/* Denormalized */}
        <div className="bg-surface p-3" style={{ boxShadow: `inset 4px 0 0 ${inconsistent ? "var(--bad)" : "var(--neon-5)"}` }}>
          <Header
            title="Denormalized"
            tag="region text copied into each profile"
            writes={op?.denormWrites}
            reads={op?.denormReads}
            status={inconsistent ? `inconsistent · ${dcSpellings.size} spellings of ${DC}` : undefined}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mt-3 mb-1">profiles</p>
          <ul className="font-mono text-[11px] space-y-0.5">
            {docs.map((d) => {
              const stale = inconsistent && d.regionId === DC && d.regionText !== regions[DC];
              return (
                <li key={d.id} className={`py-0.5 ${op?.hlDocs.includes(d.id) ? "bg-neon-5/10" : ""} ${stale ? "text-bad" : ""}`}>
                  {`{ id: ${d.id}, name: "${d.name}", region: "${d.regionText}" }`}
                </li>
              );
            })}
          </ul>
          {op?.kind === "read" && readDoc && (
            <p className="mt-3 font-mono text-[11px] border-t border-line-soft pt-2">
              one lookup → <span className="font-semibold">{readDoc.regionText}</span>
            </p>
          )}
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {op?.kind === "crash"
          ? "The rename stopped after half the copies. Nothing in the denormalized store says which spelling is right: the copies are derived data, and keeping them in step needs an atomic transaction or a stream that finishes the job (ch. 8, 12). The normalized store never had the problem: one row, one write."
          : op?.kind === "read"
            ? "Reading a profile costs a join (two lookups) when normalized and a single lookup when the text is copied in. That is the whole case for denormalization: faster reads, paid for on every write."
            : `An ID means nothing to humans, so it never changes; "${regions[DC]}" is meaningful and one day will. Renaming it touches 1 row by ID and ${dcUsers.length} profiles by text, and the second number grows with every user you add.`}
      </p>
    </div>
  );
}

function Header({ title, tag, writes, reads, status }: { title: string; tag: string; writes?: number; reads?: number; status?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <div>
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{tag}</span>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
        {status ? (
          <span className="text-bad">{status}</span>
        ) : writes !== undefined || reads !== undefined ? (
          <span>
            last op · <span className="font-dot text-sm">{writes ?? 0}</span> writes · <span className="font-dot text-sm">{reads ?? 0}</span> reads
          </span>
        ) : (
          <span className="text-ink-3">no operation yet</span>
        )}
      </span>
    </div>
  );
}
