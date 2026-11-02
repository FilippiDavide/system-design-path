"use client";

import { useEffect, useRef, useState } from "react";

/** Simulated seconds. The lease was granted 18 s ago for 30 s. */
const LEASE_EXPIRES = 12;
const RENEW_IF_BELOW = 10;
const T_END = 32;
/** Real milliseconds per simulated second while running. */
const TICK_MS = 110;

interface Event {
  t: number;
  who: "node1" | "node2" | "store";
  text: string;
  tone?: "ok" | "bad" | "warn";
}

/**
 * Compute everything that happens up to simulated time `t`, as a pure
 * function of the pause length and whether fencing is on. Keeping it
 * pure makes the lab deterministic and lets the slider re-run the
 * story instantly.
 */
function story(pause: number, fencing: boolean, t: number) {
  const events: Event[] = [];
  let file = "–";
  let highest: number | null = null;
  let leaseHolder: "node 1" | "node 2" | "expired" = "node 1";
  let verdict: { tone: "ok" | "bad"; text: string } | null = null;

  const push = (e: Event) => {
    if (e.t <= t) events.push(e);
  };

  push({ t: 0, who: "node1", text: `lease check: ${LEASE_EXPIRES} s left > ${RENEW_IF_BELOW} s, no renew, proceed` });
  if (pause > 0) push({ t: 0, who: "node1", text: `stop-the-world GC pause begins (${pause} s)`, tone: "warn" });

  const expired = pause > LEASE_EXPIRES;
  if (expired && t >= LEASE_EXPIRES) {
    leaseHolder = "expired";
    push({ t: LEASE_EXPIRES, who: "store", text: "lock service: lease of node 1 expired", tone: "warn" });
    push({ t: LEASE_EXPIRES, who: "node2", text: fencing ? "acquires the lease · token 34" : "acquires the lease" });
    leaseHolder = "node 2";
    push({ t: LEASE_EXPIRES, who: "node2", text: fencing ? "writes B immediately (token 34)" : "writes B immediately" });
    file = "B";
    if (fencing) highest = 34;
    push({ t: LEASE_EXPIRES, who: "store", text: fencing ? "accepted · highest token now 34" : "accepted", tone: "ok" });
  }

  if (t >= pause) {
    if (pause > 0) push({ t: pause, who: "node1", text: "resumes, unaware that any time passed", tone: expired ? "bad" : undefined });
    push({ t: pause, who: "node1", text: fencing ? "process(): writes A (token 33)" : "process(): writes A" });
    if (!expired) {
      file = "A";
      if (fencing) highest = 33;
      push({ t: pause, who: "store", text: "accepted: the lease is still valid", tone: "ok" });
      verdict = { tone: "ok", text: "No harm: the pause was shorter than the time left on the lease." };
    } else if (fencing) {
      push({ t: pause, who: "store", text: "rejected: token 33 < 34 already seen", tone: "bad" });
      verdict = { tone: "ok", text: "The zombie tried, the storage fenced it off. B, written by the real leaseholder, survives." };
    } else {
      file = "A";
      push({ t: pause, who: "store", text: "accepted: nothing marks this write as stale", tone: "bad" });
      verdict = { tone: "bad", text: "Split brain: a node that is no longer the leaseholder overwrote B. The file is corrupted." };
    }
  }

  return { events, file, highest, leaseHolder, verdict, expired };
}

/**
 * A leader checks its lease, pauses (GC) and then processes anyway.
 * The slider makes the pause long enough for the lease to expire and
 * another node to take over; the toggle adds a fencing token at the
 * storage so the stale write is refused.
 */
