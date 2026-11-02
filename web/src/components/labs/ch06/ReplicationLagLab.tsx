"use client";

import { useState } from "react";

interface Step {
  /** What happens at this step. */
  say: string;
  /** Contents of each store, same order as `stores`. */
  stores: string[][];
  /** What the reader of this scenario sees, or null if no read yet. */
  view: string[] | null;
  /** Which store answered the read. */
  from?: string;
  verdict?: { text: string; kind: "bad" | "ok" };
}

interface Scenario {
  key: string;
  name: string;
  guarantee: string;
  stores: { name: string; tag: string }[];
  reader: string;
  off: Step[];
  on: Step[];
}

const Q = "Q: how far into the future can you see?";
const A = "A: about ten seconds, usually";

const SCENARIOS: Scenario[] = [
  {
    key: "ryw",
    name: "Read-your-writes",
    guarantee: "read-after-write",
    stores: [
      { name: "Leader", tag: "all writes" },
      { name: "Replica 1", tag: "lag 0.2 s" },
      { name: "Replica 2", tag: "lag 5 s" },
    ],
    reader: "Alice",
    off: [
      { say: "Alice posts a comment. The write goes to the leader, which acknowledges it.", stores: [["Alice: hi!"], [], []], view: null },
      { say: "The leader ships the write. Replica 1 applies it almost at once; replica 2 is five seconds behind.", stores: [["Alice: hi!"], ["Alice: hi!"], []], view: null },
      {
        say: "Alice reloads the page. The load balancer happens to pick replica 2.",
        stores: [["Alice: hi!"], ["Alice: hi!"], []],
        view: [],
        from: "Replica 2",
        verdict: { text: "Her own comment is missing: to Alice it looks lost, so she posts it again.", kind: "bad" },
      },
      { say: "Replica 2 catches up a few seconds later. Too late: the damage to Alice's trust is done.", stores: [["Alice: hi!"], ["Alice: hi!"], ["Alice: hi!"]], view: ["Alice: hi!"], from: "Replica 2" },
    ],
    on: [
      { say: "Alice posts a comment. The write goes to the leader; the client remembers its log position.", stores: [["Alice: hi!"], [], []], view: null },
      { say: "Replica 1 applies it almost at once; replica 2 is five seconds behind.", stores: [["Alice: hi!"], ["Alice: hi!"], []], view: null },
      {
        say: "Alice reloads. Data she may have modified herself is read from the leader (or from a replica that has reached her write's position).",
        stores: [["Alice: hi!"], ["Alice: hi!"], []],
        view: ["Alice: hi!"],
        from: "Leader",
        verdict: { text: "She sees her own write. Other people's writes may still come from a lagging replica.", kind: "ok" },
      },
      { say: "Replica 2 catches up. Nobody noticed the lag.", stores: [["Alice: hi!"], ["Alice: hi!"], ["Alice: hi!"]], view: ["Alice: hi!"], from: "Leader" },
    ],
  },
  {
    key: "mono",
    name: "Monotonic reads",
    guarantee: "monotonic reads",
    stores: [
      { name: "Leader", tag: "all writes" },
      { name: "Replica 1", tag: "lag 0.2 s" },
      { name: "Replica 2", tag: "lag 5 s" },
    ],
    reader: "Bob",
    off: [
      { say: "Alice's comment is written to the leader and reaches replica 1; replica 2 is still behind.", stores: [["Alice: hi!"], ["Alice: hi!"], []], view: null },
      { say: "Bob opens the thread. The load balancer picks replica 1: he sees the comment.", stores: [["Alice: hi!"], ["Alice: hi!"], []], view: ["Alice: hi!"], from: "Replica 1" },
      {
        say: "Bob refreshes. This time replica 2 answers.",
        stores: [["Alice: hi!"], ["Alice: hi!"], []],
        view: [],
        from: "Replica 2",
        verdict: { text: "The comment he had just seen has vanished: time went backwards.", kind: "bad" },
      },
      { say: "Replica 2 catches up and the comment reappears, as if nothing had happened.", stores: [["Alice: hi!"], ["Alice: hi!"], ["Alice: hi!"]], view: ["Alice: hi!"], from: "Replica 2" },
    ],
    on: [
      { say: "Alice's comment is written to the leader and reaches replica 1; replica 2 is still behind.", stores: [["Alice: hi!"], ["Alice: hi!"], []], view: null },
      { say: "Bob opens the thread. hash(Bob) picks replica 1 for him, always.", stores: [["Alice: hi!"], ["Alice: hi!"], []], view: ["Alice: hi!"], from: "Replica 1" },
      {
        say: "Bob refreshes. Same user, same replica: replica 1 again.",
        stores: [["Alice: hi!"], ["Alice: hi!"], []],
        view: ["Alice: hi!"],
        from: "Replica 1",
        verdict: { text: "He never reads older data than he has already seen. If replica 1 fails he is moved to another one, with a chance of one last jump back.", kind: "ok" },
      },
      { say: "Replica 2 catches up. Bob never knew it existed.", stores: [["Alice: hi!"], ["Alice: hi!"], ["Alice: hi!"]], view: ["Alice: hi!"], from: "Replica 1" },
    ],
  },
  {
    key: "prefix",
    name: "Consistent prefix",
    guarantee: "consistent prefix",
    stores: [
      { name: "Shard P · leader", tag: "Poons' data" },
      { name: "Shard P · follower", tag: "lag 5 s" },
      { name: "Shard Q · leader", tag: "Cake's data" },
      { name: "Shard Q · follower", tag: "lag 0.2 s" },
    ],
    reader: "the observer",
    off: [
      { say: "Mr Poons asks a question. It is stored on shard P, whose follower is five seconds behind.", stores: [[Q], [], [], []], view: null },
      { say: "Mrs Cake answers. Her answer depends on the question, but it is stored on shard Q, whose follower is fast.", stores: [[Q], [], [A], [A]], view: null },
      {
        say: "An observer reads the conversation from the followers of both shards.",
        stores: [[Q], [], [A], [A]],
        view: [A],
        from: "both followers",
        verdict: { text: "The answer arrives before the question: the observer sees an effect without its cause. Each shard is in order; there is no order across shards.", kind: "bad" },
      },
      { say: "Shard P's follower catches up. Now the question appears, after the answer.", stores: [[Q], [Q], [A], [A]], view: [A, Q], from: "both followers" },
    ],
    on: [
      { say: "Mr Poons asks a question. It is stored on shard P, whose follower is five seconds behind.", stores: [[Q], [], [], []], view: null },
      { say: "Mrs Cake answers. The answer is causally related to the question, so it is written to the same shard, P.", stores: [[Q, A], [], [], []], view: null },
      {
        say: "The observer reads from the followers. Shard P's follower has neither write yet.",
        stores: [[Q, A], [], [], []],
        view: [],
        from: "both followers",
        verdict: { text: "Stale, but never out of order: a single log per shard preserves the prefix.", kind: "ok" },
      },
      { say: "Shard P's follower catches up: question, then answer, in the order they were written.", stores: [[Q, A], [Q, A], [], []], view: [Q, A], from: "both followers" },
    ],
  },
];

