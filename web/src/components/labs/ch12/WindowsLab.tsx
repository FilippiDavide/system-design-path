"use client";

import { useState } from "react";
import { Canvas, Label, INK, INK2, MONO } from "@/components/diagrams/primitives";

type Kind = "tumbling" | "hopping" | "sliding" | "session";
type Policy = "ignore" | "correct";

interface Ev {
  id: number;
  /** Event time: when it happened, by the producer's clock. */
  et: number;
  /** Processing time: when the processor saw it. */
  pt: number;
  /** Arrived after the watermark had passed its event time. */
  straggler: boolean;
  /** Straggler that the "ignore" policy threw away. */
  dropped: boolean;
}

interface Win {
  start: number;
  end: number;
  row: number;
  count: number;
  corrected: boolean;
}

const SPAN = 20; // window length in seconds
const HOP = 10;
const GAP = 15; // session inactivity gap
const LATENESS = 10; // watermark = now - LATENESS
const T_MAX = 130; // seconds visible on the axis
const X0 = 36;
const SX = (760 - X0 - 20) / T_MAX;
const x = (t: number) => X0 + t * SX;

/** Event-time windows of the chosen kind over the kept events. */
function windows(kind: Kind, evs: Ev[]): Win[] {
  const kept = evs.filter((e) => !e.dropped).sort((a, b) => a.et - b.et);
  const inside = (s: number, e: number) => kept.filter((v) => v.et >= s && v.et < e);
  const mk = (s: number, e: number, row: number): Win | null => {
    const members = inside(s, e);
    if (members.length === 0) return null;
    return { start: s, end: e, row, count: members.length, corrected: members.some((m) => m.straggler) };
  };
  const out: Win[] = [];
  if (kind === "tumbling") {
    for (let s = 0; s < T_MAX; s += SPAN) {
      const w = mk(s, s + SPAN, 0);
      if (w) out.push(w);
    }
  } else if (kind === "hopping") {
    for (let s = -HOP; s < T_MAX; s += HOP) {
      const w = mk(s, s + SPAN, ((s / HOP) % 2 + 2) % 2);
      if (w) out.push(w);
    }
  } else if (kind === "sliding") {
    kept.forEach((e, i) => {
      const w = mk(e.et - SPAN + 0.001, e.et + 0.001, i % 3);
      if (w) out.push(w);
    });
  } else {
    let cur: Ev[] = [];
    const flush = () => {
      if (cur.length === 0) return;
      const w = mk(cur[0].et, cur[cur.length - 1].et + GAP, 0);
      if (w) out.push(w);
      cur = [];
    };
    kept.forEach((e) => {
      if (cur.length > 0 && e.et - cur[cur.length - 1].et > GAP) flush();
      cur.push(e);
    });
    flush();
  }
  return out;
}

/**
 * Event time versus processing time. The reader pushes events into a
 * processor whose clock only moves forward; late events land in the
 * window of their event time, not of their arrival, unless the
 * watermark has already closed it. A replayed backlog shows the false
 * spike that a processing-time window produces.
 */