export function LeaseZombieLab() {
  const [pause, setPause] = useState(15);
  const [fencing, setFencing] = useState(false);
  const [t, setT] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  // The clock runs from the moment Run is pressed until the story ends.
  const running = t !== null && t < T_END;

  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(() => {
      setT((prev) => Math.min((prev ?? -1) + 1, T_END));
    }, TICK_MS);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [running]);

  const run = () => setT(0);
  const reset = () => setT(null);

  const now = t ?? -1;
  const s = story(pause, fencing, now);
  const finished = t === T_END;

  const px = (sec: number) => 90 + (sec / T_END) * 650;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={run} disabled={running} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Run
        </button>
        <label className="flex items-center gap-2">
          GC pause
          <input
            type="range"
            min={0}
            max={30}
            value={pause}
            disabled={running}
            onChange={(e) => {
              setPause(Number(e.target.value));
              setT(null);
            }}
            className="w-28 accent-black"
          />
          <span className="font-dot text-sm w-10">{pause} s</span>
        </label>
        <button
          type="button"
          aria-pressed={fencing}
          disabled={running}
          onClick={() => {
            setFencing((v) => !v);
            setT(null);
          }}
          className={`border px-3 py-1.5 disabled:opacity-40 ${fencing ? "bg-ink text-surface border-ink" : "border-line-soft hover:border-ink"}`}
        >
          fencing token
        </button>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="p-3 sm:p-4 bg-grid overflow-x-auto">
        <svg viewBox="0 0 780 190" width="100%" style={{ minWidth: 600, maxWidth: 900, display: "block", margin: "0 auto" }} role="img" aria-label="Timeline of the lease, the pause and the writes">
          {/* axis */}
          {[0, 4, 8, 12, 16, 20, 24, 28, 32].map((sec) => (
            <g key={sec}>
              <line x1={px(sec)} y1={28} x2={px(sec)} y2={170} stroke="var(--line-soft)" strokeWidth={1} />
              <text x={px(sec)} y={20} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
                {sec} s
              </text>
            </g>
          ))}

          {/* lease row */}
          <text x={12} y={56} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            LEASE
          </text>
          <rect x={px(0)} y={46} width={px(LEASE_EXPIRES) - px(0)} height={14} fill="var(--surface-2)" stroke="var(--ink)" strokeWidth={1.5} />
          <text x={px(LEASE_EXPIRES / 2)} y={57} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink)">
            node 1 · {fencing ? "token 33" : "no token"}
          </text>
          {s.expired && now >= LEASE_EXPIRES && (
            <>
              <rect x={px(LEASE_EXPIRES)} y={46} width={px(T_END) - px(LEASE_EXPIRES)} height={14} fill="#fff" stroke="var(--neon-3)" strokeWidth={1.5} />
              <text x={px((LEASE_EXPIRES + T_END) / 2)} y={57} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--neon-3)">
                node 2 · {fencing ? "token 34" : "no token"}
              </text>
            </>
          )}
          <text x={px(LEASE_EXPIRES)} y={40} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--warn)">
            expires
          </text>

          {/* node 1 row */}
          <text x={12} y={96} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            NODE 1
          </text>
          {pause > 0 && (
            <>
              <rect x={px(0)} y={86} width={px(pause) - px(0)} height={14} fill="#fff" stroke="var(--neon-4)" strokeWidth={1.5} strokeDasharray="4 3" />
              {pause >= 6 && (
                <text x={px(pause / 2)} y={97} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--neon-4)">
                  GC pause {pause} s
                </text>
              )}
            </>
          )}
          {now >= pause && (
            <g>
              <circle cx={px(pause)} cy={93} r={5} fill={s.expired ? (fencing ? "var(--ok)" : "var(--bad)") : "var(--ok)"} />
              <text x={px(pause) + 9} y={97} fontFamily="var(--font-jetbrains)" fontSize={10} fill={s.expired ? (fencing ? "var(--ok)" : "var(--bad)") : "var(--ok)"}>
                {s.expired ? (fencing ? "write A · rejected" : "write A · accepted") : "write A · ok"}
              </text>
            </g>
          )}

          {/* node 2 row */}
          <text x={12} y={136} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            NODE 2
          </text>
          {s.expired && now >= LEASE_EXPIRES && (
            <g>
              <circle cx={px(LEASE_EXPIRES)} cy={133} r={5} fill="var(--neon-3)" />
              <text x={px(LEASE_EXPIRES) + 9} y={137} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--neon-3)">
                takes the lease, writes B
              </text>
            </g>
          )}

          {/* now cursor */}
          {t !== null && (
            <>
              <line x1={px(Math.min(now, T_END))} y1={28} x2={px(Math.min(now, T_END))} y2={170} stroke="var(--ink)" strokeWidth={1.5} />
              <text x={px(Math.min(now, T_END))} y={182} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink)">
                now {Math.min(now, T_END)} s
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="grid md:grid-cols-[1fr_220px] gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-3 min-h-[120px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">event log</p>
          {t === null ? (
            <p className="text-[12px] text-ink-3">Press Run. Lease check, pause, process(): the loop from the book.</p>
          ) : (
            <ol className="font-mono text-[11px] space-y-0.5">
              {s.events.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-dot w-8 shrink-0 text-ink-2">{e.t}s</span>
                  <span className={`w-14 shrink-0 ${e.who === "node1" ? "text-neon-4" : e.who === "node2" ? "text-neon-3" : "text-ink-2"}`}>
                    {e.who === "store" ? "storage" : e.who === "node1" ? "node 1" : "node 2"}
                  </span>
                  <span className={e.tone === "bad" ? "text-bad" : e.tone === "ok" ? "text-ok" : e.tone === "warn" ? "text-warn" : ""}>{e.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">storage</p>
          <p className="mt-1 font-mono text-[12px]">
            file:{" "}
            {s.file === "–" ? (
              <span className="text-ink-3">empty</span>
            ) : (
              <span className={`font-dot text-2xl font-bold ${finished && s.verdict?.tone === "bad" ? "text-bad" : ""}`}>{s.file}</span>
            )}
          </p>
          <p className="font-mono text-[12px] text-ink-2">highest token: {fencing ? (s.highest ?? "–") : "not tracked"}</p>
          <p className="font-mono text-[12px] text-ink-2">lease holder: {t === null ? "node 1" : s.leaseHolder}</p>
          {finished && s.verdict && (
            <p className={`mt-3 text-[12px] leading-relaxed ${s.verdict.tone === "bad" ? "text-bad" : "text-ok"}`}>{s.verdict.text}</p>
          )}
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Two flaws in the loop: the expiry was computed on another machine and compared with the local clock, and
        the code assumes nothing happens between the check and process(). A 15 s stop-the-world pause is routine.
        The former leaseholder is a zombie; you cannot prevent it, you can only fence it: every grant carries an
        increasing token, every write carries the token, the storage rejects anything older than what it has seen.
      </p>
    </div>
  );
}
