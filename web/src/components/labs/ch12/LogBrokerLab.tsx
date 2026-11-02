"use client";

import { useState } from "react";

type Mode = "queue" | "log";
type Who = "A" | "B";

interface Msg {
  id: number;
  key: string;
}

const USERS = ["ada", "bob", "cy", "dee"];
/** Partition key: events of one user always land in the same partition. */
const partitionOf = (key: string) => (key === "ada" || key === "cy" ? 0 : 1);
const label = (m: Msg) => `m${m.id}·${m.key}`;

interface LogState {
  parts: [Msg[], Msg[]];
  /** Next message each consumer will read (A owns P0, B owns P1). */
  pos: [number, number];
  /** Offset last recorded by the broker, per consumer. */
  committed: [number, number];
}

interface QueueState {
  queue: Msg[];
  inflight: Record<Who, Msg | null>;
}

const EMPTY_LOG: LogState = { parts: [[], []], pos: [0, 0], committed: [0, 0] };
const EMPTY_QUEUE: QueueState = { queue: [], inflight: { A: null, B: null } };

/**
 * Two brokers side by side. The log-based one appends to partitions
 * and only remembers each consumer's offset: a crash replays from the
 * last committed offset, so messages are seen twice but in order. The
 * AMQP/JMS one hands individual messages out, deletes them on ack and
 * redelivers unacked ones to whoever is free: a crash duplicates and
 * reorders.
 */
