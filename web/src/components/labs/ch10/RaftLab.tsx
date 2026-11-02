"use client";

import { useEffect, useReducer } from "react";
import { Canvas, INK, INK2, Label, NEON, SOFT } from "@/components/diagrams/primitives";

type Role = "leader" | "follower" | "candidate";

interface Entry {
  term: number;
  cmd: string;
}

interface Node {
  id: number;
  alive: boolean;
  term: number;
  role: Role;
  log: Entry[];
  /** Number of entries known to be committed. */
  commit: number;
  /** Ticks since the last heartbeat. */
  quiet: number;
}

interface S {
  nodes: Node[];
  tick: number;
  /** Node ids cut off from the rest by a network partition. */
  isolated: number[];
  events: string[];
  nextCmd: number;
  running: boolean;
}

type Action =
  | { type: "tick" }
  | { type: "append"; id: number }
  | { type: "kill"; id: number }
  | { type: "revive"; id: number }
  | { type: "killLeader" }
  | { type: "isolate" }
  | { type: "heal" }
  | { type: "toggleRun" }
  | { type: "reset" };

const N = 5;
const TIMEOUT = 2;
const CMDS = "abcdefghijklmnop";

const initial = (): S => ({
  nodes: Array.from({ length: N }, (_, i) => ({
    id: i,
    alive: true,
    term: 1,
    role: i === 0 ? "leader" : "follower",
    log: [{ term: 1, cmd: "a" }],
    commit: 1,
    quiet: 0,
  })),
  tick: 0,
  isolated: [],
  events: ["n1 is leader for term 1 with one committed entry"],
  nextCmd: 1,
  running: true,
});

const lastTerm = (n: Node) => (n.log.length ? n.log[n.log.length - 1].term : 0);
const leaderOf = (s: S) => s.nodes.filter((n) => n.alive && n.role === "leader").sort((a, b) => b.term - a.term)[0];

/** One simulated round of heartbeats, commits and elections. */
function step(s: S): S {
  const nodes = s.nodes.map((n) => ({ ...n, log: [...n.log] }));
  const events: string[] = [];
  const side = (id: number) => (s.isolated.includes(id) ? 1 : 0);
  const reach = (a: Node, b: Node) => a.alive && b.alive && side(a.id) === side(b.id);

  for (const n of nodes) if (n.alive && n.role !== "leader") n.quiet += 1;

  // Heartbeats and log replication, highest term first.
  const leaders = nodes.filter((n) => n.alive && n.role === "leader").sort((a, b) => b.term - a.term);
  for (const L of leaders) {
    if (L.role !== "leader") continue;
    for (const F of nodes) {
      if (F === L || !reach(L, F)) continue;
      if (F.term > L.term) {
        events.push(`n${L.id + 1} hears of term ${F.term} and steps down; it was a stale leader`);
        L.role = "follower";
        L.term = F.term;
        L.quiet = 0;
        break;
      }
      F.term = L.term;
      F.role = "follower";
      F.quiet = 0;
      const dropped = F.log.filter((e, i) => !L.log[i] || L.log[i].term !== e.term || L.log[i].cmd !== e.cmd);
      if (dropped.length) events.push(`n${F.id + 1} discards ${dropped.map((e) => e.cmd).join(", ")} (never committed) and takes n${L.id + 1}'s log`);
      F.log = [...L.log];
      F.commit = Math.min(L.commit, F.log.length);
    }
    if (L.role !== "leader") continue;
    L.quiet = 0;
    for (let k = L.log.length; k > L.commit; k--) {
      if (L.log[k - 1].term !== L.term) break;
      const count = nodes.filter((n) => reach(L, n) && n.log.length >= k && n.log[k - 1].term === L.term).length;
      if (count * 2 > N) {
        events.push(`n${L.id + 1} commits up to "${L.log[k - 1].cmd}": replicated on ${count}/${N} nodes`);
        L.commit = k;
        break;
      }
    }
  }

  // Elections: one candidate per side, the lowest id that timed out.
  for (const sd of [0, 1]) {
    const c = nodes.find((n) => n.alive && n.role !== "leader" && n.quiet >= TIMEOUT && side(n.id) === sd);
    if (!c) continue;
    c.term += 1;
    c.role = "candidate";
    let votes = 1;
    for (const v of nodes) {
      if (v === c || !reach(c, v) || v.term >= c.term) continue;
      const upToDate = lastTerm(c) > lastTerm(v) || (lastTerm(c) === lastTerm(v) && c.log.length >= v.log.length);
      v.term = c.term;
      if (v.role === "leader") v.role = "follower";
      if (upToDate) {
        v.quiet = 0;
        votes += 1;
      }
    }
    if (votes * 2 > N) {
      c.role = "leader";
      c.quiet = 0;
      events.push(`n${c.id + 1} elected leader for term ${c.term} with ${votes}/${N} votes`);
    } else {
      c.role = "follower";
      c.quiet = 0;
      events.push(`n${c.id + 1} asks for votes in term ${c.term}: ${votes}/${N}, no majority reachable`);
    }
  }

  return { ...s, nodes, tick: s.tick + 1, events: [...s.events, ...events].slice(-6) };
}

