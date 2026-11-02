"use client";

import { useState } from "react";

type Join = "stream-stream" | "stream-table" | "table-table";

interface Ev {
  t: string;
  /** Which input the event comes from. */
  src: string;
  text: string;
  note: string;
}

const WINDOW = 60; // minutes for the stream-stream join

const SCRIPTS: Record<Join, Ev[]> = {
  "stream-stream": [
    { t: "0", src: "search", text: "s1 · shoes", note: "A search arrives. Its session id goes into the search index; the join waits up to 60 min for a click." },
    { t: "2", src: "click", text: "s1 · shoe-42", note: "A click with the same session id: match. The pair is emitted at once." },
    { t: "5", src: "click", text: "s2 · boot-7", note: "A click before its search: the network delivered them out of order. It is kept in the click index." },
    { t: "7", src: "search", text: "s2 · boots", note: "The search for s2 arrives and finds the buffered click: match, emitted." },
    { t: "10", src: "search", text: "s3 · socks", note: "Another search, waiting for its click." },
    { t: "75", src: "search", text: "s4 · hat", note: "Time has moved past 10 + 60 min: s3 expired without a click and is emitted as 'no click'. Only an expiry can say that." },
    { t: "80", src: "click", text: "s3 · sock-1", note: "A click for s3 after the window closed. The join already reported no click; the late click is logged as a straggler." },
  ],
  "stream-table": [
    { t: "1", src: "changelog", text: "u1 · city=Rome", note: "A change from the users table arrives via CDC: the local copy now knows u1. The changelog window is infinite: the latest value is kept forever." },
    { t: "2", src: "activity", text: "u1 · view /shoes", note: "An activity event looks up u1 in the local copy, not in the remote database: enriched with Rome." },
    { t: "3", src: "activity", text: "u2 · buy boots", note: "u2 is not in the copy yet (its changelog entry has not arrived): enriched with 'unknown'. The copy lags like any replica." },
    { t: "4", src: "changelog", text: "u2 · city=Oslo", note: "Now the copy learns u2. Later events for u2 will be enriched; the earlier one was not." },
    { t: "5", src: "changelog", text: "u1 · city=Milan", note: "u1 moved. The latest version replaces the old one in the copy." },
    { t: "6", src: "activity", text: "u1 · view /hats", note: "Enriched with Milan, the current version. Reprocessing history would join it with whatever the copy held then: the join is time-dependent." },
    { t: "7", src: "activity", text: "u2 · buy socks", note: "Enriched with Oslo from the local copy. The remote database was never queried." },
  ],
  "table-table": [
    { t: "1", src: "follows", text: "bob follows ada", note: "A row in the follows table. Nothing to show yet: ada has no posts." },
    { t: "2", src: "posts", text: "ada · p1", note: "A new post is joined with ada's current followers: p1 goes into bob's timeline." },
    { t: "3", src: "follows", text: "cy follows ada", note: "A new follow is joined with ada's current posts: p1 is copied into cy's timeline." },
    { t: "4", src: "posts", text: "ada · p2", note: "p2 fans out to both followers. Every change of one table is joined with the current state of the other: (u·v)′ = u′v + uv′." },
    { t: "5", src: "follows", text: "bob unfollows ada", note: "The inverse: ada's posts are removed from bob's timeline." },
    { t: "6", src: "posts", text: "dee · p3", note: "dee has no followers: no timeline changes." },
    { t: "7", src: "follows", text: "bob follows dee", note: "bob's timeline receives dee's existing post p3. The timelines are a materialized view of the SQL join." },
  ],
};

const INTRO: Record<Join, string> = {
  "stream-stream": "Searches and clicks share a session id. Push the events in and watch the join wait, match, or give up after 60 min.",
  "stream-table": "User activity is enriched with a profile. The profile table is a local copy kept up to date by its changelog.",
  "table-table": "Posts and follows are two changelogs; the timelines are the materialized view of their join.",
};

/* ---------- derived state, computed from the prefix of the script ---------- */

interface SSState {
  searches: { id: string; q: string; t: number }[];
  clicks: { id: string; item: string; t: number }[];
  out: string[];
}

