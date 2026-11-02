"use client";

import { useEffect, useRef, useState } from "react";

type Failure = "none" | "cell" | "dbconn";
type Phase = "idle" | "toApp" | "toDb" | "commit" | "backApp" | "dropDb" | "backBrowser" | "dropCell";

interface Attempt {
  n: number;
  id: string;
  failure: Failure;
  /** What the database did with the INSERT into `requests`. */
  db: "committed" | "rejected";
  /** What the user saw on screen. */
  user: "ok" | "error";
}

const STEP = 550;
const AMOUNT = 11;

const FAILURES: { key: Failure; label: string }[] = [
  { key: "none", label: "no failure" },
  { key: "cell", label: "cellular drops the response" },
  { key: "dbconn", label: "DB connection drops after COMMIT" },
];

/**
 * The retried $11 transfer. The request crosses three hops (browser,
 * app server, database); a failure on any hop after the commit leaves
 * the user with an error page and a committed transfer. Resubmitting
 * is a brand-new request to every layer, unless a client-generated
 * request ID travels end to end and hits a unique constraint.
 */
export function RequestIdLab() {
  const [useId, setUseId] = useState(false);
  const [failure, setFailure] = useState<Failure>("cell");
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [counter, setCounter] = useState(1);
  const [lastId, setLastId] = useState<string | null>(null);
  /** The attempt currently on the wire: did the DB see its id before? */
  const [inFlight, setInFlight] = useState<{ id: string; dup: boolean } | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const busy = phase !== "idle";
  const committed = attempts.filter((a) => a.db === "committed").length;
  const confirmed = attempts.filter((a) => a.user === "ok").length;
  const last = attempts[attempts.length - 1];

  const run = (id: string, f: Failure) => {
    if (busy) return;
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    // Unique constraint on requests(id): the database decides, not the app.
    const dup = useId && seen.current.has(id);
    if (!dup) seen.current.add(id);
    const db: Attempt["db"] = dup ? "rejected" : "committed";
    const user: Attempt["user"] = f === "none" ? "ok" : "error";
    const finish = () => {
      setPhase("idle");
      setInFlight(null);
      setAttempts((a) => [...a, { n: a.length + 1, id, failure: f, db, user }]);
    };
    setInFlight({ id, dup });
    setPhase("toApp");
    later(STEP, () => setPhase("toDb"));
    later(STEP * 2, () => setPhase("commit"));
    if (f === "dbconn") {
      later(STEP * 3, () => setPhase("dropDb"));
      later(STEP * 4, () => setPhase("backBrowser"));
      later(STEP * 5, finish);
      return;
    }
    later(STEP * 3, () => setPhase("backApp"));
    later(STEP * 4, () => setPhase(f === "cell" ? "dropCell" : "backBrowser"));
    later(STEP * 5, finish);
  };

  const submit = () => {
    const id = `req-${counter}`;
    setCounter((c) => c + 1);
    setLastId(id);
    run(id, failure);
  };
  const resubmit = () => {
    if (!lastId) return;
    // Without an ID the browser has nothing to repeat: it is a new request.
    const id = useId ? lastId : `req-${counter}`;
    if (!useId) setCounter((c) => c + 1);
    run(id, "none");
  };
  const reset = () => {
    timers.current.forEach(clearTimeout);
    seen.current.clear();
    setAttempts([]);
    setPhase("idle");
    setInFlight(null);
    setLastId(null);
    setCounter(1);
  };

  // Dot position for each phase: (x, y) on the 640-wide wire.
  const pos: Record<Phase, [number, number]> = {
    idle: [70, 50],
    toApp: [320, 50],
    toDb: [570, 50],
    commit: [570, 60],
    backApp: [320, 70],
    dropDb: [445, 70],
    backBrowser: [70, 70],
    dropCell: [195, 70],
  };
  const [dx, dy] = pos[phase];
  const dotColor =
    phase === "dropDb" || phase === "dropCell" ? "var(--bad)" : phase === "commit" ? "var(--neon-2)" : "var(--neon-1)";

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={submit} disabled={busy} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Transfer ${AMOUNT}
        </button>
        <button
          type="button"
          onClick={resubmit}
          disabled={busy || !last || last.user === "ok"}
          className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40"
        >
          Resubmit form
        </button>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={useId} onChange={(e) => setUseId(e.target.checked)} className="accent-black" />
          request ID in hidden field
        </label>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-line-soft font-mono text-[10px] uppercase tracking-[0.12em]">
        <span className="text-ink-2">failure</span>
        {FAILURES.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={failure === f.key}
            onClick={() => setFailure(f.key)}
            className={`border px-2 py-1 ${failure === f.key ? "border-ink bg-ink text-surface" : "border-line-soft hover:border-ink"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="p-4 bg-grid overflow-x-auto">
        <svg viewBox="0 0 640 130" width="100%" style={{ minWidth: 520, maxWidth: 680, display: "block", margin: "0 auto" }}>
          {[
            { x: 10, title: "Browser", sub: useId ? `hidden id: ${lastId ?? "…"}` : "no id · form only" },
            { x: 260, title: "App server", sub: "new POST = new tx" },
            { x: 510, title: "Database", sub: useId ? "requests(id) UNIQUE" : "runs every tx" },
          ].map((b) => (
            <g key={b.title}>
              <rect x={b.x} y={30} width={120} height={60} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
              <text x={b.x + 60} y={54} textAnchor="middle" fontFamily="var(--font-inter)" fontSize={13} fontWeight={600}>
                {b.title}
              </text>
              <text x={b.x + 60} y={74} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={9.5} fill="var(--ink-2)">
                {b.sub}
              </text>
            </g>
          ))}
          <line x1={130} y1={50} x2={260} y2={50} stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={380} y1={50} x2={510} y2={50} stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={260} y1={70} x2={130} y2={70} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={510} y1={70} x2={380} y2={70} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="4 4" />
          <text x={195} y={20} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            cellular · HTTP POST
          </text>
          <text x={445} y={20} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            TCP connection · SQL
          </text>

          {busy && (
            <circle
              r={6}
              fill={dotColor}
              style={{ transition: `transform ${STEP}ms linear`, transform: `translate(${dx}px, ${dy}px)` }}
            />
          )}
          {phase === "commit" && (
            <text x={570} y={108} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--neon-2)">
              {inFlight?.dup ? "INSERT requests: duplicate id → abort" : "INSERT requests, UPDATE balance, COMMIT"}
            </text>
          )}
          {phase === "dropDb" && (
            <text x={445} y={108} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--bad)">
              connection reset · app cannot tell if it committed
            </text>
          )}
          {phase === "dropCell" && (
            <text x={195} y={108} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--bad)">
              response lost · user sees an error page
            </text>
          )}
          {phase === "idle" && last && (
            <text x={320} y={112} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={11} fill="var(--ink)">
              attempt {last.n} ({last.id}): user saw {last.user.toUpperCase()} · database {last.db === "committed" ? "committed the transfer" : "rejected the duplicate"}
            </text>
          )}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">user believes transferred</p>
          <p className="font-dot text-3xl font-bold mt-1">${confirmed * AMOUNT}</p>
        </div>
        <div className="bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">database actually moved</p>
          <p className={`font-dot text-3xl font-bold mt-1 ${committed > 1 ? "text-bad" : ""}`}>
            ${committed * AMOUNT}
            {committed > 1 && <span className="text-base"> · {committed}× the same transfer</span>}
          </p>
        </div>
      </div>

      {attempts.length > 0 && (
        <ol className="border-t border-line-soft divide-y divide-line-soft font-mono text-[11px]">
          {attempts.slice(-5).map((a) => (
            <li key={a.n} className="flex items-center gap-3 px-4 py-1.5">
              <span className="font-dot text-sm w-5">{a.n}</span>
              <span className="w-14 text-ink-2">{a.id}</span>
              <span className={`w-12 ${a.user === "ok" ? "text-neon-3" : "text-bad"}`}>{a.user.toUpperCase()}</span>
              <span className="text-ink-2">
                {a.db === "committed" ? "committed" : "duplicate id · aborted, nothing moved"}
                {a.failure === "cell" && " · response lost on the way back"}
                {a.failure === "dbconn" && " · DB connection dropped after COMMIT"}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        TCP deduplicates retransmitted packets, but only inside one connection; a transaction is atomic, but a resubmitted
        form is a new transaction. No layer in the middle can know that the second POST is the same transfer. Only the
        endpoints can: a UUID generated in the browser, carried through every hop and enforced by a unique constraint on
        the requests table. That is the end-to-end argument.
      </p>
    </div>
  );
}
