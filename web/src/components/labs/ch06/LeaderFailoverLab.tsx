"use client";

import { useEffect, useReducer, useRef } from "react";

type NodeName = "A" | "B" | "C";
type Role = "leader" | "follower" | "down" | "split";
type WStatus = "pending" | "acked" | "timeout" | "lost" | "discarded";

interface WriteRec {
  id: number;
  status: WStatus;
  /** Node that accepted the write. */
  via: NodeName;
}

interface NodeState {
  role: Role;
  log: number[];
}

interface State {
  nodes: Record<NodeName, NodeState>;
  /** The legitimate leader. */
  leader: NodeName;
  writes: WriteRec[];
  nextId: number;
  lag: number;
  semiSync: boolean;
  fencing: boolean;
  phase: "normal" | "failed-over" | "returned";
  splitBrain: boolean;
}

type Action =
  | { type: "write"; target: NodeName; replicate: boolean }
  | { type: "deliver"; node: NodeName; ids: number[] }
  | { type: "ack"; id: number }
  | { type: "kill" }
  | { type: "return" }
  | { type: "fence" }
  | { type: "reset" }
  | { type: "lag"; value: number }
  | { type: "semiSync"; value: boolean }
  | { type: "fencing"; value: boolean };

/** Replication delay of each follower, as a multiple of the lag slider. */
const LAG_FACTOR: Record<NodeName, number> = { A: 1, B: 1, C: 2 };
const NAMES: NodeName[] = ["A", "B", "C"];

const initial: State = {
  nodes: {
    A: { role: "leader", log: [] },
    B: { role: "follower", log: [] },
    C: { role: "follower", log: [] },
  },
  leader: "A",
  writes: [],
  nextId: 1,
  lag: 1500,
  semiSync: false,
  fencing: true,
  phase: "normal",
  splitBrain: false,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "write": {
      const id = s.nextId;
      const node = s.nodes[a.target];
      return {
        ...s,
        nextId: id + 1,
        nodes: { ...s.nodes, [a.target]: { ...node, log: [...node.log, id] } },
        // A write the legitimate leader replicates is acked later (semi-sync)
        // or at once (async); a write on a split-brain leader is "acked" too,
        // from the point of view of the client that sent it.
        writes: [...s.writes, { id, status: a.replicate && s.semiSync ? "pending" : "acked", via: a.target }],
      };
    }
    case "deliver": {
      const node = s.nodes[a.node];
      if (node.role !== "follower") return s;
      const missing = a.ids.filter((id) => !node.log.includes(id));
      if (missing.length === 0) return s;
      return { ...s, nodes: { ...s.nodes, [a.node]: { ...node, log: [...node.log, ...missing] } } };
    }
    case "ack":
      return { ...s, writes: s.writes.map((w) => (w.id === a.id && w.status === "pending" ? { ...w, status: "acked" } : w)) };
    case "kill": {
      if (s.phase !== "normal") return s;
      // Promote the most up-to-date follower.
      const followers = NAMES.filter((n) => s.nodes[n].role === "follower");
      const best = followers.reduce((x, y) => (s.nodes[y].log.length > s.nodes[x].log.length ? y : x));
      const bestLog = s.nodes[best].log;
      const writes = s.writes.map((w) => {
        if (bestLog.includes(w.id)) return w.status === "pending" ? { ...w, status: "acked" as WStatus } : w;
        return { ...w, status: (w.status === "acked" ? "lost" : "timeout") as WStatus };
      });
      const nodes = { ...s.nodes, [s.leader]: { ...s.nodes[s.leader], role: "down" as Role }, [best]: { ...s.nodes[best], role: "leader" as Role } };
      return { ...s, nodes, leader: best, writes, phase: "failed-over" };
    }
    case "return": {
      if (s.phase !== "failed-over") return s;
      const old = NAMES.find((n) => s.nodes[n].role === "down");
      if (!old) return s;
      if (s.fencing) {
        // The old leader learns it was deposed: its unreplicated suffix is
        // discarded and it starts following the new leader.
        const leaderLog = s.nodes[s.leader].log;
        const extra = s.nodes[old].log.filter((id) => !leaderLog.includes(id));
        return {
          ...s,
          phase: "returned",
          nodes: { ...s.nodes, [old]: { role: "follower", log: s.nodes[old].log.filter((id) => leaderLog.includes(id)) } },
          writes: s.writes.map((w) => (extra.includes(w.id) ? { ...w, status: "discarded" } : w)),
        };
      }
      return { ...s, phase: "returned", splitBrain: true, nodes: { ...s.nodes, [old]: { ...s.nodes[old], role: "split" } } };
    }
    case "fence": {
      const old = NAMES.find((n) => s.nodes[n].role === "split");
      if (!old) return s;
      const leaderLog = s.nodes[s.leader].log;
      const extra = s.nodes[old].log.filter((id) => !leaderLog.includes(id));
      return {
        ...s,
        splitBrain: false,
        nodes: { ...s.nodes, [old]: { role: "follower", log: s.nodes[old].log.filter((id) => leaderLog.includes(id)) } },
        writes: s.writes.map((w) => (extra.includes(w.id) ? { ...w, status: "discarded" } : w)),
      };
    }
    case "reset":
      return { ...initial, lag: s.lag, semiSync: s.semiSync, fencing: s.fencing };
    case "lag":
      return { ...s, lag: a.value };
    case "semiSync":
      return { ...s, semiSync: a.value };
    case "fencing":
      return { ...s, fencing: a.value };
  }
}

