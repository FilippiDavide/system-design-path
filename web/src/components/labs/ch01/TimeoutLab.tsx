"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "out" | "server" | "back";
type Outcome = "ok" | "lost-request" | "lost-response" | "slow";

interface Attempt {
  n: number;
  key: string;
  outcome: Outcome;
  executed: boolean;
}

const STEP = 650;

/**
 * Lossy-network simulator for the "charge the customer $10" request.
 * Each attempt randomly fails in one of the three ways the chapter
 * describes; the client only ever sees OK or TIMEOUT, while the server
 * side keeps the truth. Idempotency keys let a retry be safe.
 */
export function TimeoutLab() {
  const [loss, setLoss] = useState(40);
  const [idem, setIdem] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [keyCounter, setKeyCounter] = useState(1);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const charges = attempts.filter((a) => a.executed).length;
  const confirmed = attempts.filter((a) => a.outcome === "ok").length;
  const busy = phase !== "idle";

  const send = (key: string) => {
    if (busy) return;
    const p = loss / 100;
    const r = Math.random();
    const out: Outcome = r < p / 2 ? "lost-request" : r < p ? "lost-response" : r < p + 0.1 ? "slow" : "ok";
    setOutcome(out);
    setPhase("out");
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

    if (out === "lost-request") {
      later(STEP, () => {
        setPhase("idle");
        setAttempts((a) => [...a, { n: a.length + 1, key, outcome: out, executed: false }]);
      });
      return;
    }
    later(STEP, () => setPhase("server"));
    // The server executes unless it has already seen this idempotency key.
    const dup = idem && seen.current.has(key);
    if (!dup) seen.current.add(key);
    const executed = !dup;
    later(STEP * 2, () => {
      if (out === "lost-response") {
        setPhase("idle");
        setAttempts((a) => [...a, { n: a.length + 1, key, outcome: out, executed }]);
      } else {
        setPhase("back");
        later(STEP, () => {
          setPhase("idle");
          setAttempts((a) => [...a, { n: a.length + 1, key, outcome: out, executed }]);
        });
      }
    });
  };

  const sendNew = () => {
    const key = `k${keyCounter}`;
    setKeyCounter((k) => k + 1);
    setLastKey(key);
    send(key);
  };
  const retry = () => {
    if (!lastKey) return;
    send(idem ? lastKey : `k${keyCounter}`);
    if (!idem) setKeyCounter((k) => k + 1);
  };
  const reset = () => {
    timers.current.forEach(clearTimeout);
    seen.current.clear();
    setAttempts([]);
    setPhase("idle");
    setOutcome(null);
    setLastKey(null);
    setKeyCounter(1);
  };

  const last = attempts[attempts.length - 1];
  const clientSaw = (a: Attempt) => (a.outcome === "ok" ? "OK" : "TIMEOUT");

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={sendNew} disabled={busy} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Charge $10
        </button>
        <button
          type="button"
          onClick={retry}
          disabled={busy || !last || last.outcome === "ok"}
          className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40"
        >
          Retry last
        </button>
        <label className="flex items-center gap-2">
          packet loss
          <input type="range" min={0} max={80} value={loss} onChange={(e) => setLoss(Number(e.target.value))} className="w-24 accent-black" />
          <span className="font-dot text-sm w-8">{loss}%</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={idem} onChange={(e) => setIdem(e.target.checked)} className="accent-black" />
          idempotency key
        </label>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      {/* Wire */}
      <div className="p-4 bg-grid">
        <svg viewBox="0 0 600 120" width="100%" style={{ maxWidth: 640, display: "block", margin: "0 auto" }}>
          <rect x={10} y={30} width={110} height={60} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
          <text x={65} y={56} textAnchor="middle" fontFamily="var(--font-inter)" fontSize={13} fontWeight={600}>
            Client
          </text>
          <text x={65} y={74} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            sees OK / TIMEOUT
          </text>
          <rect x={470} y={30} width={120} height={60} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
          <text x={535} y={56} textAnchor="middle" fontFamily="var(--font-inter)" fontSize={13} fontWeight={600}>
            Server
          </text>
          <text x={535} y={74} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            {idem ? "dedups by key" : "runs every request"}
          </text>
          <line x1={120} y1={50} x2={480} y2={50} stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={480} y1={70} x2={120} y2={70} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="4 4" />

          {phase !== "idle" && (
            <circle
              r={6}
              fill={
                outcome === "ok" ? "var(--neon-3)" : outcome === "slow" ? "var(--neon-1)" : outcome === "lost-request" ? "var(--neon-5)" : "var(--neon-2)"
              }
              style={{
                transition: `transform ${STEP}ms linear`,
                transform:
                  phase === "out"
                    ? `translate(${outcome === "lost-request" ? 300 : 480}px, 50px)`
                    : phase === "server"
                      ? "translate(480px, 60px)"
                      : "translate(120px, 70px)",
              }}
            />
          )}
          {phase === "out" && outcome === "lost-request" && (
            <text x={300} y={40} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--neon-5)">
              dropped
            </text>
          )}
          {phase === "server" && outcome === "lost-response" && (
            <text x={300} y={88} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--neon-2)">
              executed · reply will be lost
            </text>
          )}
          {phase === "server" && outcome === "slow" && (
            <text x={300} y={88} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--neon-1)">
              still running · client gives up
            </text>
          )}
          {last && phase === "idle" && (
            <text x={300} y={108} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={11} fill="var(--ink)">
              attempt {last.n}: client saw {clientSaw(last)} · server {last.executed ? "charged" : "did nothing"}
            </text>
          )}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">client believes</p>
          <p className="font-dot text-3xl font-bold mt-1">
            ${confirmed * 10}
            <span className="text-ink-3 text-base"> confirmed</span>
          </p>
        </div>
        <div className="bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">server actually charged</p>
          <p className={`font-dot text-3xl font-bold mt-1 ${charges > confirmed ? "text-bad" : ""}`}>
            ${charges * 10}
            {charges > confirmed && <span className="text-base"> · {charges - confirmed} unconfirmed</span>}
          </p>
        </div>
      </div>

      {attempts.length > 0 && (
        <ol className="border-t border-line-soft divide-y divide-line-soft font-mono text-[11px]">
          {attempts.slice(-5).map((a) => (
            <li key={a.n} className="flex items-center gap-3 px-4 py-1.5">
              <span className="font-dot text-sm w-5">{a.n}</span>
              <span className="w-12 text-ink-2">{a.key}</span>
              <span className={`w-16 ${a.outcome === "ok" ? "text-neon-3" : "text-neon-5"}`}>{clientSaw(a)}</span>
              <span className="text-ink-2">
                {a.outcome === "lost-request" && "request lost · not executed"}
                {a.outcome === "lost-response" && (a.executed ? "executed · response lost" : "duplicate key · ignored")}
                {a.outcome === "slow" && (a.executed ? "executed · too slow for the timeout" : "duplicate key · ignored")}
                {a.outcome === "ok" && (a.executed ? "executed" : "duplicate key · ignored, same reply")}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Keep the loss high and retry after a timeout: without a key, the retry is a second charge whenever the
        first one actually ran. With a key, the server recognises the repeat and answers without executing again.
        This is why the book keeps coming back to idempotence (ch. 5, 9, 12).
      </p>
    </div>
  );
}
