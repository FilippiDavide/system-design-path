"use client";

import { useState } from "react";

interface User {
  id: string;
  born: number;
}
interface Event {
  user: string;
  url: string;
  t: number;
}

const USERS: User[] = [
  { id: "u1", born: 1998 },
  { id: "u2", born: 1975 },
  { id: "u3", born: 2004 },
  { id: "u4", born: 1961 },
];

const BASE_EVENTS: Event[] = [
  { user: "u1", url: "/home", t: 1 },
  { user: "u2", url: "/home", t: 2 },
  { user: "u3", url: "/cart", t: 3 },
  { user: "u1", url: "/about", t: 4 },
  { user: "u4", url: "/home", t: 5 },
  { user: "u3", url: "/home", t: 6 },
  { user: "u2", url: "/cart", t: 7 },
  { user: "u3", url: "/about", t: 8 },
  { user: "u1", url: "/cart", t: 9 },
  { user: "u4", url: "/about", t: 10 },
];

/** Extra events for u3 when the "hot key" switch is on. */
const HOT_EVENTS: Event[] = Array.from({ length: 8 }, (_, i) => ({
  user: "u3",
  url: ["/home", "/cart", "/about"][i % 3],
  t: 11 + i,
}));

const R = 2;
const reducerOf = (user: string): number => Number(user.slice(1)) % R;
const YEAR = 2026;
const bracket = (born: number): "young" | "old" => (YEAR - born < 30 ? "young" : "old");

type Mode = "sortmerge" | "broadcast";

/**
 * Joining an event log with a users table. Sort-merge needs a shuffle
 * of both inputs by user_id and suffers when one user is hot; a
 * broadcast hash join copies the small table to every mapper instead,
 * which only works while it fits in memory.
 */