const ROLE_LABEL: Record<Role, string> = {
  leader: "leader",
  follower: "follower",
  down: "down",
  split: "leader (stale)",
};

const STATUS: Record<WStatus, { label: string; cls: string }> = {
  pending: { label: "waiting for ack", cls: "text-warn" },
  acked: { label: "acked", cls: "text-ok" },
  timeout: { label: "timeout, never durable", cls: "text-warn" },
  lost: { label: "acked, then lost in failover", cls: "text-bad" },
  discarded: { label: "acked by old leader, discarded", cls: "text-bad" },
};

/**
 * Single-leader replication with failover. Writes go to the leader and
 * reach the followers after a lag; kill the leader and the writes that
 * had been acknowledged but not yet replicated are gone. Let the old
 * leader come back without fencing and two nodes accept writes.
 */
export function LeaderFailoverLab() {
  const [s, dispatch] = useReducer(reducer, initial);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const write = () => {
    const id = s.nextId;
    // In split brain a client with stale routing still talks to the old leader.
    const stale = s.splitBrain && id % 2 === 0;
    const target = stale ? NAMES.find((n) => s.nodes[n].role === "split")! : s.leader;
    dispatch({ type: "write", target, replicate: !stale });
    if (stale) return;
    const followers = NAMES.filter((n) => s.nodes[n].role === "follower");
    followers.forEach((f) => later(s.lag * LAG_FACTOR[f], () => dispatch({ type: "deliver", node: f, ids: [id] })));
    if (s.semiSync) {
      // The sync follower is the fastest one; the ack waits for it.
      const sync = followers.reduce((x, y) => (LAG_FACTOR[y] < LAG_FACTOR[x] ? y : x));
      later(s.lag * LAG_FACTOR[sync], () => dispatch({ type: "ack", id }));
    }
  };

  const kill = () => {
    // Whatever was in flight on the wire is gone with the leader.
    clearTimers();
    dispatch({ type: "kill" });
    const followers = NAMES.filter((n) => s.nodes[n].role === "follower");
    const best = followers.reduce((x, y) => (s.nodes[y].log.length > s.nodes[x].log.length ? y : x));
    followers
      .filter((f) => f !== best)
      .forEach((f) => later(s.lag * LAG_FACTOR[f], () => dispatch({ type: "deliver", node: f, ids: s.nodes[best].log })));
  };

  const returnOld = () => {
    dispatch({ type: "return" });
    if (s.fencing) {
      const old = NAMES.find((n) => s.nodes[n].role === "down")!;
      later(s.lag, () => dispatch({ type: "deliver", node: old, ids: s.nodes[s.leader].log }));
    }
  };

  const fence = () => {
    dispatch({ type: "fence" });
    const old = NAMES.find((n) => s.nodes[n].role === "split")!;
    later(s.lag, () => dispatch({ type: "deliver", node: old, ids: s.nodes[s.leader].log }));
  };

  const reset = () => {
    clearTimers();
    dispatch({ type: "reset" });
  };

  const acked = s.writes.filter((w) => w.status === "acked").length;
  const lost = s.writes.filter((w) => w.status === "lost" || w.status === "discarded").length;
  const leaderLog = s.nodes[s.leader].log;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={write} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Write
        </button>
        <button
          type="button"
          onClick={kill}
          disabled={s.phase !== "normal"}
          className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad disabled:opacity-40"
        >
          Kill the leader
        </button>
        <button
          type="button"
          onClick={returnOld}
          disabled={s.phase !== "failed-over"}
          className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40"
        >
          Old leader returns
        </button>
        {s.splitBrain && (
          <button type="button" onClick={fence} className="border border-bad text-bad px-3 py-1.5 hover:bg-bad hover:text-surface">
            Fence it
          </button>
        )}
        <label className="flex items-center gap-2">
          lag
          <input
            type="range"
            min={300}
            max={4000}
            step={100}
            value={s.lag}
            onChange={(e) => dispatch({ type: "lag", value: Number(e.target.value) })}
            className="w-20 accent-black"
            aria-label="replication lag"
          />
          <span className="font-dot text-sm w-10">{(s.lag / 1000).toFixed(1)}s</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={s.semiSync} onChange={(e) => dispatch({ type: "semiSync", value: e.target.checked })} className="accent-black" />
          semi-sync
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={s.fencing} onChange={(e) => dispatch({ type: "fencing", value: e.target.checked })} className="accent-black" />
          fencing
        </label>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line-soft">
        {NAMES.map((n) => {
          const node = s.nodes[n];
          const isLeader = node.role === "leader";
          const behind = node.role === "follower" ? leaderLog.filter((id) => !node.log.includes(id)).length : 0;
          return (
            <div
              key={n}
              className={`bg-surface p-3 min-h-[120px] ${node.role === "down" ? "opacity-50" : ""}`}
              style={{
                boxShadow: isLeader ? "inset 4px 0 0 var(--neon-1)" : node.role === "split" ? "inset 4px 0 0 var(--bad)" : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-semibold text-sm">Node {n}</span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                    isLeader ? "text-neon-1" : node.role === "split" ? "text-bad" : node.role === "down" ? "text-ink-3" : "text-ink-2"
                  }`}
                >
                  {ROLE_LABEL[node.role]}
                  {node.role === "follower" && ` · lag ${((s.lag * LAG_FACTOR[n]) / 1000).toFixed(1)}s`}
                  {s.semiSync && node.role === "follower" && LAG_FACTOR[n] === 1 && s.phase === "normal" && " · sync"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 min-h-[22px]">
                {node.log.length === 0 && <span className="font-mono text-[11px] text-ink-3">empty log</span>}
                {node.log.map((id) => {
                  const w = s.writes.find((x) => x.id === id)!;
                  const bad = w.status === "lost" || w.status === "discarded";
                  return (
                    <span
                      key={id}
                      className={`font-mono text-[11px] px-1.5 border ${bad ? "border-bad text-bad line-through" : "border-ink"}`}
                    >
                      w{id}
                    </span>
                  );
                })}
              </div>
              {behind > 0 && <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-warn">{behind} behind the leader</p>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-4 flex sm:flex-col gap-6 sm:gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">client got ok</p>
            <p className="font-dot text-3xl font-bold">{acked + lost}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">of which lost</p>
            <p className={`font-dot text-3xl font-bold ${lost > 0 ? "text-bad" : ""}`}>{lost}</p>
          </div>
        </div>
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">
            {s.splitBrain
              ? "split brain: two nodes accept writes, every second write lands on the stale leader"
              : s.phase === "failed-over"
                ? `failover: node ${s.leader} promoted (most up-to-date follower)`
                : s.phase === "returned"
                  ? "old leader fenced: it follows the new leader, its extra writes are gone"
                  : s.semiSync
                    ? "semi-sync: the ack waits for the sync follower"
                    : "async: the ack returns before any follower has the write"}
          </p>
          {s.writes.length === 0 ? (
            <p className="font-mono text-[11px] text-ink-3">no writes yet · write a few, then kill the leader while they are in flight</p>
          ) : (
            <ol className="font-mono text-[11px] space-y-0.5">
              {s.writes.slice(-6).map((w) => (
                <li key={w.id} className="flex gap-3">
                  <span className="w-7">w{w.id}</span>
                  <span className="w-10 text-ink-2">→ {w.via}</span>
                  <span className={STATUS[w.status].cls}>{STATUS[w.status].label}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        With asynchronous replication an ok to the client is not durability: kill the leader before the lag has
        elapsed and the promoted follower has never heard of those writes. Semi-sync keeps one follower in step and
        the ack waits for it, so nothing acknowledged is lost. If the old leader returns without being fenced, both
        nodes believe they are the leader (split brain) and the writes it accepts cannot be kept.
      </p>
    </div>
  );
}
