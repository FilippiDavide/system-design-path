"use client";

import { useEffect, useReducer } from "react";
import { Arrow, Box, Canvas, Cylinder, Group, INK2, Label, NEON } from "@/components/diagrams/primitives";

type Mode = "2pc" | "consensus";
type Phase = "idle" | "prepared" | "decided" | "done";
type PState = "idle" | "prepared" | "committed" | "aborted";
type Decision = "commit" | "abort";

interface Participant {
  name: string;
  vote: "yes" | "no";
  state: PState;
}

interface S {
  mode: Mode;
  phase: Phase;
  coordUp: boolean;
  parts: Participant[];
  decision: Decision | null;
  /** How long the participants have been holding locks without an answer. */
  lockedTicks: number;
  /** Other transactions queued behind those locks. */
  blocked: number;
  /** Ticks since the coordinator crashed; consensus resolves at TIMEOUT. */
  stuck: number;
  events: string[];
}

type Action =
  | { type: "mode"; mode: Mode }
  | { type: "vote"; i: number }
  | { type: "next" }
  | { type: "crash" }
  | { type: "restart" }
  | { type: "tick" }
  | { type: "reset" };

const TIMEOUT = 3;

const initial = (mode: Mode, votes: ("yes" | "no")[] = ["yes", "yes", "yes"]): S => ({
  mode,
  phase: "idle",
  coordUp: true,
  parts: votes.map((v, i) => ({ name: `P${i + 1}`, vote: v, state: "idle" })),
  decision: null,
  lockedTicks: 0,
  blocked: 0,
  stuck: 0,
  events: [],
});

const push = (s: S, e: string): S => ({ ...s, events: [...s.events.slice(-5), e] });
const inDoubt = (s: S) => s.parts.some((p) => p.state === "prepared");
const apply = (parts: Participant[], d: Decision): Participant[] =>
  parts.map((p) => (p.state === "prepared" ? { ...p, state: d === "commit" ? "committed" : "aborted" } : p));

function reducer(s: S, a: Action): S {
  switch (a.type) {
    case "mode":
      return initial(a.mode, s.parts.map((p) => p.vote));
    case "reset":
      return initial(s.mode, s.parts.map((p) => p.vote));
    case "vote": {
      if (s.phase !== "idle") return s;
      const parts = s.parts.map((p, i) => (i === a.i ? { ...p, vote: p.vote === "yes" ? "no" : "yes" } : p) as Participant);
      return { ...s, parts };
    }
    case "next": {
      if (!s.coordUp) return s;
      if (s.phase === "idle") {
        const parts = s.parts.map((p) => ({ ...p, state: (p.vote === "yes" ? "prepared" : "aborted") as PState }));
        const votes = parts.map((p) => `${p.name} ${p.vote}`).join(", ");
        const extra = s.mode === "consensus" ? " Each vote also goes to every other participant." : "";
        return push(
          { ...s, phase: "prepared", parts },
          `PREPARE sent. Votes: ${votes}. Every yes-voter wrote a prepare record and holds its locks.${extra}`,
        );
      }
      if (s.phase === "prepared") {
        const decision: Decision = s.parts.every((p) => p.vote === "yes") ? "commit" : "abort";
        const where =
          s.mode === "2pc"
            ? "writes it to its own disk"
            : "proposes it to the replicated log; a majority of the 3 log nodes accept, so it is decided";
        return push({ ...s, phase: "decided", decision }, `Coordinator decides ${decision.toUpperCase()} and ${where}. Nobody else knows yet.`);
      }
      if (s.phase === "decided" && s.decision) {
        return push(
          { ...s, phase: "done", parts: apply(s.parts, s.decision) },
          `${s.decision.toUpperCase()} sent to all participants; they apply it and release their locks.`,
        );
      }
      return s;
    }
    case "crash": {
      if (!s.coordUp || s.phase === "idle" || s.phase === "done") return s;
      const what =
        s.phase === "prepared"
          ? "before deciding. Yes-voters are now in doubt: they cannot commit (it might have decided abort) nor abort (it might have decided commit)."
          : "after deciding but before telling anyone.";
      return push({ ...s, coordUp: false, stuck: 0 }, `Coordinator crashes ${what}`);
    }
    case "restart": {
      if (s.coordUp) return s;
      if (s.phase === "prepared") {
        const d: Decision = "abort";
        const src = s.mode === "2pc" ? "its disk" : "the replicated log";
        return push(
          { ...s, coordUp: true, phase: "done", decision: d, parts: apply(s.parts, d) },
          `Coordinator restarts, finds no decision in ${src}, decides ABORT and releases everyone.`,
        );
      }
      if (s.phase === "decided" && s.decision) {
        const src = s.mode === "2pc" ? "its disk" : "the replicated log";
        return push(
          { ...s, coordUp: true, phase: "done", parts: apply(s.parts, s.decision) },
          `Coordinator restarts, reads ${s.decision.toUpperCase()} from ${src} and resends it.`,
        );
      }
      return { ...s, coordUp: true };
    }
    case "tick": {
      if (s.coordUp || !inDoubt(s)) return s;
      const lockedTicks = s.lockedTicks + 1;
      const blocked = s.blocked + 2;
      const stuck = s.stuck + 1;
      if (s.mode === "consensus" && stuck >= TIMEOUT) {
        if (s.phase === "decided" && s.decision) {
          return push(
            { ...s, lockedTicks, blocked, stuck, phase: "done", parts: apply(s.parts, s.decision) },
            `Timeout. The decision is in the replicated log, not on one disk: P1 reads ${s.decision.toUpperCase()} from the log and everyone completes.`,
          );
        }
        const allYes = s.parts.every((p) => p.vote === "yes");
        const d: Decision = allYes ? "commit" : "abort";
        const why = allYes
          ? "P1 holds all three yes votes and proposes COMMIT to the log"
          : "P1 saw an abort vote and proposes ABORT to the log";
        return push(
          { ...s, lockedTicks, blocked, stuck, phase: "done", decision: d, parts: apply(s.parts, d) },
          `Timeout. ${why}; a majority of log nodes accept, the decision is ${d.toUpperCase()} and everyone follows it. No coordinator needed.`,
        );
      }
      const next = { ...s, lockedTicks, blocked, stuck };
      return stuck === 1 && s.mode === "2pc"
        ? push(next, "Participants wait. Only the coordinator's disk knows the outcome; until it is back the locks stay held.")
        : next;
    }
  }
}