function reducer(s: S, a: Action): S {
  switch (a.type) {
    case "tick":
      return s.running ? step(s) : s;
    case "toggleRun":
      return { ...s, running: !s.running };
    case "reset":
      return initial();
    case "append": {
      const n = s.nodes[a.id];
      if (!n.alive || n.role !== "leader") return s;
      const cmd = CMDS[s.nextCmd % CMDS.length];
      const nodes = s.nodes.map((x) => (x.id === a.id ? { ...x, log: [...x.log, { term: x.term, cmd }] } : x));
      return { ...s, nodes, nextCmd: s.nextCmd + 1, events: [...s.events, `client writes "${cmd}" to n${a.id + 1} (term ${n.term}), not yet committed`].slice(-6) };
    }
    case "kill": {
      const nodes = s.nodes.map((x) => (x.id === a.id ? { ...x, alive: false } : x));
      return { ...s, nodes, events: [...s.events, `n${a.id + 1} crashes${s.nodes[a.id].role === "leader" ? " (it was the leader)" : ""}`].slice(-6) };
    }
    case "revive": {
      const nodes = s.nodes.map((x) => (x.id === a.id ? { ...x, alive: true, role: "follower" as Role, quiet: 0 } : x));
      return { ...s, nodes, events: [...s.events, `n${a.id + 1} comes back as a follower`].slice(-6) };
    }
    case "killLeader": {
      const L = leaderOf(s);
      return L ? reducer(s, { type: "kill", id: L.id }) : s;
    }
    case "isolate": {
      const L = leaderOf(s);
      const lid = L ? L.id : 0;
      const buddy = s.nodes.find((n) => n.id !== lid && n.alive)?.id ?? (lid === 0 ? 1 : 0);
      return {
        ...s,
        isolated: [lid, buddy],
        events: [...s.events, `partition: n${lid + 1} and n${buddy + 1} are cut off from the other three`].slice(-6),
      };
    }
    case "heal":
      return { ...s, isolated: [], events: [...s.events, "partition healed: everyone can talk again"].slice(-6) };
  }
}

const ROW = 46;
const LOG_X = 262;
const CELL = 32;

/**
 * Raft in miniature: five nodes, terms, heartbeats every tick. Kill or
 * isolate the leader and watch a majority elect a new one; write to a
 * stale leader and see its entries overwritten once the partition heals.
 */