export function LogBrokerLab() {
  const [mode, setMode] = useState<Mode>("log");
  const [n, setN] = useState(0);
  const [log, setLog] = useState<LogState>(EMPTY_LOG);
  const [q, setQ] = useState<QueueState>(EMPTY_QUEUE);
  const [processed, setProcessed] = useState<Record<Who, string[]>>({ A: [], B: [] });
  const [order, setOrder] = useState<string[]>([]);
  const [note, setNote] = useState("Produce a few messages, then let the consumers work through them.");

  const reset = (m: Mode = mode) => {
    setMode(m);
    setN(0);
    setLog(EMPTY_LOG);
    setQ(EMPTY_QUEUE);
    setProcessed({ A: [], B: [] });
    setOrder([]);
    setNote("Produce a few messages, then let the consumers work through them.");
  };

  const record = (who: Who, m: Msg) => {
    setProcessed((p) => ({ ...p, [who]: [...p[who], label(m)] }));
    setOrder((o) => [...o, `${label(m)}→${who}`]);
  };

  const produce = () => {
    if (n >= 12) return;
    const m: Msg = { id: n + 1, key: USERS[n % USERS.length] };
    setN(n + 1);
    if (mode === "log") {
      const p = partitionOf(m.key);
      setLog((s) => {
        const parts: [Msg[], Msg[]] = [[...s.parts[0]], [...s.parts[1]]];
        parts[p].push(m);
        return { ...s, parts };
      });
      setNote(`${label(m)} appended at offset ${log.parts[p].length} of partition ${p}: same user, same partition, so one user's events stay ordered.`);
    } else {
      setQ((s) => ({ ...s, queue: [...s.queue, m] }));
      setNote(`${label(m)} queued. The broker will hand it to whichever consumer is free.`);
    }
  };

  /* ---- log mode ---- */
  const processLog = (who: Who) => {
    const p = who === "A" ? 0 : 1;
    const m = log.parts[p][log.pos[p]];
    if (!m) return;
    record(who, m);
    const dup = processed[who].includes(label(m));
    setLog((s) => {
      const pos: [number, number] = [...s.pos] as [number, number];
      pos[p] += 1;
      return { ...s, pos };
    });
    setNote(
      dup
        ? `${label(m)} processed again by consumer ${who}: it was read before the crash but its offset was never committed. At-least-once, in order.`
        : `Consumer ${who} read ${label(m)} at offset ${log.pos[p]} of partition ${p}. Nothing is deleted; only its position moved.`,
    );
  };
  const commit = () => {
    setLog((s) => ({ ...s, committed: [...s.pos] as [number, number] }));
    setNote(`Offsets committed: A @${log.pos[0]}, B @${log.pos[1]}. This is the only bookkeeping the broker keeps, like a follower's log sequence number.`);
  };
  const crashLog = () => {
    const lost = log.pos[0] - log.committed[0];
    setLog((s) => ({ ...s, pos: [s.committed[0], s.pos[1]] }));
    setNote(
      lost > 0
        ? `Consumer A crashed and restarted from its committed offset ${log.committed[0]}: it will see ${lost} message${lost > 1 ? "s" : ""} again.`
        : "Consumer A crashed and restarted exactly where it had committed: nothing to replay.",
    );
  };

  /* ---- queue mode ---- */
  const deliver = () => {
    const m = q.queue[0];
    if (!m) return;
    const who: Who | null = q.inflight.A === null ? "A" : q.inflight.B === null ? "B" : null;
    if (!who) return;
    record(who, m);
    setQ((s) => ({ queue: s.queue.slice(1), inflight: { ...s.inflight, [who]: m } }));
    const again = processed.A.includes(label(m)) || processed.B.includes(label(m));
    setNote(
      again
        ? `${label(m)} redelivered to consumer ${who} and processed a second time, after messages that came later: duplicated and reordered.`
        : `${label(m)} delivered to consumer ${who}, which processes it. The broker keeps it until the ack arrives.`,
    );
  };
  const ack = (who: Who) => {
    const m = q.inflight[who];
    if (!m) return;
    setQ((s) => ({ ...s, inflight: { ...s.inflight, [who]: null } }));
    setNote(`Consumer ${who} acked ${label(m)}: the broker deletes it. Receiving was destructive; a new consumer could never read it.`);
  };
  const crashQueue = () => {
    const m = q.inflight.A;
    setQ((s) => ({ queue: m ? [m, ...s.queue] : s.queue, inflight: { ...s.inflight, A: null } }));
    setNote(
      m
        ? `Consumer A crashed holding ${label(m)} unacked. The broker puts it back at the head: the next free consumer gets it, after whatever it already did.`
        : "Consumer A crashed with nothing in flight: nothing to redeliver.",
    );
  };

  const dupCount = (list: string[]) => list.length - new Set(list).size;
  const canDeliver = q.queue.length > 0 && (q.inflight.A === null || q.inflight.B === null);

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line w-fit">
          {(["log", "queue"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => reset(m)}
              className={`px-3 py-1.5 ${mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {m === "log" ? "Log-based" : "AMQP/JMS"}
            </button>
          ))}
        </span>
        <button type="button" onClick={produce} disabled={n >= 12} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Produce
        </button>
        {mode === "log" ? (
          <>
            <button type="button" onClick={() => processLog("A")} disabled={!log.parts[0][log.pos[0]]} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
              A: read next
            </button>
            <button type="button" onClick={() => processLog("B")} disabled={!log.parts[1][log.pos[1]]} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
              B: read next
            </button>
            <button type="button" onClick={commit} className="border border-line-soft px-3 py-1.5 hover:border-ink">
              Commit offsets
            </button>
            <button type="button" onClick={crashLog} className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad">
              Crash A
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={deliver} disabled={!canDeliver} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
              Deliver next
            </button>
            <button type="button" onClick={() => ack("A")} disabled={!q.inflight.A} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
              Ack A
            </button>
            <button type="button" onClick={() => ack("B")} disabled={!q.inflight.B} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
              Ack B
            </button>
            <button type="button" onClick={crashQueue} className="border border-line-soft px-3 py-1.5 hover:border-bad hover:text-bad">
              Crash A
            </button>
          </>
        )}
        <button type="button" onClick={() => reset()} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink normal-case tracking-normal">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        {/* Broker */}
        <div className="bg-surface p-3 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">
            broker · {mode === "log" ? "two partitions, nothing deleted" : "one queue, deleted on ack"}
          </p>
          {mode === "log" ? (
            <div className="space-y-4">
              {([0, 1] as const).map((p) => {
                const who: Who = p === 0 ? "A" : "B";
                return (
                  <div key={p}>
                    <p className="font-mono text-[11px] mb-1">
                      partition {p} <span className="text-ink-2">· read by {who}</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {log.parts[p].map((m, i) => {
                        const committed = i < log.committed[p];
                        const read = i < log.pos[p];
                        return (
                          <span
                            key={m.id}
                            title={`offset ${i}`}
                            className={`inline-flex flex-col items-center border px-1.5 py-0.5 font-mono text-[11px] ${
                              committed ? "border-line-soft bg-surface-2 text-ink-2" : read ? "border-neon-1" : "border-ink"
                            }`}
                          >
                            <span>{label(m)}</span>
                            <span className="text-[9px] text-ink-3">@{i}</span>
                          </span>
                        );
                      })}
                      <span className="inline-flex items-center border border-dashed border-line-soft px-2 font-mono text-[11px] text-ink-3">
                        @{log.parts[p].length}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-ink-2 mt-1">
                      position {log.pos[p]} · committed offset {log.committed[p]}
                      {log.pos[p] > log.committed[p] && <span className="text-neon-1"> · {log.pos[p] - log.committed[p]} read but not committed</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-mono text-[11px] mb-1">waiting</p>
                <div className="flex flex-wrap gap-1 min-h-[26px]">
                  {q.queue.length === 0 && <span className="font-mono text-[11px] text-ink-3">empty</span>}
                  {q.queue.map((m) => (
                    <span key={m.id} className="border border-ink px-1.5 py-0.5 font-mono text-[11px]">
                      {label(m)}
                    </span>
                  ))}
                </div>
              </div>
              {(["A", "B"] as const).map((w) => (
                <p key={w} className="font-mono text-[11px]">
                  in flight at {w}:{" "}
                  {q.inflight[w] ? (
                    <span className="border border-neon-5 px-1.5 py-0.5">{label(q.inflight[w]!)} · unacked</span>
                  ) : (
                    <span className="text-ink-3">none</span>
                  )}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Consumers */}
        <div className="grid grid-rows-2 gap-px bg-line-soft min-w-0">
          {(["A", "B"] as const).map((w) => {
            const list = processed[w];
            const dups = dupCount(list);
            return (
              <div key={w} className="bg-surface p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm">Consumer {w}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
                    {list.length} processed{dups > 0 && <span className="text-warn"> · {dups} duplicate{dups > 1 ? "s" : ""}</span>}
                  </span>
                </div>
                <p className="font-mono text-[11px] leading-6 break-words">
                  {list.length === 0 && <span className="text-ink-3">nothing yet</span>}
                  {list.map((l, i) => (
                    <span key={i} className={`mr-1 ${list.indexOf(l) !== i ? "text-warn underline decoration-dotted" : ""}`}>
                      {l}
                    </span>
                  ))}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-line-soft px-3 py-2 font-mono text-[11px] text-ink-2 break-words">
        <span className="uppercase tracking-[0.12em] text-[10px]">effective order</span>{" "}
        {order.length === 0 ? <span className="text-ink-3">—</span> : order.join("  ")}
      </div>
      <p className="px-3 py-2 text-[12px] border-t border-line-soft">{note}</p>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        {mode === "log"
          ? "Read a few messages, crash A before committing and read again: the same messages come back, in the same order, because the broker only stores an offset per consumer. Duplicates are the price of at-least-once; the order inside a partition is never lost."
          : "Deliver to both consumers, crash A before it acks, then deliver again: the message is redelivered to whoever is free and ends up processed twice and after later messages. Load balancing plus redelivery reorders; harmless for independent tasks, serious when events are causally related."}
      </p>
    </div>
  );
}