export function WindowsLab() {
  const [kind, setKind] = useState<Kind>("tumbling");
  const [policy, setPolicy] = useState<Policy>("ignore");
  const [lag, setLag] = useState(25);
  const [now, setNow] = useState(0);
  const [evs, setEvs] = useState<Ev[]>([]);
  const [note, setNote] = useState("Push events. The processing clock advances a few seconds on every arrival.");

  const watermark = Math.max(0, now - LATENESS);
  const full = now >= T_MAX - 8;

  const push = (items: { et: number; pt: number }[], nextNow: number) => {
    const wm = Math.max(0, nextNow - LATENESS);
    let dropped = 0;
    let corrected = 0;
    const added = items.map((it, i) => {
      const straggler = it.et < wm;
      const drop = straggler && policy === "ignore";
      if (drop) dropped += 1;
      else if (straggler) corrected += 1;
      return { id: evs.length + i + 1, et: Math.max(0, it.et), pt: it.pt, straggler, dropped: drop };
    });
    setEvs([...evs, ...added]);
    setNow(nextNow);
    return { dropped, corrected };
  };

  const onTime = () => {
    const nextNow = now + 6;
    push([{ et: nextNow - 1, pt: nextNow }], nextNow);
    setNote(`Event ${evs.length + 1} happened at ${nextNow - 1} s and arrived at ${nextNow} s: event time and processing time almost agree, so either kind of window puts it in the same place.`);
  };

  const late = () => {
    const nextNow = now + 2;
    const et = nextNow - lag;
    const r = push([{ et, pt: nextNow }], nextNow);
    const wm = Math.max(0, nextNow - LATENESS);
    setNote(
      et < wm
        ? r.dropped
          ? `Event ${evs.length + 1} happened at ${Math.max(0, et)} s but arrived at ${nextNow} s, behind the watermark (${wm} s): its window was already closed, so it is dropped and counted as lost.`
          : `Event ${evs.length + 1} happened at ${Math.max(0, et)} s, behind the watermark (${wm} s): its window had already been published, so the processor emits a correction and retracts the old count.`
        : `Event ${evs.length + 1} happened at ${Math.max(0, et)} s and arrived ${lag} s later, still ahead of the watermark (${wm} s): its window is still open, it is simply counted where it belongs.`,
    );
  };

  const backlog = () => {
    const nextNow = now + 3;
    const items = [50, 40, 30, 20, 10].map((d) => ({ et: nextNow - d, pt: nextNow }));
    const r = push(items, nextNow);
    setNote(
      `The processor was down and now works through a backlog: five events spread over the last 50 s all arrive at ${nextNow} s. By processing time that is a spike of five in one window; by event time they fall where they happened${r.dropped > 0 ? `, except ${r.dropped} behind the watermark` : ""}.`,
    );
  };

  const reset = () => {
    setNow(0);
    setEvs([]);
    setNote("Push events. The processing clock advances a few seconds on every arrival.");
  };

  const wins = windows(kind, evs);
  const ptCounts: Record<number, number> = {};
  evs.forEach((e) => {
    const k = Math.floor(e.pt / SPAN);
    ptCounts[k] = (ptCounts[k] ?? 0) + 1;
  });
  const droppedN = evs.filter((e) => e.dropped).length;
  const correctedN = evs.filter((e) => e.straggler && !e.dropped).length;
  const maxPt = Math.max(0, ...Object.values(ptCounts));

  const btn = "px-3 py-1.5";
  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line w-fit">
          {(["tumbling", "hopping", "sliding", "session"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`${btn} ${kind === k ? "bg-ink text-surface" : "hover:bg-surface-2"}`}>
              {k}
            </button>
          ))}
        </span>
        <span className="flex gap-px border border-line-soft w-fit">
          {(["ignore", "correct"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={policy === p} onClick={() => setPolicy(p)} className={`${btn} ${policy === p ? "bg-ink text-surface" : "hover:bg-surface-2"}`}>
              late: {p}
            </button>
          ))}
        </span>
        <button type="button" onClick={reset} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink normal-case tracking-normal">
          reset
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={onTime} disabled={full} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40">
          Event
        </button>
        <button type="button" onClick={late} disabled={full} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Late event
        </button>
        <label className="flex items-center gap-2">
          delay
          <input type="range" min={10} max={60} step={5} value={lag} onChange={(e) => setLag(Number(e.target.value))} className="w-24 accent-black" aria-label="delay of the late event in seconds" />
          <span className="font-dot text-sm w-10">{lag} s</span>
        </label>
        <button type="button" onClick={backlog} disabled={full} className="border border-line-soft px-3 py-1.5 hover:border-ink disabled:opacity-40">
          Replay backlog
        </button>
        <span className="text-ink-2 normal-case tracking-normal">
          now <span className="font-dot text-sm text-ink">{now} s</span> · watermark <span className="font-dot text-sm text-ink">{watermark} s</span>
        </span>
      </div>

      <div className="p-3 bg-grid overflow-x-auto">
        <Canvas w={760} h={216} minWidth={600}>
          {/* event-time windows */}
          <Label x={X0} y={14} lines={`${kind} · ${kind === "session" ? `gap ${GAP} s` : kind === "hopping" ? `${SPAN} s every ${HOP} s` : `${SPAN} s`} · by event time`} size={10} mono upper color={INK2} anchor="start" />
          {wins.map((w, i) => {
            const closed = w.end <= watermark;
            const wx = x(Math.max(0, w.start));
            const ww = x(Math.min(T_MAX, w.end)) - wx;
            const wy = 26 + w.row * 18;
            const col = w.corrected ? "var(--neon-2)" : closed ? INK2 : INK;
            return (
              <g key={i}>
                <rect x={wx} y={wy} width={Math.max(2, ww)} height={14} fill={closed ? "var(--surface-2)" : "#fff"} stroke={col} strokeWidth={w.corrected ? 2 : 1.5} />
                <text x={wx + ww / 2} y={wy + 10.5} textAnchor="middle" fontFamily={MONO} fontSize={10} fontWeight={600} fill={col}>
                  {w.count}
                  {w.corrected ? "*" : ""}
                </text>
              </g>
            );
          })}

          {/* axis */}
          <line x1={X0} y1={110} x2={x(T_MAX)} y2={110} stroke={INK} strokeWidth={1.5} />
          {Array.from({ length: T_MAX / SPAN + 1 }, (_, i) => i * SPAN).map((t) => (
            <g key={t}>
              <line x1={x(t)} y1={106} x2={x(t)} y2={114} stroke={INK} strokeWidth={1} />
              <text x={x(t)} y={127} textAnchor="middle" fontFamily={MONO} fontSize={9} fill={INK2}>
                {t}s
              </text>
            </g>
          ))}

          {/* watermark and now */}
          {now > 0 && (
            <g>
              <line x1={x(watermark)} y1={22} x2={x(watermark)} y2={135} stroke="var(--neon-5)" strokeWidth={1.5} strokeDasharray="4 3" />
              <text x={x(watermark) + 3} y={142} fontFamily={MONO} fontSize={9} fill="var(--neon-5)">
                watermark
              </text>
              <line x1={x(now)} y1={22} x2={x(now)} y2={135} stroke={INK} strokeWidth={1} />
              <text x={x(now) + 3} y={142} fontFamily={MONO} fontSize={9} fill={INK}>
                now
              </text>
            </g>
          )}

          {/* events */}
          {evs.map((e) => {
            const lateLink = e.pt - e.et > 2;
            return (
              <g key={e.id}>
                {lateLink && (
                  <g>
                    <line x1={x(e.et)} y1={98} x2={x(e.pt)} y2={98} stroke={e.dropped ? "var(--bad)" : "var(--neon-5)"} strokeWidth={1} strokeDasharray="2 2" />
                    <circle cx={x(e.pt)} cy={98} r={2.5} fill="none" stroke={e.dropped ? "var(--bad)" : "var(--neon-5)"} strokeWidth={1} />
                  </g>
                )}
                <circle
                  cx={x(e.et)}
                  cy={110}
                  r={4}
                  fill={e.dropped ? "#fff" : e.straggler ? "var(--neon-2)" : lateLink ? "var(--neon-5)" : INK}
                  stroke={e.dropped ? "var(--bad)" : "none"}
                  strokeWidth={1.5}
                />
              </g>
            );
          })}

          {/* processing-time strip */}
          <Label x={X0} y={162} lines={`tumbling ${SPAN} s · by processing time`} size={10} mono upper color={INK2} anchor="start" />
          {Object.entries(ptCounts).map(([k, c]) => {
            const s = Number(k) * SPAN;
            const spike = maxPt >= 4 && c === maxPt;
            return (
              <g key={k}>
                <rect x={x(s)} y={172} width={x(Math.min(T_MAX, s + SPAN)) - x(s)} height={14} fill={spike ? "var(--neon-5)" : "#fff"} stroke={spike ? "var(--neon-5)" : INK} strokeWidth={1.5} />
                <text x={x(s + SPAN / 2)} y={182.5} textAnchor="middle" fontFamily={MONO} fontSize={10} fontWeight={600} fill={spike ? "#fff" : INK}>
                  {c}
                </text>
                {spike && (
                  <text x={Math.min(660, Math.max(100, x(s + SPAN / 2)))} y={199} textAnchor="middle" fontFamily={MONO} fontSize={9} fill="var(--neon-5)">
                    spike that never happened
                  </text>
                )}
              </g>
            );
          })}
          <line x1={X0} y1={210} x2={x(T_MAX)} y2={210} stroke={INK2} strokeWidth={1} />
        </Canvas>
      </div>

      <div className="grid grid-cols-3 gap-px bg-line-soft border-t border-line-soft">
        <Stat label="events" value={evs.length} />
        <Stat label="dropped stragglers" value={droppedN} bad={droppedN > 0} />
        <Stat label="corrections emitted" value={correctedN} />
      </div>
      <p className="px-3 py-2 text-[12px] border-t border-line-soft">{note}</p>
      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Dots sit at their event time; a dashed tail shows how much later the processor saw them. The watermark
        says &quot;no more events before this time&quot;: windows left of it are closed. A straggler behind it is either
        ignored (counted as lost, with an alert) or triggers a correction (window marked *). Switch window kinds to
        see how the same events are grouped, then replay a backlog to produce the spike that only exists by
        processing time.
      </p>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className={`font-dot text-2xl font-bold mt-1 ${bad ? "text-bad" : ""}`}>{value}</p>
    </div>
  );
}