function ss(events: Ev[]): SSState {
  const s: SSState = { searches: [], clicks: [], out: [] };
  for (const e of events) {
    const t = Number(e.t);
    const [id, payload] = e.text.split(" · ");
    // Expire searches older than the window before handling the new event.
    s.searches = s.searches.filter((q) => {
      if (t - q.t > WINDOW) {
        s.out.push(`${q.id}: "${q.q}" → no click (expired)`);
        return false;
      }
      return true;
    });
    if (e.src === "search") {
      const c = s.clicks.find((k) => k.id === id);
      if (c) {
        s.out.push(`${id}: "${payload}" → ${c.item}`);
        s.clicks = s.clicks.filter((k) => k !== c);
      } else s.searches.push({ id, q: payload, t });
    } else {
      const q = s.searches.find((k) => k.id === id);
      if (q) {
        s.out.push(`${id}: "${q.q}" → ${payload}`);
        s.searches = s.searches.filter((k) => k !== q);
      } else if (events.some((p) => p.src === "search" && p.text.startsWith(id))) {
        s.out.push(`${id}: late click ${payload} · straggler`);
      } else s.clicks.push({ id, item: payload, t });
    }
  }
  return s;
}

interface STState {
  table: Record<string, string>;
  out: string[];
}

function st(events: Ev[]): STState {
  const s: STState = { table: {}, out: [] };
  for (const e of events) {
    const [id, payload] = e.text.split(" · ");
    if (e.src === "changelog") s.table[id] = payload.replace("city=", "");
    else s.out.push(`${id} ${payload} · city=${s.table[id] ?? "unknown"}`);
  }
  return s;
}

interface TTState {
  follows: [string, string][];
  posts: [string, string][];
  timelines: Record<string, string[]>;
}

function tt(events: Ev[]): TTState {
  const s: TTState = { follows: [], posts: [], timelines: {} };
  const add = (u: string, p: string) => (s.timelines[u] = [...(s.timelines[u] ?? []), p]);
  for (const e of events) {
    if (e.src === "posts") {
      const [author, p] = e.text.split(" · ");
      s.posts.push([author, p]);
      s.follows.filter(([, who]) => who === author).forEach(([u]) => add(u, `${p} (${author})`));
    } else {
      const m = /^(\w+) (follows|unfollows) (\w+)$/.exec(e.text);
      if (!m) continue;
      const [, u, verb, who] = m;
      if (verb === "follows") {
        s.follows.push([u, who]);
        s.posts.filter(([a]) => a === who).forEach(([a, p]) => add(u, `${p} (${a})`));
      } else {
        s.follows = s.follows.filter(([a, b]) => !(a === u && b === who));
        s.timelines[u] = (s.timelines[u] ?? []).filter((p) => !p.endsWith(`(${who})`));
      }
    }
  }
  return s;
}

/**
 * The three stream joins, one scripted event at a time. In every case
 * the join keeps state derived from one input and queries it while
 * processing the other; what differs is how long that state lives.
 */
