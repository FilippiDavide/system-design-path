"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The write-skew race (two doctors leaving, or two people booking the
 * same room) replayed under four strategies. The lab shows the SQL each
 * transaction runs, where a lock makes one wait, where FOR UPDATE has
 * nothing to lock (phantom), and where SSI aborts at commit.
 */

type Scenario = "doctors" | "meeting room";
type Strategy = "snapshot isolation" | "select for update" | "materialize conflict" | "serializable (SSI)";

const SCENARIOS: Scenario[] = ["doctors", "meeting room"];
const STRATEGIES: Strategy[] = ["snapshot isolation", "select for update", "materialize conflict", "serializable (SSI)"];

interface Ev {
  who: "A" | "B";
  sql: string;
  result: string;
  kind: "ok" | "wait" | "abort" | "skip" | "commit";
  /** Committed state of the database after this event. */
  state: string;
}

interface Script {
  events: Ev[];
  verdict: { bad: boolean; text: string };
}

const STEP_MS = 650;

function script(sc: Scenario, st: Strategy): Script {
  const doc = sc === "doctors";
  const names = ["Aaliyah", "Bryce"];
  const full = doc ? "on call: Aaliyah, Bryce" : "room 123 at 12:00: free";
  const afterA = doc ? "on call: Bryce" : "room 123 at 12:00: Aaliyah";
  const afterBoth = doc ? "on call: nobody" : "room 123 at 12:00: Aaliyah AND Bryce";
  const check = doc ? "SELECT count(*) FROM doctors\nWHERE on_call = true" : "SELECT count(*) FROM bookings\nWHERE room = 123 AND slot = '12:00'";
  const premise = doc ? "2 · safe to leave" : "0 · room is free";
  const write = (n: string) =>
    doc ? `UPDATE doctors SET on_call = false\nWHERE name = '${n}'` : `INSERT INTO bookings\nVALUES (123, '12:00', '${n}')`;
  const lockRow = doc ? "SELECT * FROM shift_lock\nWHERE shift = 'tonight' FOR UPDATE" : "SELECT * FROM slots\nWHERE room = 123 AND slot = '12:00' FOR UPDATE";
  const second = doc ? "1 · must stay" : "1 · already taken";
  const stay = doc ? "stays on call" : "does not book";

  const commitA: Ev = { who: "A", sql: "COMMIT", result: "ok", kind: "commit", state: afterA };

  if (st === "snapshot isolation") {
    return {
      events: [
        { who: "A", sql: check, result: premise, kind: "ok", state: full },
        { who: "B", sql: check, result: premise, kind: "ok", state: full },
        { who: "A", sql: write(names[0]), result: "1 row · own row locked", kind: "ok", state: full },
        { who: "B", sql: write(names[1]), result: "1 row · different row, no conflict", kind: "ok", state: full },
        commitA,
        { who: "B", sql: "COMMIT", result: "ok", kind: "commit", state: afterBoth },
      ],
      verdict: {
        bad: true,
        text: doc
          ? "Write skew: both premises were true when read, both writes touched different rows, both commits succeeded. Nobody is on call."
          : "Write skew with a phantom: each INSERT changed the result of the other's query, and nothing noticed. The room is double-booked.",
      },
    };
  }

  if (st === "select for update") {
    if (doc) {
      return {
        events: [
          { who: "A", sql: `${check}\nFOR UPDATE`, result: "2 · both rows locked by A", kind: "ok", state: full },
          { who: "B", sql: `${check}\nFOR UPDATE`, result: "waiting: rows locked by A", kind: "wait", state: full },
          { who: "A", sql: write(names[0]), result: "1 row", kind: "ok", state: full },
          commitA,
          { who: "B", sql: "(resumes)", result: second, kind: "skip", state: afterA },
          { who: "B", sql: "COMMIT", result: `nothing written · Bryce ${stay}`, kind: "commit", state: afterA },
        ],
        verdict: { bad: false, text: "The rows the decision depends on were among the rows read, so FOR UPDATE could lock them. B's check waited for A's commit and saw the new truth." },
      };
    }
    return {
      events: [
        { who: "A", sql: `${check}\nFOR UPDATE`, result: "0 · no rows: nothing to lock", kind: "ok", state: full },
        { who: "B", sql: `${check}\nFOR UPDATE`, result: "0 · no rows: nothing to lock", kind: "ok", state: full },
        { who: "A", sql: write(names[0]), result: "1 row inserted", kind: "ok", state: full },
        { who: "B", sql: write(names[1]), result: "1 row inserted", kind: "ok", state: full },
        commitA,
        { who: "B", sql: "COMMIT", result: "ok", kind: "commit", state: afterBoth },
      ],
      verdict: { bad: true, text: "Phantom: the query checked for the absence of rows, and FOR UPDATE cannot lock rows that do not exist. Each INSERT changed the other's result. Double booking." },
    };
  }

  if (st === "materialize conflict") {
    return {
      events: [
        { who: "A", sql: lockRow, result: "1 row · lock row held by A", kind: "ok", state: full },
        { who: "B", sql: lockRow, result: "waiting: lock row held by A", kind: "wait", state: full },
        { who: "A", sql: check, result: premise, kind: "ok", state: full },
        { who: "A", sql: write(names[0]), result: "1 row", kind: "ok", state: full },
        commitA,
        { who: "B", sql: "(resumes)", result: "lock row acquired", kind: "ok", state: afterA },
        { who: "B", sql: check, result: second, kind: "skip", state: afterA },
        { who: "B", sql: "COMMIT", result: `nothing written · Bryce ${stay}`, kind: "commit", state: afterA },
      ],
      verdict: {
        bad: false,
        text: doc
          ? "A pre-created lock row turned the conflict into something a row lock can grab. Here it is overkill: the doctors' own rows could be locked. It is a last resort for the phantom cases."
          : "A table of slots created in advance (one row per room and 15-minute slot) gives FOR UPDATE a row to lock where the bookings table had none. It works, and it leaks concurrency control into the data model.",
      },
    };
  }

  return {
    events: [
      { who: "A", sql: check, result: `${premise} · read recorded`, kind: "ok", state: full },
      { who: "B", sql: check, result: `${premise} · read recorded`, kind: "ok", state: full },
      { who: "A", sql: write(names[0]), result: "1 row · tripwire: B read this", kind: "ok", state: full },
      { who: "B", sql: write(names[1]), result: "1 row · tripwire: A read this", kind: "ok", state: full },
      commitA,
      { who: "B", sql: "COMMIT", result: "ERROR: could not serialize access", kind: "abort", state: afterA },
      { who: "B", sql: `retry: ${check}`, result: second, kind: "skip", state: afterA },
      { who: "B", sql: "COMMIT", result: `nothing written · Bryce ${stay}`, kind: "commit", state: afterA },
    ],
    verdict: {
      bad: false,
      text: "Nobody waited. Each write tripped the index entry the other had read; A committed first, so B's premise was stale at commit and B was aborted. The application retried and saw the truth.",
    },
  };
}

