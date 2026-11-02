"use client";

import { useState } from "react";

type Jump = "none" | "back" | "forward";

/** Real duration of the operation being timed, in ms. */
const OP_MS = 50;

function fmt(ms: number): string {
  // 42.004 style: seconds with three decimals around the book's example.
  const total = 42000 + ms;
  const s = Math.floor(total / 1000);
  const rest = total - s * 1000;
  return `${s}.${String(rest).padStart(3, "0")}`;
}

/**
 * Two nodes with their own quartz. Client A writes x = 1 on node 1,
 * client B reads it and writes x = 2 on node 3 a few milliseconds later.
 * Node 2 receives both and keeps the one with the higher timestamp
 * (last write wins). With a physical clock the increment can lose even
 * though it is causally later; with a logical clock it never does.
 */
export function ClockSkewLab() {
  const [skew1, setSkew1] = useState(4);
  const [skew3, setSkew3] = useState(-1);
  const [gap, setGap] = useState(3);
  const [logical, setLogical] = useState(false);
  const [jump, setJump] = useState<Jump>("none");

  const tsA = skew1; // real time 0 + skew of node 1
  const tsB = gap + skew3; // real time gap + skew of node 3
  const lwwKeeps: "A" | "B" | "tie" = logical ? "B" : tsB > tsA ? "B" : tsB < tsA ? "A" : "tie";
  const lost = lwwKeeps === "A";

  const ntp = () => {
    // NTP cannot do better than the network delay: a few ms of residual
    // error stay, and they are enough to misorder the two writes.
    setSkew1(3);
    setSkew3(0);
  };

  const todStart = 0;
  const todEnd = OP_MS + (jump === "back" ? -100 : jump === "forward" ? 1000 : 0);
  const todMeasured = todEnd - todStart;
  const monoMeasured = OP_MS;

  const chip = (on: boolean) =>
    `border px-3 py-1.5 ${on ? "bg-ink text-surface border-ink" : "border-line-soft hover:border-ink"}`;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={ntp} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          NTP sync
        </button>
        <label className="flex items-center gap-2">
          node 1 clock
          <input type="range" min={-30} max={30} value={skew1} onChange={(e) => setSkew1(Number(e.target.value))} className="w-24 accent-black" />
          <span className="font-dot text-sm w-14">
            {skew1 >= 0 ? "+" : ""}
            {skew1} ms
          </span>
        </label>
        <label className="flex items-center gap-2">
          node 3 clock
          <input type="range" min={-30} max={30} value={skew3} onChange={(e) => setSkew3(Number(e.target.value))} className="w-24 accent-black" />
          <span className="font-dot text-sm w-14">
            {skew3 >= 0 ? "+" : ""}
            {skew3} ms
          </span>
        </label>
        <label className="flex items-center gap-2">
          causal gap
          <input type="range" min={1} max={20} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-20 accent-black" />
          <span className="font-dot text-sm w-12">{gap} ms</span>
        </label>
        <button type="button" aria-pressed={logical} onClick={() => setLogical((v) => !v)} className={chip(logical)}>
          logical clock
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft">
        {/* Ordering with LWW */}
        <div className="bg-surface p-4">
          <p className="font-semibold text-sm">Ordering two writes with last write wins</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mt-0.5">
            {logical ? "timestamps are version counters" : "timestamps come from each node's own quartz"}
          </p>
          <ol className="mt-3 space-y-2 font-mono text-[12px]">
            <li className="flex gap-3 items-start">
              <span className="font-dot text-base w-5 shrink-0">1</span>
              <span>
                A writes <strong>x = 1</strong> on node 1 · real time 42.000 · stamp{" "}
                <span className="text-neon-1 font-semibold">{logical ? "v1" : fmt(tsA)}</span>
              </span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="font-dot text-base w-5 shrink-0">2</span>
              <span>
                B reads x = 1, writes <strong>x = 2</strong> on node 3 · real time {fmt(gap)} · stamp{" "}
                <span className="text-neon-2 font-semibold">{logical ? "v2" : fmt(tsB)}</span>
              </span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="font-dot text-base w-5 shrink-0">3</span>
              <span>
                Node 2 receives both, keeps the higher stamp:{" "}
                {lwwKeeps === "tie" ? (
                  <span className="text-warn font-semibold">equal stamps · random tiebreaker</span>
                ) : (
                  <span className={`font-semibold ${lost ? "text-bad" : "text-ok"}`}>x = {lost ? 1 : 2}</span>
                )}
              </span>
            </li>
          </ol>
          <div className={`mt-4 border p-3 text-[12px] leading-relaxed ${lost ? "border-bad" : lwwKeeps === "tie" ? "border-warn" : "border-line-soft"}`}>
            {logical ? (
              <>
                <span className="font-semibold text-ok">Increment kept.</span> B saw version 1 and produced version 2; the order
                is by causality, not by any clock, so node 2 cannot get it wrong.
              </>
            ) : lost ? (
              <>
                <span className="font-semibold text-bad">Increment lost.</span> Node 1&apos;s clock is {skew1 - skew3} ms ahead of
                node 3&apos;s, more than the {gap} ms between the two writes, so the earlier write carries the later
                stamp and the causally later x = 2 is silently dropped.
              </>
            ) : lwwKeeps === "tie" ? (
              <>
                <span className="font-semibold text-warn">Coin toss.</span> Same stamp to the millisecond: LWW picks one at
                random, and half the time it is the wrong one.
              </>
            ) : (
              <>
                <span className="font-semibold text-ok">Correct, this time.</span> The skew ({skew1 - skew3} ms) is smaller
                than the gap ({gap} ms). Shrink the gap or push node 1 ahead and watch it flip: nothing in the data says
                which outcome you got.
              </>
            )}
          </div>
        </div>

        {/* Measuring a duration */}
        <div className="bg-surface p-4">
          <p className="font-semibold text-sm">Measuring a {OP_MS} ms operation</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mt-0.5">what happens to the clock meanwhile</p>
          <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
            {(
              [
                ["none", "nothing"],
                ["back", "NTP steps back 100 ms"],
                ["forward", "jumps forward 1 s"],
              ] as [Jump, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={jump === k} onClick={() => setJump(k)} className={chip(jump === k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-px bg-line-soft border border-line-soft">
            <div className="bg-surface p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">time-of-day</p>
              <p className="font-mono text-[10px] text-ink-3">CLOCK_REALTIME</p>
              <p className={`font-dot text-3xl font-bold mt-1 ${todMeasured !== OP_MS ? "text-bad" : ""}`}>
                {todMeasured}
                <span className="text-ink-3 text-base"> ms</span>
              </p>
            </div>
            <div className="bg-surface p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">monotonic</p>
              <p className="font-mono text-[10px] text-ink-3">CLOCK_MONOTONIC</p>
              <p className="font-dot text-3xl font-bold mt-1 text-ok">
                {monoMeasured}
                <span className="text-ink-3 text-base"> ms</span>
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-ink-2 leading-relaxed">
            {jump === "none" && "Both agree while nothing touches the clock. Now let NTP correct it in the middle of the operation."}
            {jump === "back" && "A negative duration: the time-of-day clock was reset backwards by NTP. A timeout computed from it would never fire, or fire at once."}
            {jump === "forward" && "A 50 ms call measured as over a second: a leap second or a resumed VM. Every timeout based on this clock fires at once and a live node is declared dead."}
          </p>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Press NTP sync: a few milliseconds of residual error remain, because NTP cannot be more accurate than the
        network delay, and they are enough to misorder two writes a few milliseconds apart. For ordering you need
        logical clocks; physical clocks are for points in time, and even then only the monotonic one is safe for
        measuring durations.
      </p>
    </div>
  );
}