export function StreamJoinLab() {
  const [join, setJoin] = useState<Join>("stream-stream");
  const [step, setStep] = useState(0);
  const script = SCRIPTS[join];
  const done = script.slice(0, step);
  const current = step > 0 ? script[step - 1] : null;

  const pick = (j: Join) => {
    setJoin(j);
    setStep(0);
  };

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line w-fit">
          {(["stream-stream", "stream-table", "table-table"] as const).map((j) => (
            <button key={j} type="button" aria-pressed={join === j} onClick={() => pick(j)} className={`px-3 py-1.5 ${join === j ? "bg-ink text-surface" : "hover:bg-surface-2"}`}>
              {j}
            </button>
          ))}
        </span>
        <button type="button" onClick={() => setStep((s) => Math.min(script.length, s + 1))} disabled={step >= script.length} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Push next event
        </button>
        <button type="button" onClick={() => setStep(0)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink normal-case tracking-normal">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_1.2fr] gap-px bg-line-soft">
        <div className="bg-surface p-3 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">
            input · {join === "stream-stream" ? "two streams" : join === "stream-table" ? "stream + changelog" : "two changelogs"} · t in min
          </p>
          <ol className="font-mono text-[11px] space-y-1">
            {script.map((e, i) => {
              const isCur = i === step - 1;
              const future = i >= step;
              return (
                <li key={i} className={`flex gap-2 items-baseline ${future ? "text-ink-3" : ""} ${isCur ? "bg-surface-2 -mx-1 px-1" : ""}`}>
                  <span className="w-7 text-right text-ink-2">{e.t}</span>
                  <span className={`w-20 shrink-0 ${srcColor(e.src)}`}>{e.src}</span>
                  <span className="break-words">{e.text}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="bg-surface p-3 min-w-0">
          {join === "stream-stream" && <StreamStream s={ss(done)} />}
          {join === "stream-table" && <StreamTable s={st(done)} />}
          {join === "table-table" && <TableTable s={tt(done)} />}
        </div>
      </div>

      <p className="px-3 py-2 text-[12px] border-t border-line-soft">{current ? current.note : INTRO[join]}</p>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {join === "stream-stream" &&
          "A stream-stream join keeps an index per session on both sides for a finite window. Matches are emitted when the second event arrives, in either order; 'no click' can only be emitted when the window expires, and a click after that is a straggler."}
        {join === "stream-table" &&
          "A stream-table join never queries the remote database per event: it holds a local copy of the table, fed by CDC, with an infinite window where the latest version wins. Because the copy changes while the job runs, rerunning history can join an event with a different profile version."}
        {join === "table-table" &&
          "A table-table join maintains a materialized view of a join between two changelogs. Each change on one side is joined with the current state of the other side, in both directions, including the inverse operations (unfollow, delete)."}
      </p>
    </div>
  );
}

function srcColor(src: string) {
  if (src === "search" || src === "changelog" || src === "follows") return "text-neon-1";
  return "text-neon-2";
}

function Head({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">{children}</p>;
}

function Empty() {
  return <p className="font-mono text-[11px] text-ink-3">—</p>;
}

function StreamStream({ s }: { s: SSState }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Head>searches waiting · expire at t+60</Head>
          {s.searches.length === 0 ? <Empty /> : s.searches.map((q) => <p key={q.id} className="font-mono text-[11px]">{q.id} &quot;{q.q}&quot; <span className="text-ink-3">until {q.t + WINDOW}</span></p>)}
        </div>
        <div>
          <Head>clicks waiting</Head>
          {s.clicks.length === 0 ? <Empty /> : s.clicks.map((c) => <p key={c.id} className="font-mono text-[11px]">{c.id} {c.item}</p>)}
        </div>
      </div>
      <div>
        <Head>output · click-through pairs</Head>
        {s.out.length === 0 ? <Empty /> : s.out.map((o, i) => <p key={i} className={`font-mono text-[11px] ${o.includes("no click") || o.includes("straggler") ? "text-warn" : ""}`}>{o}</p>)}
      </div>
    </div>
  );
}

function StreamTable({ s }: { s: STState }) {
  const keys = Object.keys(s.table).sort();
  return (
    <div className="space-y-3">
      <div>
        <Head>local copy of users · from CDC</Head>
        {keys.length === 0 ? <Empty /> : keys.map((k) => <p key={k} className="font-mono text-[11px]">{k} → city={s.table[k]}</p>)}
      </div>
      <div>
        <Head>output · enriched events</Head>
        {s.out.length === 0 ? <Empty /> : s.out.map((o, i) => <p key={i} className={`font-mono text-[11px] ${o.endsWith("unknown") ? "text-warn" : ""}`}>{o}</p>)}
      </div>
    </div>
  );
}

function TableTable({ s }: { s: TTState }) {
  const users = Object.keys(s.timelines).sort();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Head>follows</Head>
          {s.follows.length === 0 ? <Empty /> : s.follows.map(([a, b]) => <p key={a + b} className="font-mono text-[11px]">{a} → {b}</p>)}
        </div>
        <div>
          <Head>posts</Head>
          {s.posts.length === 0 ? <Empty /> : s.posts.map(([a, p]) => <p key={p} className="font-mono text-[11px]">{a} · {p}</p>)}
        </div>
      </div>
      <div>
        <Head>timelines · materialized view</Head>
        {users.length === 0 ? <Empty /> : users.map((u) => (
          <p key={u} className="font-mono text-[11px]">
            {u}: {s.timelines[u].length === 0 ? <span className="text-ink-3">empty</span> : s.timelines[u].join(", ")}
          </p>
        ))}
      </div>
    </div>
  );
}