/**
 * The three replication-lag anomalies as step-by-step scenarios. A
 * toggle turns on the guarantee that fixes each one, and the same
 * steps replay with the guarantee in place.
 */
export function ReplicationLagLab() {
  const [key, setKey] = useState("ryw");
  const [on, setOn] = useState(false);
  const [step, setStep] = useState(0);
  const sc = SCENARIOS.find((x) => x.key === key)!;
  const steps = on ? sc.on : sc.off;
  const st = steps[Math.min(step, steps.length - 1)];

  const pick = (k: string) => {
    setKey(k);
    setStep(0);
  };

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line w-fit">
          {SCENARIOS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => pick(x.key)}
              aria-pressed={key === x.key}
              className={`px-3 py-1.5 ${key === x.key ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {x.name}
            </button>
          ))}
        </span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="accent-black" />
          guarantee: {sc.guarantee}
        </label>
        <span className="flex gap-px border border-line w-fit ml-auto">
          <button
            type="button"
            onClick={() => setStep((v) => Math.max(0, v - 1))}
            disabled={step === 0}
            className="px-3 py-1.5 hover:bg-surface-2 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 font-dot border-x border-line">
            {step + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={() => setStep((v) => Math.min(steps.length - 1, v + 1))}
            disabled={step === steps.length - 1}
            className="px-3 py-1.5 hover:bg-surface-2 disabled:opacity-40"
          >
            Next
          </button>
        </span>
      </div>

      <div className={`grid grid-cols-2 ${sc.stores.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"} gap-px bg-line-soft`}>
        {sc.stores.map((store, i) => {
          const answered = st.from === store.name || (st.from === "both followers" && store.name.endsWith("follower"));
          return (
            <div key={store.name} className="bg-surface p-3 min-h-[96px]" style={answered ? { boxShadow: "inset 4px 0 0 var(--neon-1)" } : undefined}>
              {/* Four narrow columns: stack the tag under the name instead of wrapping the name. */}
              <div className={`mb-2 ${sc.stores.length === 4 ? "flex flex-col gap-0.5" : "flex items-baseline justify-between gap-2"}`}>
                <span className="font-semibold text-[13px] whitespace-nowrap">{store.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 hidden sm:inline">{store.tag}</span>
              </div>
              <ul className="font-mono text-[11px] space-y-1">
                {st.stores[i].length === 0 && <li className="text-ink-3">(nothing)</li>}
                {st.stores[i].map((v) => (
                  <li key={v} className="border border-line-soft px-1.5 py-0.5 break-words">
                    {v}
                  </li>
                ))}
              </ul>
              {answered && <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-neon-1">answered the read</p>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">step {step + 1}</p>
          <p className="text-sm leading-relaxed">{st.say}</p>
        </div>
        <div className="bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">what {sc.reader} sees</p>
          {st.view === null ? (
            <p className="font-mono text-[11px] text-ink-3">no read yet</p>
          ) : (
            <ul className="font-mono text-[11px] space-y-1">
              {st.view.length === 0 && <li className="text-ink-3">(empty page)</li>}
              {st.view.map((v, i) => (
                <li key={v} className="flex gap-2">
                  <span className="text-ink-3">{i + 1}.</span>
                  <span className="break-words">{v}</span>
                </li>
              ))}
            </ul>
          )}
          {st.verdict && (
            <p className={`mt-2 text-[12px] leading-snug ${st.verdict.kind === "bad" ? "text-bad" : "text-ok"}`}>{st.verdict.text}</p>
          )}
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Eventual consistency only promises that the replicas converge once writes stop. Each guarantee here is a
        promise about what one reader may observe in the meantime: their own writes (read-after-write), never
        older data than before (monotonic reads), effects never before their causes (consistent prefix). Step
        through with the guarantee off, then on.
      </p>
    </div>
  );
}