export function DoctorsLab() {
  const [sc, setSc] = useState<Scenario>("doctors");
  const [st, setSt] = useState<Strategy>("snapshot isolation");
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | null>(null);
  const s = script(sc, st);
  const total = s.events.length;
  // The clock runs only while there is something left to reveal.
  const playing = running && shown < total;

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => setShown((n) => Math.min(total, n + 1)), STEP_MS);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [playing, total]);

  const reset = (nsc = sc, nst = st) => {
    setRunning(false);
    setShown(0);
    setSc(nsc);
    setSt(nst);
  };
  const run = () => {
    setShown(0);
    setRunning(true);
  };

  const visible = s.events.slice(0, shown);
  const state = visible.length ? visible[visible.length - 1].state : s.events[0].state;
  const finished = shown >= total;
  const tabBtn = (on: boolean) => `px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${on ? "bg-ink text-surface" : "hover:bg-surface-2"}`;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line w-fit">
          {SCENARIOS.map((x) => (
            <button key={x} type="button" aria-pressed={sc === x} onClick={() => reset(x, st)} className={tabBtn(sc === x)}>
              {x}
            </button>
          ))}
        </span>
        <button type="button" onClick={run} disabled={playing} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Both click at once
        </button>
        <button type="button" onClick={() => setShown(total)} disabled={finished} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Skip to end
        </button>
        <button type="button" onClick={() => reset()} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-ink-2">strategy</span>
        <span className="flex flex-wrap gap-px border border-line w-fit">
          {STRATEGIES.map((x) => (
            <button key={x} type="button" aria-pressed={st === x} onClick={() => reset(sc, x)} className={tabBtn(st === x)}>
              {x}
            </button>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-line-soft">
        <Head name="Tx Aaliyah" accent="var(--neon-1)" />
        <Head name="Tx Bryce" accent="var(--neon-2)" />
        {visible.map((e, i) => (
          <EventRow key={i} e={e} />
        ))}
        {shown === 0 && (
          <div className="col-span-2 bg-surface p-3 text-[12px] text-ink-2">
            {sc === "doctors"
              ? "Two doctors on call, both ill, both press 'go home'. Rule: at least one must stay."
              : "Room 123 is free at 12:00. Two people book it at the same moment. Rule: one booking per slot."}{" "}
            Press &lsquo;Both click at once&rsquo;.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-line-soft font-mono text-[11px]">
        <span className="text-ink-2 uppercase tracking-[0.12em]">committed state</span>
        <span className={finished && s.verdict.bad ? "text-bad" : "text-ink"}>{state}</span>
      </div>
      <div className={`px-3 py-2 border-t border-line-soft text-[12px] leading-relaxed min-h-[2.5rem] ${finished ? (s.verdict.bad ? "text-bad" : "text-ok") : "text-ink-2"}`}>
        {finished ? (
          <>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] mr-2">{s.verdict.bad ? "anomaly" : "prevented"}</span>
            {s.verdict.text}
          </>
        ) : (
          `${shown}/${total} steps`
        )}
      </div>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        The pattern is always SELECT a precondition, decide in the application, write something that changes the
        precondition. When the rows read are the rows that matter, FOR UPDATE works. When the check is for the
        absence of rows there is nothing to lock (a phantom): materialize the conflict, or let serializable
        isolation detect the outdated premise.
      </p>
    </div>
  );
}

function Head({ name, accent }: { name: string; accent: string }) {
  return (
    <div className="bg-surface px-3 py-2 font-semibold text-sm" style={{ boxShadow: `inset 4px 0 0 ${accent}` }}>
      {name}
    </div>
  );
}

function EventRow({ e }: { e: Ev }) {
  const color =
    e.kind === "abort" ? "text-bad" : e.kind === "wait" ? "text-warn" : e.kind === "commit" ? "text-ok" : e.kind === "skip" ? "text-neon-4" : "text-ink-2";
  const cell = (
    <div className="bg-surface p-2">
      <pre className="font-mono text-[11px] leading-snug whitespace-pre-wrap">{e.sql}</pre>
      <p className={`font-mono text-[10px] mt-1 ${color}`}>→ {e.result}</p>
    </div>
  );
  const empty = <div className="bg-surface" />;
  return (
    <>
      {e.who === "A" ? cell : empty}
      {e.who === "B" ? cell : empty}
    </>
  );
}
