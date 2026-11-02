"use client";

import { useState } from "react";

type Leader = "B" | "C";
type Strategy = "lww" | "siblings" | "crdt";
type Op = { kind: "add" | "remove"; item: string; tag: string; at: number } | { kind: "like"; at: number };

/** One replica's state of the two keys: an OR-set cart and a counter. */
interface Value {
  /** item → unique tags of the adds still visible. */
  tags: Record<string, string[]>;
  /** per-leader increments of the "likes" counter. */
  likes: Record<Leader, number>;
}

interface Outcome {
  kind: "converged" | "siblings" | "nothing";
  text: string;
  lost: string[];
}

const ITEMS = ["Book", "DVD", "Soap"];
const LEADERS: Leader[] = ["B", "C"];

const BASE: Value = { tags: { Book: ["t0"], DVD: ["t1"] }, likes: { B: 0, C: 0 } };

const cartOf = (v: Value) => ITEMS.filter((it) => (v.tags[it] ?? []).length > 0);
const likesOf = (v: Value) => v.likes.B + v.likes.C;

/** Apply a leader's local operations to the last synchronised value. */
function localView(base: Value, who: Leader, ops: Op[]): Value {
  const tags: Record<string, string[]> = Object.fromEntries(ITEMS.map((it) => [it, [...(base.tags[it] ?? [])]]));
  const likes = { ...base.likes };
  for (const op of ops) {
    if (op.kind === "add") tags[op.item] = [...tags[op.item], op.tag];
    else if (op.kind === "remove") tags[op.item] = [];
    else likes[who] += 1;
  }
  return { tags, likes };
}

function describe(ops: Op[]): string {
  if (ops.length === 0) return "no local writes";
  return ops
    .map((op) => (op.kind === "add" ? `add ${op.item}` : op.kind === "remove" ? `remove ${op.item}` : "+1 like"))
    .join(", ");
}

/**
 * Two leaders accept concurrent edits to the same shopping cart and
 * like counter. Replicate with last-write-wins, with siblings merged by
 * union, or with a CRDT, and compare what each strategy throws away.
 */
