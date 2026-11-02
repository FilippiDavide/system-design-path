"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "pull" | "push" | "hybrid";

/** Slider stops for the poster's follower count, log-spaced. */
const FOLLOWERS = [10, 200, 2_000, 20_000, 200_000, 2_000_000, 20_000_000];
/** Above this many followers the hybrid treats the account as a celebrity. */
const CELEBRITY = 100_000;
/** Timeline writes per second the fan-out workers can sustain. */
const WRITE_RATE = 1_000_000;
/** The reader follows this many accounts (chapter average). */
const FOLLOWING = 200;
const CELLS = 40;
const POLL_S = 5;

/** Format a count with k / M suffixes. */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}

/**
 * Fan-out lab. Pick how many followers the poster has, choose pull,
 * push or the hybrid, then post and read: the mailboxes fill at the
 * write rate of the fan-out workers, and the two counters show what
 * each side pays. Celebrities make push collapse; the hybrid fixes it.
 */
export function FanOutLab() {
  const [fi, setFi] = useState(1);
  const [mode, setMode] = useState<Mode>("push");
  const [delivered, setDelivered] = useState<number | null>(null); // fraction 0..1
  const [read, setRead] = useState<null | { cost: number; sawPost: boolean; label: string }>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const followers = FOLLOWERS[fi];
  const celebrity = mode === "hybrid" && followers >= CELEBRITY;
  const fansOut = mode === "push" || (mode === "hybrid" && !celebrity);
  const writesPerPost = fansOut ? followers : 1;
  const deliverySec = fansOut ? followers / WRITE_RATE : 0;
  const readCost = mode === "pull" ? FOLLOWING : celebrity ? 2 : 1;
  const readLabel =
    mode === "pull"
      ? `${FOLLOWING} lookups, 2 joins, every ${POLL_S} s`
      : celebrity
        ? "1 cache read + merge celebrity posts"
        : "1 cache read";

  /** Post: in fan-out modes the mailboxes fill over the delivery time. */
  const post = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRead(null);
    if (!fansOut) {
      setDelivered(1);
      return;
    }
    const steps = 24;
    const durationMs = Math.min(6000, Math.max(400, deliverySec * 1000));
    setDelivered(0);
    for (let k = 1; k <= steps; k++) {
      timers.current.push(window.setTimeout(() => setDelivered(k / steps), (durationMs * k) / steps));
    }
  };

  const readTimeline = () => {
    const posted = delivered !== null;
    const inMailbox = posted && (delivered ?? 0) >= 1;
    setRead({
      cost: readCost,
      sawPost: mode === "pull" ? posted : fansOut ? inMailbox : posted,
      label: readLabel,
    });
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setDelivered(null);
    setRead(null);
  };

  const filled = delivered === null ? 0 : Math.round(delivered * CELLS);
  const modeBtn = (m: Mode, label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => {
        setMode(m);
        reset();
      }}
      aria-pressed={mode === m}
      className={`px-3 py-1.5 ${mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line">
          {modeBtn("pull", "Pull")}
          {modeBtn("push", "Push")}
          {modeBtn("hybrid", "Hybrid")}
        </span>
        <label className="flex items-center gap-2">
          followers
          <input
            type="range"
            min={0}
            max={FOLLOWERS.length - 1}
            value={fi}
            onChange={(e) => {
              setFi(Number(e.target.value));
              reset();
            }}
            className="w-28 accent-black"
            aria-label="Followers of the poster"
          />
          <span className="font-dot text-sm w-10">{fmt(followers)}</span>
        </label>
        <button type="button" onClick={post} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Post
        </button>
        <button type="button" onClick={readTimeline} className="border border-line-soft px-3 py-1.5 hover:border-ink">
          Read timeline
        </button>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink normal-case tracking-normal">
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        {/* Write side */}
        <div className="bg-surface p-4" style={{ boxShadow: "inset 4px 0 0 var(--neon-1)" }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">write side · one post</p>
          <p className="font-dot text-3xl font-bold mt-1">
            {fmt(writesPerPost)}
            <span className="text-ink-3 text-base"> {writesPerPost === 1 ? "write" : "timeline writes"}</span>
          </p>
          <p className="text-[12px] text-ink-2 mt-1 min-h-[2.5em]">
            {mode === "pull" && "One insert into posts. Nothing else happens until someone asks."}
            {fansOut && `Copied into ${fmt(followers)} mailboxes at ${fmt(WRITE_RATE)} writes/s: ${deliverySec < 0.01 ? "instant delivery" : `${deliverySec.toFixed(deliverySec < 1 ? 2 : 0)} s of delivery`}${
              deliverySec > 5 ? ". The post is stale before it has reached everyone." : "."
            }`}
            {celebrity && `${fmt(followers)} followers is above the celebrity threshold (${fmt(CELEBRITY)}): stored once in the celebrity store, no fan-out.`}
          </p>
          <div className="mt-3 grid grid-cols-10 gap-1" aria-label="Follower mailboxes">
            {Array.from({ length: CELLS }, (_, i) => {
              const on = fansOut ? i < filled : false;
              return (
                <span
                  key={i}
                  className="h-4 border border-ink"
                  style={{ background: on ? "var(--neon-1)" : mode === "pull" || celebrity ? "var(--surface-2)" : "transparent" }}
                />
              );
            })}
          </div>
          <p className="font-mono text-[10px] text-ink-2 mt-1">
            {fansOut
              ? delivered === null
                ? `${CELLS} cells = ${fmt(followers)} mailboxes · press Post`
                : delivered < 1
                  ? `delivering · ${Math.round(delivered * 100)}% · ${fmt(Math.round(delivered * followers))} of ${fmt(followers)}`
                  : `delivered to all ${fmt(followers)} mailboxes`
              : mode === "pull"
                ? "no mailboxes: timelines are computed on read"
                : "mailboxes untouched: merged on read instead"}
          </p>
        </div>

        {/* Read side */}
        <div className="bg-surface p-4" style={{ boxShadow: "inset 4px 0 0 var(--neon-2)" }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">read side · one timeline view</p>
          <p className="font-dot text-3xl font-bold mt-1">
            {readCost}
            <span className="text-ink-3 text-base"> {readCost === 1 ? "read" : "lookups"}</span>
          </p>
          <p className="text-[12px] text-ink-2 mt-1 min-h-[2.5em]">{readLabel}.</p>
          <div className="mt-3 border border-line-soft p-3 min-h-[74px] font-mono text-[11px]">
            {read ? (
              <>
                <p>
                  cost: <span className="font-dot text-base">{read.cost}</span> {read.cost === 1 ? "read" : "lookups"}
                </p>
                <p className={read.sawPost ? "text-ok" : "text-warn"}>
                  {read.sawPost
                    ? "the new post is in the timeline"
                    : delivered === null
                      ? "nothing new: nobody posted yet"
                      : "post not delivered yet: the mailbox is still being filled"}
                </p>
                {mode === "pull" && <p className="text-ink-2">next poll in {POLL_S} s: ×{fmt(10_000_000 / POLL_S)} users = {fmt((10_000_000 / POLL_S) * FOLLOWING)} lookups/s</p>}
              </>
            ) : (
              <p className="text-ink-3">press Read timeline</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-line-soft border-t border-line-soft font-mono text-[11px]">
        <div className="bg-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-2">whole system · writes/s</p>
          <p className="font-dot text-xl font-bold">{mode === "pull" ? "5.8k" : "~1.2M"}</p>
          <p className="text-ink-2">{mode === "pull" ? "5,800 inserts" : "5,800 posts × 200 followers"}</p>
        </div>
        <div className="bg-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-2">whole system · reads/s</p>
          <p className="font-dot text-xl font-bold">{mode === "pull" ? "400M" : "2M"}</p>
          <p className="text-ink-2">{mode === "pull" ? "2M polls × 200 lookups" : "2M cache reads, one each"}</p>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Push pays on write to make reads trivial: the cached timeline is a materialized view, derived data in
        the sense of chapter 1. Slide the followers up to 20M and the fan-out of a single post takes longer than
        the post stays fresh, which is why celebrity posts are stored once and merged at read time.
      </p>
    </div>
  );
}