export function JoinLab() {
  const [mode, setMode] = useState<Mode>("sortmerge");
  const [hot, setHot] = useState(false);
  const [bigDim, setBigDim] = useState(false);

  const events = hot ? [...BASE_EVENTS, ...HOT_EVENTS] : BASE_EVENTS;
  // Two event shards, one mapper each.
  const shards: Event[][] = [events.filter((_, i) => i % 2 === 0), events.filter((_, i) => i % 2 === 1)];

  // Sort-merge: everything goes through the shuffle, keyed by user_id.
  const reducerInput = Array.from({ length: R }, (_, r) => {
    const users = USERS.filter((u) => reducerOf(u.id) === r);
    return users
      .map((u) => ({ user: u, events: events.filter((e) => e.user === u.id).sort((a, b) => a.t - b.t) }))
      .sort((a, b) => a.user.id.localeCompare(b.user.id));
  });
  const perReducer = reducerInput.map((rows) => rows.reduce((n, row) => n + 1 + row.events.length, 0));
  const shuffled = events.length + USERS.length;
  const busiest = Math.max(...perReducer);
  const skew = busiest / Math.max(1, Math.min(...perReducer));

  // Broadcast: the users table is copied to every mapper; events stay put.
  const broadcastOk = !bigDim;
  const perMapper = shards.map((s) => s.length);

  const joined = events.map((e) => ({ url: e.url, b: bracket(USERS.find((u) => u.id === e.user)!.born) }));
  const groups = ["/home", "/cart", "/about"].map((url) => ({
    url,
    young: joined.filter((j) => j.url === url && j.b === "young").length,
    old: joined.filter((j) => j.url === url && j.b === "old").length,
  }));

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line">
          {(
            [
              ["sortmerge", "sort-merge · reduce side"],
              ["broadcast", "broadcast hash · map side"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 ${mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {label}
            </button>
          ))}
        </span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={hot} onChange={(e) => setHot(e.target.checked)} className="accent-black" />
          u3 goes viral
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={bigDim} onChange={(e) => setBigDim(e.target.checked)} className="accent-black" />
          users table: {bigDim ? "400 M rows" : "4 rows"}
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        {/* map side */}
        <div className="bg-surface p-3 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">
            map side · {mode === "sortmerge" ? "3 mappers" : "2 mappers"}
          </p>
          {mode === "sortmerge" ? (
            <div className="grid grid-cols-3 gap-2">
              {shards.map((s, m) => (
                <div key={m} className="border border-line-soft p-2 min-w-0" style={{ boxShadow: "inset 3px 0 0 var(--neon-1)" }}>
                  <p className="font-semibold text-[12px]">events {m + 1}</p>
                  <p className="font-mono text-[10px] text-ink-2 mb-1">emit (user_id, url, t)</p>
                  <ul className="font-mono text-[11px] space-y-0.5">
                    {s.slice(0, 5).map((e) => (
                      <li key={e.t} className={e.user === "u3" && hot ? "text-neon-5" : ""}>
                        ({e.user}, {e.url})
                      </li>
                    ))}
                    {s.length > 5 && <li className="text-ink-3">… {s.length - 5} more</li>}
                  </ul>
                </div>
              ))}
              <div className="border border-line-soft p-2 min-w-0" style={{ boxShadow: "inset 3px 0 0 var(--neon-2)" }}>
                <p className="font-semibold text-[12px]">users</p>
                <p className="font-mono text-[10px] text-ink-2 mb-1">emit (user_id, born)</p>
                <ul className="font-mono text-[11px] space-y-0.5">
                  {USERS.map((u) => (
                    <li key={u.id}>
                      ({u.id}, {u.born})
                    </li>
                  ))}
                  {bigDim && <li className="text-ink-3">… 400 M more</li>}
                </ul>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {shards.map((s, m) => (
                <div key={m} className="border border-line-soft p-2 min-w-0" style={{ boxShadow: "inset 3px 0 0 var(--neon-1)" }}>
                  <p className="font-semibold text-[12px]">mapper {m + 1}</p>
                  <div className={`border border-dashed p-1 my-1 ${broadcastOk ? "border-neon-2" : "border-bad"}`}>
                    <p className="font-mono text-[10px] text-ink-2">hash table · users (copy)</p>
                    {broadcastOk ? (
                      <p className="font-mono text-[11px]">{USERS.map((u) => `${u.id}→${u.born}`).join(" ")}</p>
                    ) : (
                      <p className="font-mono text-[11px] text-bad">400 M rows do not fit in RAM</p>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-ink-2">lookup, emit (url, bracket)</p>
                  <ul className="font-mono text-[11px] space-y-0.5">
                    {s.slice(0, 4).map((e) => (
                      <li key={e.t} className={e.user === "u3" && hot ? "text-neon-5" : ""}>
                        {broadcastOk ? `(${e.url}, ${bracket(USERS.find((u) => u.id === e.user)!.born)})` : `(${e.user}, ${e.url}) ?`}
                      </li>
                    ))}
                    {s.length > 4 && <li className="text-ink-3">… {s.length - 4} more</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* reduce side / result */}
        <div className="bg-surface p-3 min-w-0">
          {mode === "sortmerge" ? (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">
                reduce side · shuffle by hash(user_id), {R} reducers
              </p>
              <div className="grid grid-cols-2 gap-2">
                {reducerInput.map((rows, r) => {
                  const n = perReducer[r];
                  const isBusy = hot && n === busiest;
                  return (
                    <div key={r} className={`border p-2 min-w-0 ${isBusy ? "border-warn" : "border-line-soft"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[12px]">r{r + 1}</p>
                        <p className={`font-mono text-[10px] ${isBusy ? "text-warn" : "text-ink-2"}`}>{n} records</p>
                      </div>
                      <Bar value={n} max={Math.max(...perReducer)} color={isBusy ? "var(--warn)" : "var(--neon-3)"} />
                      <ul className="font-mono text-[11px] space-y-0.5 mt-1">
                        {rows.map((row) => (
                          <li key={row.user.id}>
                            <span className="text-neon-2">({row.user.id}, {row.user.born})</span>
                            <span className="text-ink-2"> then </span>
                            {row.events.length} events
                            {row.events.length > 0 && (
                              <span className="text-ink-3"> t={row.events[0].t}…{row.events[row.events.length - 1].t}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 font-mono text-[10px] text-ink-2">
                secondary sort: user record first, then its events by time → 1 record in memory
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">no shuffle · events never move</p>
              <div className="grid grid-cols-2 gap-2">
                {perMapper.map((n, m) => (
                  <div key={m} className="border border-line-soft p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[12px]">mapper {m + 1}</p>
                      <p className="font-mono text-[10px] text-ink-2">{n} events</p>
                    </div>
                    <Bar value={n} max={Math.max(...perMapper)} color="var(--neon-3)" />
                  </div>
                ))}
              </div>
              <p className="mt-2 font-mono text-[10px] text-ink-2">
                {broadcastOk
                  ? "a hot user is just more rows in the same mapper: no skew"
                  : "the optimizer falls back to a sort-merge join"}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-line-soft border-t border-line-soft">
        <Stat label="records shuffled" value={mode === "sortmerge" ? shuffled : 0} />
        <Stat
          label="busiest task"
          value={mode === "sortmerge" ? busiest : broadcastOk ? Math.max(...perMapper) : NaN}
          bad={mode === "sortmerge" && hot}
          suffix={mode === "sortmerge" && hot ? ` · ${skew.toFixed(1)}× the other` : ""}
        />
        <Stat
          label="memory per task"
          value={mode === "sortmerge" ? 1 : broadcastOk ? USERS.length : NaN}
          suffix={mode === "sortmerge" ? " record" : broadcastOk ? " users" : ""}
          bad={mode === "broadcast" && !broadcastOk}
        />
      </div>

      <div className="border-t border-line-soft p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">next job · group by url, count per age bracket</p>
        <ul className="font-mono text-[11px] flex flex-wrap gap-x-5 gap-y-1">
          {groups.map((g) => (
            <li key={g.url}>
              {g.url}: young {g.young} · old {g.old}
            </li>
          ))}
        </ul>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        The sort-merge join sends both inputs through the shuffle so that every reducer sees one user&apos;s record
        followed by that user&apos;s events, in time order: one record in memory, no network requests. The price is the
        shuffle itself, and a hot key (switch u3 on) lands on a single reducer, so the job runs at the pace of its
        slowest task. The broadcast hash join skips the shuffle entirely by copying the small table to every mapper,
        which is only possible while that table fits in memory. Born in {YEAR - 30} or later counts as young here.
      </p>
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 border border-line-soft mt-1">
      <div className="h-full" style={{ width: `${(100 * value) / Math.max(1, max)}%`, background: color }} />
    </div>
  );
}

function Stat({ label, value, suffix = "", bad = false }: { label: string; value: number; suffix?: string; bad?: boolean }) {
  return (
    <div className="bg-surface p-3 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className={`font-dot text-2xl font-bold mt-0.5 ${bad ? "text-bad" : ""}`}>
        {Number.isNaN(value) ? "—" : value}
        {suffix && <span className="text-sm text-ink-3">{suffix}</span>}
      </p>
    </div>
  );
}