export function MultiLeaderLab() {
  const [strategy, setStrategy] = useState<Strategy>("lww");
  const [skew, setSkew] = useState(5);
  const [base, setBase] = useState<Value>(BASE);
  const [ops, setOps] = useState<Record<Leader, Op[]>>({ B: [], C: [] });
  const [clock, setClock] = useState(1);
  const [siblings, setSiblings] = useState<Record<Leader, Value> | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [tagN, setTagN] = useState(2);
  /** What the users meant at the moment siblings were created. */
  const [wanted, setWanted] = useState<Value | null>(null);

  const views: Record<Leader, Value> = { B: localView(base, "B", ops.B), C: localView(base, "C", ops.C) };
  const blocked = siblings !== null;

  const push = (who: Leader, op: Op) => {
    setOps((o) => ({ ...o, [who]: [...o[who], op] }));
    setClock((c) => c + 1);
  };
  const toggleItem = (who: Leader, item: string) => {
    const inCart = cartOf(views[who]).includes(item);
    if (inCart) push(who, { kind: "remove", item, tag: "", at: clock });
    else {
      push(who, { kind: "add", item, tag: `t${tagN}`, at: clock });
      setTagN((t) => t + 1);
    }
  };

  /** What the two users meant, taken together: the CRDT merge. */
  const intended = (): Value => {
    const tags: Record<string, string[]> = {};
    for (const it of ITEMS) {
      const b = views.B.tags[it] ?? [];
      const c = views.C.tags[it] ?? [];
      const old = base.tags[it] ?? [];
      const kept = old.filter((t) => b.includes(t) && c.includes(t));
      const added = [...b.filter((t) => !old.includes(t)), ...c.filter((t) => !old.includes(t))];
      tags[it] = [...kept, ...added];
    }
    return { tags, likes: { B: views.B.likes.B, C: views.C.likes.C } };
  };

  const diff = (result: Value, want: Value = intended()): string[] => {
    const out: string[] = [];
    const wc = cartOf(want);
    const rc = cartOf(result);
    for (const it of ITEMS) {
      if (wc.includes(it) && !rc.includes(it)) out.push(`${it} dropped although someone added it`);
      if (!wc.includes(it) && rc.includes(it)) out.push(`${it} reappeared although someone removed it`);
    }
    const dl = likesOf(want) - likesOf(result);
    if (dl > 0) out.push(`${dl} like${dl > 1 ? "s" : ""} lost`);
    return out;
  };

  const replicate = () => {
    const nB = ops.B.length;
    const nC = ops.C.length;
    if (nB === 0 && nC === 0) {
      setOutcome({ kind: "nothing", text: "Nothing to replicate: make a change on each leader first.", lost: [] });
      return;
    }
    const finish = (v: Value, text: string) => {
      setBase(v);
      setOps({ B: [], C: [] });
      setOutcome({ kind: "converged", text, lost: diff(v) });
    };
    if (nB === 0 || nC === 0) {
      const who: Leader = nB > 0 ? "B" : "C";
      finish(views[who], `Only leader ${who} wrote: no conflict, the other leader applies ${who}'s writes.`);
      return;
    }
    if (strategy === "lww") {
      const tsB = ops.B[nB - 1].at;
      const tsC = ops.C[nC - 1].at + skew;
      const winner: Leader = tsC >= tsB ? "C" : "B";
      const loser: Leader = winner === "B" ? "C" : "B";
      finish(
        views[winner],
        `Timestamps: B ${tsB} s, C ${tsC} s (clock +${skew} s). Leader ${winner} wins; the ${ops[loser].length} write${
          ops[loser].length > 1 ? "s" : ""
        } on leader ${loser} (${describe(ops[loser])}) were acknowledged and are now silently discarded.`,
      );
      return;
    }
    if (strategy === "siblings") {
      setSiblings({ B: views.B, C: views.C });
      setWanted(intended());
      setOps({ B: [], C: [] });
      setOutcome({
        kind: "siblings",
        text: "Concurrent writes detected by the version vector: both values are kept as siblings and returned to the application, which must merge them.",
        lost: [],
      });
      return;
    }
    finish(
      intended(),
      "Each add carries a unique tag and a remove only deletes the tags it had seen; the counter keeps one slot per leader and sums them. Both leaders reach the same state whatever the order.",
    );
  };

  const mergeUnion = () => {
    if (!siblings) return;
    const tags: Record<string, string[]> = {};
    for (const it of ITEMS) tags[it] = [...new Set([...(siblings.B.tags[it] ?? []), ...(siblings.C.tags[it] ?? [])])];
    const likes = { B: Math.max(siblings.B.likes.B, siblings.C.likes.B), C: Math.max(siblings.B.likes.C, siblings.C.likes.C) };
    const v = { tags, likes };
    setSiblings(null);
    setBase(v);
    setOutcome({ kind: "converged", text: "Application merge: union of the two carts, max of the two counters (the Amazon way).", lost: diff(v, wanted ?? undefined) });
  };

  const reset = () => {
    setBase(BASE);
    setOps({ B: [], C: [] });
    setSiblings(null);
    setOutcome(null);
    setClock(1);
    setTagN(2);
    setWanted(null);
  };

  const STRATEGIES: { key: Strategy; label: string }[] = [
    { key: "lww", label: "Last write wins" },
    { key: "siblings", label: "Siblings" },
    { key: "crdt", label: "CRDT" },
  ];

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={replicate} disabled={blocked} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Replicate
        </button>
        <span className="flex gap-px border border-line w-fit">
          {STRATEGIES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setStrategy(x.key)}
              aria-pressed={strategy === x.key}
              className={`px-2.5 py-1.5 ${strategy === x.key ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {x.label}
            </button>
          ))}
        </span>
        {strategy === "lww" && (
          <label className="flex items-center gap-2">
            C clock
            <input type="range" min={0} max={10} value={skew} onChange={(e) => setSkew(Number(e.target.value))} className="w-16 accent-black" aria-label="clock skew of leader C" />
            <span className="font-dot text-sm w-8">+{skew}s</span>
          </label>
        )}
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line-soft">
        {LEADERS.map((who) => {
          const v = views[who];
          const cart = cartOf(v);
          return (
            <div key={who} className="bg-surface p-3" style={{ boxShadow: `inset 4px 0 0 ${who === "B" ? "var(--neon-1)" : "var(--neon-2)"}` }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-semibold text-sm">Leader {who}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
                  {who === "B" ? "region EU" : `region US${strategy === "lww" ? ` · clock +${skew} s` : ""}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {ITEMS.map((it) => {
                  const on = cart.includes(it);
                  return (
                    <button
                      key={it}
                      type="button"
                      onClick={() => toggleItem(who, it)}
                      disabled={blocked}
                      aria-pressed={on}
                      className={`font-mono text-[11px] px-2 py-1 border disabled:opacity-40 ${on ? "border-ink bg-ink text-surface" : "border-line-soft text-ink-2 line-through"}`}
                    >
                      {it}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => push(who, { kind: "like", at: clock })}
                  disabled={blocked}
                  className="font-mono text-[11px] px-2 py-1 border border-line-soft hover:border-ink disabled:opacity-40"
                >
                  +1 like · <span className="font-dot">{likesOf(v)}</span>
                </button>
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
                since last sync: <span className={ops[who].length ? "text-warn" : ""}>{describe(ops[who])}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-surface p-3 border-t border-line-soft min-h-[96px]">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">after replication · {strategy === "lww" ? "last write wins" : strategy === "siblings" ? "siblings, manual merge" : "automatic merge (CRDT)"}</p>
        {siblings ? (
          <div className="flex flex-wrap items-center gap-3">
            {LEADERS.map((who) => (
              <span key={who} className="font-mono text-[12px] border border-warn px-2 py-1">
                sibling {who}: {"{"}
                {cartOf(siblings[who]).join(", ") || "empty"}
                {"}"} · {likesOf(siblings[who])} likes
              </span>
            ))}
            <button type="button" onClick={mergeUnion} className="border border-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-ink hover:text-surface">
              Merge: union
            </button>
          </div>
        ) : (
          <p className="font-mono text-[13px]">
            cart {"{"}
            {cartOf(base).join(", ") || "empty"}
            {"}"} · {likesOf(base)} likes
            {outcome?.kind === "converged" && <span className="text-ink-2"> · same on both leaders</span>}
          </p>
        )}
        {outcome && <p className="mt-2 text-[12px] leading-snug text-ink-2">{outcome.text}</p>}
        {outcome && outcome.kind === "converged" && (
          <p className={`mt-1 text-[12px] leading-snug ${outcome.lost.length ? "text-bad" : "text-ok"}`}>
            {outcome.lost.length ? outcome.lost.join(" · ") : "nothing lost: every user's intent is in the result"}
          </p>
        )}
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Try it: on B remove Book and add a like, on C add Soap and a like, then replicate. LWW converges by
        throwing one leader&apos;s writes away, and a clock that runs ahead always wins. Siblings lose nothing but hand
        the problem to the application: a union merge brings Book back, which is the Amazon cart bug. A CRDT
        (observed-remove set, per-replica counter) merges in any order and keeps everyone&apos;s intent.
      </p>
    </div>
  );
}