export function RaftLab() {
  const [s, dispatch] = useReducer(reducer, undefined, initial);

  useEffect(() => {
    const t = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(t);
  }, []);

  const leader = leaderOf(s);
  const h = 24 + N * ROW + 26;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => dispatch({ type: "killLeader" })} disabled={!leader} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          kill the leader
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: s.isolated.length ? "heal" : "isolate" })}
          className={`border px-3 py-1.5 ${s.isolated.length ? "border-ink bg-ink text-surface" : "border-line-soft hover:border-ink"}`}
          aria-pressed={s.isolated.length > 0}
        >
          {s.isolated.length ? "heal partition" : "isolate leader + 1"}
        </button>
        <button type="button" onClick={() => dispatch({ type: "toggleRun" })} aria-pressed={s.running} className="border border-line-soft px-3 py-1.5 hover:border-ink">
          {s.running ? "pause" : "play"}
        </button>
        <span className="text-ink-2">tick {s.tick}</span>
        <button type="button" onClick={() => dispatch({ type: "reset" })} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="p-3 bg-grid overflow-x-auto">
        <Canvas w={740} h={h}>
          <Label x={LOG_X} y={14} lines="log · term per entry" size={10} mono upper color={INK2} anchor="start" />
          {s.nodes.map((n, i) => {
            const y = 24 + i * ROW;
            const cy = y + ROW / 2;
            const iso = s.isolated.includes(n.id);
            const roleColor = !n.alive ? INK2 : n.role === "leader" ? NEON.blue : n.role === "candidate" ? NEON.orange : INK;
            return (
              <g key={n.id} opacity={n.alive ? 1 : 0.45}>
                {iso && <rect x={10} y={y + 3} width={720} height={ROW - 6} fill="none" stroke="var(--warn)" strokeWidth={1} strokeDasharray="4 3" />}
                <Label x={40} y={cy} lines={`n${n.id + 1}`} size={13} weight={600} />
                <Label x={70} y={cy - 7} lines={n.alive ? n.role : "dead"} size={10} mono upper color={roleColor} anchor="start" />
                <Label x={70} y={cy + 8} lines={`term ${n.term}${n.alive && n.role !== "leader" ? ` · quiet ${n.quiet}` : ""}`} size={10} mono color={INK2} anchor="start" />
                {iso && <Label x={716} y={cy} lines="cut off" size={10} mono color="var(--warn)" anchor="end" />}
                {n.log.map((e, k) => {
                  const committed = k < n.commit;
                  const x = LOG_X + k * CELL;
                  return (
                    <g key={k}>
                      <rect
                        x={x}
                        y={cy - 12}
                        width={CELL - 5}
                        height={24}
                        fill={committed ? "var(--ok)" : "#fff"}
                        stroke={committed ? "var(--ok)" : INK}
                        strokeWidth={1.5}
                        strokeDasharray={committed ? undefined : "3 2"}
                      />
                      <Label x={x + (CELL - 5) / 2} y={cy} lines={`${e.cmd}${e.term}`} size={10} mono color={committed ? "#fff" : INK} weight={600} />
                    </g>
                  );
                })}
              </g>
            );
          })}
          <rect x={LOG_X} y={h - 18} width={14} height={12} fill="var(--ok)" />
          <Label x={LOG_X + 20} y={h - 12} lines="committed on a majority" size={10} mono color={INK2} anchor="start" />
          <rect x={LOG_X + 190} y={h - 18} width={14} height={12} fill="#fff" stroke={INK} strokeDasharray="3 2" />
          <Label x={LOG_X + 210} y={h - 12} lines="appended, may be overwritten" size={10} mono color={INK2} anchor="start" />
          <line x1={10} y1={h - 24} x2={730} y2={h - 24} stroke={SOFT} strokeWidth={1} />
        </Canvas>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">per node · a client writes to any node it believes is leader</p>
          <ul className="space-y-1 font-mono text-[11px]">
            {s.nodes.map((n) => (
              <li key={n.id} className="flex items-center gap-2">
                <span className="w-7 font-semibold">n{n.id + 1}</span>
                <span className="w-24 text-ink-2 uppercase tracking-[0.1em]">{n.alive ? n.role : "dead"}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "append", id: n.id })}
                  disabled={!n.alive || n.role !== "leader"}
                  className="border border-line-soft px-2 py-0.5 hover:border-ink disabled:opacity-30 uppercase tracking-[0.1em]"
                >
                  write
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: n.alive ? "kill" : "revive", id: n.id })}
                  className={`border border-line-soft px-2 py-0.5 uppercase tracking-[0.1em] ${n.alive ? "hover:border-bad hover:text-bad" : "hover:border-ok hover:text-ok"}`}
                >
                  {n.alive ? "kill" : "revive"}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">what happened</p>
          <ol className="text-[12px] leading-snug space-y-1">
            {s.events.map((e, i) => (
              <li key={`${s.tick}-${i}`} className={i === s.events.length - 1 ? "" : "text-ink-2"}>
                {e}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        A follower that hears nothing for two ticks starts an election with a higher term and needs three of five votes;
        voters refuse a candidate whose log is behind theirs, so committed entries survive. Try: isolate the leader with
        one follower, write to it, and watch the other three elect a new leader whose writes commit while the stale
        leader&apos;s never reach a majority. Heal the partition and the stale leader steps down, its uncommitted entries
        overwritten. Epochs, not a single leader at a time, are the guarantee.
      </p>
    </div>
  );
}