const PX = [70, 300, 530];

/**
 * Two-phase commit with a coordinator you can crash at the worst
 * moment, and the same commit run over a replicated log instead. In
 * doubt, participants keep their locks and every other transaction
 * that touches those rows queues up behind them.
 */
export function TwoPhaseCommitLab() {
  const [s, dispatch] = useReducer(reducer, "2pc", initial);

  useEffect(() => {
    const t = window.setInterval(() => dispatch({ type: "tick" }), 900);
    return () => window.clearInterval(t);
  }, []);

  const doubt = !s.coordUp && inDoubt(s);
  const canNext = s.coordUp && s.phase !== "done";
  const nextLabel = s.phase === "idle" ? "send prepare" : s.phase === "prepared" ? "decide" : s.phase === "decided" ? "send decision" : "done";
  const decisionText = s.decision ? s.decision.toUpperCase() : "—";
  const logHasDecision = s.phase === "decided" || s.phase === "done";

  const msg =
    s.phase === "idle"
      ? ""
      : !s.coordUp
        ? "silence"
        : s.phase === "prepared"
          ? "PREPARE? → votes"
          : s.phase === "decided"
            ? "(decision not sent yet)"
            : decisionText;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line">
          {(["2pc", "consensus"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => dispatch({ type: "mode", mode: m })}
              aria-pressed={s.mode === m}
              className={`px-3 py-1.5 ${s.mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {m === "2pc" ? "2PC" : "consensus log"}
            </button>
          ))}
        </span>
        <button type="button" onClick={() => dispatch({ type: "next" })} disabled={!canNext} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          {nextLabel}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "crash" })}
          disabled={!s.coordUp || s.phase === "idle" || s.phase === "done"}
          className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad disabled:opacity-40"
        >
          crash coordinator
        </button>
        <button type="button" onClick={() => dispatch({ type: "restart" })} disabled={s.coordUp} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          restart coordinator
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "vote", i: 1 })}
          aria-pressed={s.parts[1].vote === "no"}
          disabled={s.phase !== "idle"}
          className={`px-3 py-1.5 border disabled:opacity-40 ${s.parts[1].vote === "no" ? "border-ink bg-ink text-surface" : "border-line-soft hover:border-ink"}`}
        >
          P2 votes no
        </button>
        <button type="button" onClick={() => dispatch({ type: "reset" })} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="p-3 bg-grid overflow-x-auto">
        <Canvas w={740} h={266}>
          {/* Shifted down so the group label of the replicated log is not clipped by the viewBox. */}
          <g transform="translate(0 14)">
          <Box
            x={300}
            y={18}
            w={140}
            h={52}
            title="Coordinator"
            sub={s.coordUp ? (s.phase === "idle" ? "idle" : s.phase === "done" ? "finished" : s.phase) : "crashed"}
            accent={s.coordUp ? NEON.blue : "var(--bad)"}
            titleSize={12}
          />
          {!s.coordUp && (
            <g>
              <line x1={306} y1={24} x2={434} y2={64} stroke="var(--bad)" strokeWidth={1.5} />
              <line x1={434} y1={24} x2={306} y2={64} stroke="var(--bad)" strokeWidth={1.5} />
            </g>
          )}

          {/* where the decision lives */}
          {s.mode === "2pc" ? (
            <g>
              <Arrow pts={[440, 44, 520, 44]} color={logHasDecision ? "blue" : "soft"} dashed={!logHasDecision} label="decision" labelOffset={-10} />
              <Cylinder x={520} y={14} w={120} h={60} title="coordinator's disk" sub={decisionText} accent={logHasDecision ? NEON.blue : undefined} />
              {!s.coordUp && <Label x={580} y={92} lines="unreachable" size={10} mono color="var(--bad)" />}
            </g>
          ) : (
            <g>
              <Group x={506} y={12} w={226} h={70} label="replicated log · 3 nodes" />
              <Arrow pts={[440, 44, 506, 44]} color={logHasDecision ? "green" : "soft"} dashed={!logHasDecision} label="propose" labelOffset={-10} />
              {[0, 1, 2].map((i) => (
                <Cylinder key={i} x={516 + i * 72} y={22} w={62} h={50} title={decisionText} accent={logHasDecision ? NEON.green : undefined} />
              ))}
              <Label x={619} y={94} lines={logHasDecision ? "decided on a majority\nreadable by anyone" : "empty"} size={10} mono color={INK2} />
            </g>
          )}

          {/* messages */}
          {s.phase !== "idle" &&
            PX.map((x, i) => (
              <Arrow
                key={i}
                pts={[370, 70, 370, 112, x + 70, 112, x + 70, 150]}
                color={s.coordUp ? (s.phase === "decided" ? "soft" : "ink") : "soft"}
                dashed={!s.coordUp || s.phase === "decided"}
              />
            ))}
          {msg && (
            <g>
              {/* White backing: the message sits on the vertical line down to P2. */}
              <rect x={370 - (msg.length * 6.2 + 8) / 2} y={122} width={msg.length * 6.2 + 8} height={12} fill="#fff" />
              <Label x={370} y={128} lines={msg} size={10} mono color={s.coordUp ? INK2 : "var(--bad)"} />
            </g>
          )}

          {s.parts.map((p, i) => {
            const x = PX[i];
            const held = p.state === "prepared";
            const sub =
              p.state === "idle"
                ? `will vote ${p.vote}`
                : p.state === "prepared"
                  ? doubt
                    ? "in doubt\nlocks held"
                    : "prepared\nlocks held"
                  : p.state === "committed"
                    ? "committed\nlocks released"
                    : "aborted\nlocks released";
            const accent =
              p.state === "prepared" ? (doubt ? "var(--warn)" : NEON.blue) : p.state === "committed" ? "var(--ok)" : p.state === "aborted" ? INK2 : undefined;
            return (
              <g key={p.name}>
                <Box x={x} y={148} w={140} h={60} title={p.name} sub={sub} accent={accent} titleSize={12} />
                {held && doubt && <Label x={x + 70} y={222} lines={`locked for ${s.lockedTicks} ticks`} size={10} mono color="var(--warn)" />}
              </g>
            );
          })}
          {s.mode === "consensus" && s.phase !== "idle" && (
            <g>
              <line x1={140} y1={238} x2={600} y2={238} stroke={INK2} strokeWidth={1} strokeDasharray="3 3" />
              <rect x={266} y={232} width={208} height={12} fill="#fff" />
              <Label x={370} y={238} lines="every participant has every vote" size={10} mono color={INK2} />
            </g>
          )}
          </g>
        </Canvas>
      </div>

      <div className="grid md:grid-cols-[1fr_1.4fr] gap-px bg-line-soft border-t border-line-soft">
        <div className="grid grid-cols-2 gap-px bg-line-soft">
          <div className="bg-surface p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">locks held, in doubt</p>
            <p className={`font-dot text-3xl font-bold mt-1 ${doubt ? "text-warn" : ""}`}>
              {s.lockedTicks}
              <span className="text-base text-ink-3"> ticks</span>
            </p>
          </div>
          <div className="bg-surface p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">transactions blocked</p>
            <p className={`font-dot text-3xl font-bold mt-1 ${s.blocked > 0 && doubt ? "text-bad" : ""}`}>{s.blocked}</p>
          </div>
        </div>
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">what happened</p>
          {s.events.length === 0 ? (
            <p className="text-[12px] text-ink-2">Send PREPARE, then crash the coordinator before or after it decides.</p>
          ) : (
            <ol className="text-[12px] leading-snug space-y-1">
              {s.events.map((e, i) => (
                <li key={i} className={i === s.events.length - 1 ? "" : "text-ink-2"}>
                  {e}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        In 2PC the outcome lives on one disk, so a crashed coordinator leaves prepared participants in doubt, holding
        locks, and the rest of the system piles up behind them. With a consensus log the decision is replicated to a
        majority and any participant can propose one after a timeout: anyone can start, a quorum is enough. In 2PC only
        the coordinator asks, and all must answer. Atomic commitment is consensus with one extra rule: a single abort vote
        means abort.
      </p>
    </div>
  );
}
