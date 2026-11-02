"use client";

import { useState } from "react";
import { Arrow, Box, Canvas, INK, INK2, Label, NEON } from "@/components/diagrams/primitives";

interface Proxy {
  id: string;
  name: string;
  /** What the automated decision is about. */
  decision: string;
  /** Initial measurement bias on group B (observed = actual × (1 + bias)). */
  bias: number;
  /** How strongly a "no" raises next round's observed proxy. */
  fb: number;
  /** Why the data starts out biased. */
  origin: string;
  /** Texts for the four loop nodes. */
  data: string;
  model: string;
  no: string;
  consequence: string;
  /** Why the learned rule cannot be explained. */
  explain: string;
}

const PROXIES: Proxy[] = [
  {
    id: "arrests",
    name: "Past arrests",
    decision: "bail and patrol allocation",
    bias: 1.0,
    fb: 0.06,
    origin:
      "Group B's neighbourhood is patrolled twice as much, so for the same behaviour twice as many arrests are recorded.",
    data: "recorded\narrests",
    model: "similar people\nreoffended",
    no: "deny bail,\nsend patrols",
    consequence: "more patrols,\nmore recorded",
    explain: "The rule was inferred from arrest records, which measure policing as much as behaviour.",
  },
  {
    id: "postcode",
    name: "Postcode",
    decision: "loans and tenancy",
    bias: 0.5,
    fb: 0.08,
    origin:
      "Neighbourhoods are segregated, so the postcode predicts race and class; past outcomes in postcode Z were recorded during years of exclusion.",
    data: "outcomes by\npostcode",
    model: "people from Z\ndefaulted",
    no: "no loan,\nno lease",
    consequence: "exclusion,\nmore defaults in Z",
    explain: "No protected trait is an input, yet the postcode stands in for it: the learned pattern is a stereotype.",
  },
  {
    id: "credit",
    name: "Credit history",
    decision: "hiring",
    bias: 0.2,
    fb: 0.1,
    origin: "Group B has thinner files and one more misfortune on record, so its scores start slightly lower.",
    data: "payment\nhistory",
    model: "score below\nthe cutoff",
    no: "no job,\nno credit",
    consequence: "no income,\nmissed payments",
    explain: "The score answered \"how did you behave\"; using it for hiring turns a missed payment into the cause of the next one.",
  },
];

/** Actual rate of the predicted outcome, identical in both groups. */
const ACTUAL = 0.1;
/** Spread of individual proxy values around the group's observed rate. */
const SPREAD = 0.1;
const MAX_ROUNDS = 6;

interface Round {
  oA: number;
  oB: number;
  fA: number;
  fB: number;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Deterministic feedback loop. Each round the model labels as risky every
 * member whose proxy value is above the cutoff; the "no" they receive
 * raises the group's observed proxy for the next round. With recourse,
 * wrong decisions are reversed and only the actual rate feeds back.
 */
function simulate(p: Proxy, cutoff: number, recourse: boolean, rounds: number): Round[] {
  const out: Round[] = [];
  let oA = ACTUAL;
  let oB = ACTUAL * (1 + p.bias);
  for (let n = 0; n <= rounds; n++) {
    const fA = clamp((oA + SPREAD - cutoff) / (2 * SPREAD));
    const fB = clamp((oB + SPREAD - cutoff) / (2 * SPREAD));
    out.push({ oA, oB, fA, fB });
    oA = ACTUAL + p.fb * (recourse ? ACTUAL : fA);
    oB = ACTUAL * (1 + p.bias) + p.fb * (recourse ? ACTUAL : fB);
  }
  return out;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Predictive-system feedback-loop explorer. Pick the proxy variable the
 * automated decision is based on and advance the rounds: the share of
 * each group labelled "risky" drifts away from the actual rate, which
 * never changes.
 */
export function FeedbackLoopLab() {
  const [proxyId, setProxyId] = useState("arrests");
  const [round, setRound] = useState(0);
  const [cutoff, setCutoff] = useState(15);
  const [recourse, setRecourse] = useState(false);

  const proxy = PROXIES.find((p) => p.id === proxyId) ?? PROXIES[0];
  const series = simulate(proxy, cutoff / 100, recourse, round);
  const now = series[round];

  // Chart geometry.
  const x0 = 56;
  const groupW = 50;
  const barW = 18;
  const yBase = 248;
  const yTop = 58;
  const yOf = (v: number) => yBase - v * (yBase - yTop);
  const yActual = yOf(ACTUAL);

  const pick = (id: string) => {
    setProxyId(id);
    setRound(0);
  };

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line-soft">
          {PROXIES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              aria-pressed={p.id === proxyId}
              className={`px-3 py-1.5 ${p.id === proxyId ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {p.name}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => setRound((r) => Math.min(MAX_ROUNDS, r + 1))}
          disabled={round >= MAX_ROUNDS}
          className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface disabled:opacity-40"
        >
          Next round
        </button>
        <label className="flex items-center gap-2">
          cutoff
          <input
            type="range"
            min={10}
            max={30}
            step={5}
            value={cutoff}
            onChange={(e) => setCutoff(Number(e.target.value))}
            className="w-24 accent-black"
          />
          <span className="font-dot text-sm w-10">{cutoff}%</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={recourse} onChange={(e) => setRecourse(e.target.checked)} className="accent-black" />
          appeal and correction
        </label>
        <button type="button" onClick={() => setRound(0)} className="ml-auto underline underline-offset-4 text-ink-2 hover:text-ink">
          reset
        </button>
      </div>

      <div className="p-3 sm:p-5 bg-grid overflow-x-auto">
        <Canvas w={780} h={300} minWidth={620} aria-label="Share of each group labelled risky per round, and the loop that produces it">
          {/* Chart */}
          <Label x={x0} y={30} lines="labelled risky" size={10} mono upper anchor="start" color={INK2} />
          <rect x={x0 + 122} y={25} width={10} height={10} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
          <Label x={x0 + 136} y={30} lines="group A" size={10} mono anchor="start" />
          <rect x={x0 + 196} y={25} width={10} height={10} fill={NEON.magenta} />
          <Label x={x0 + 210} y={30} lines="group B" size={10} mono anchor="start" />
          <line x1={x0 + 270} y1={30} x2={x0 + 290} y2={30} stroke="var(--ok)" strokeWidth={1.5} strokeDasharray="4 3" />
          <Label x={x0 + 296} y={30} lines="actual rate, both" size={10} mono anchor="start" />

          <line x1={x0 - 8} y1={yTop} x2={x0 - 8} y2={yBase} stroke="var(--ink)" strokeWidth={1} />
          <line x1={x0 - 8} y1={yBase} x2={x0 + groupW * (MAX_ROUNDS + 1)} y2={yBase} stroke="var(--ink)" strokeWidth={1} />
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={x0 - 12} y1={yOf(t)} x2={x0 - 8} y2={yOf(t)} stroke="var(--ink)" strokeWidth={1} />
              <Label x={x0 - 16} y={yOf(t)} lines={pct(t)} size={10} mono anchor="end" color={INK2} />
            </g>
          ))}
          <line
            x1={x0 - 8}
            y1={yActual}
            x2={x0 + groupW * (MAX_ROUNDS + 1)}
            y2={yActual}
            stroke="var(--ok)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {Array.from({ length: MAX_ROUNDS + 1 }, (_, i) => {
            const gx = x0 + i * groupW;
            const r = series[i];
            return (
              <g key={i}>
                <Label x={gx + barW + 1} y={yBase + 14} lines={String(i)} size={10} mono color={i === round ? INK : INK2} />
                {r && (
                  <>
                    <rect x={gx} y={yOf(r.fA)} width={barW} height={yBase - yOf(r.fA)} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
                    <rect x={gx + barW + 4} y={yOf(r.fB)} width={barW} height={yBase - yOf(r.fB)} fill={NEON.magenta} />
                  </>
                )}
              </g>
            );
          })}
          <Label x={x0 + (groupW * (MAX_ROUNDS + 1)) / 2} y={yBase + 32} lines="round" size={10} mono upper color={INK2} />

          {/* Loop */}
          <Label x={595} y={30} lines={`the loop · round ${round}`} size={10} mono upper color={INK2} />
          <Box x={440} y={48} w={130} h={58} title="Data" sub={proxy.data} titleSize={12} />
          <Box x={620} y={48} w={130} h={58} title="Model" sub={proxy.model} titleSize={12} accent={NEON.violet} />
          <Box x={620} y={190} w={130} h={58} title="Decision: no" sub={proxy.no} titleSize={12} accent={NEON.magenta} />
          <Box x={440} y={190} w={130} h={58} title="Consequence" sub={proxy.consequence} titleSize={12} />
          <Arrow pts={[570, 77, 620, 77]} label="learn" labelOffset={-8} />
          <Arrow pts={[685, 106, 685, 190]} />
          <Label x={695} y={148} lines="predict" size={10} mono anchor="start" color={INK2} />
          <Arrow pts={[620, 219, 570, 219]} />
          {recourse ? (
            <>
              <Arrow pts={[505, 190, 505, 106]} dashed color="soft" />
              <Label x={515} y={148} lines={["appeal: wrong", "\"no\" reversed"]} size={10} mono anchor="start" color={INK2} />
            </>
          ) : (
            <>
              <Arrow pts={[505, 190, 505, 106]} color="magenta" width={2} />
              <Label x={515} y={148} lines="next round" size={10} mono anchor="start" color={NEON.magenta} />
            </>
          )}
        </Canvas>
      </div>

      <div className="grid grid-cols-3 gap-px bg-line-soft border-t border-line-soft">
        <Stat label="group A labelled risky" value={pct(now.fA)} />
        <Stat label="group B labelled risky" value={pct(now.fB)} accent={now.fB > now.fA + 0.005} />
        <Stat label="actual rate, both groups" value={pct(ACTUAL)} />
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line-soft border-t border-line-soft">
        <div className="bg-surface p-4 text-[12px] leading-relaxed">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">What the model asks</p>
          <p>
            Decision: <span className="font-semibold">{proxy.decision}</span>. The model does not ask &quot;how did you
            behave&quot; but &quot;who is similar to you, and how did they behave&quot;: every member of a group gets the
            group&apos;s observed rate as their prediction.
          </p>
          <p className="mt-2 text-ink-2">{proxy.origin}</p>
          <p className="mt-2 text-ink-2">
            Cutoff {cutoff}%: anyone predicted above it gets a &quot;no&quot;. A missed opportunity costs the organisation
            little, a bad decision a lot, so the cutoff sits low: if in doubt, say no.
          </p>
        </div>
        <div className="bg-surface p-4 text-[12px] leading-relaxed">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-2">Responsibility and accountability</p>
          <dl className="space-y-2">
            <div>
              <dt className="font-semibold">Who answers for a wrong &quot;no&quot;?</dt>
              <dd className="text-ink-2">
                The organisation that deploys the model. Nobody can evade responsibility by blaming an algorithm.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Can the person appeal?</dt>
              <dd className="text-ink-2">
                {recourse
                  ? "Yes: the wrong decision is reversed and does not become next round's data. The bias in the data is still there, but it no longer compounds."
                  : "Almost no recourse: whoever lands in the wrong bucket, or is judged on erroneous data, cannot contest it. Every \"no\" becomes a fact in next round's data."}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Can the decision be explained to a judge?</dt>
              <dd className="text-ink-2">{proxy.explain}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        The actual rate never moves, yet the share labelled risky grows every round, and faster for the group whose
        data started out biased: the model extrapolates from a past its own decisions are writing. This is the
        self-reinforcing loop the chapter describes, and &quot;money laundering for bias&quot;: biased input, output
        presented as mathematical rigor. Systems thinking means looking at the whole ring, people included, before
        asking whether the system amplifies existing differences.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface p-3 sm:p-4 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 leading-tight">{label}</p>
      <p className={`font-dot text-2xl sm:text-3xl font-bold mt-1 ${accent ? "text-neon-2" : ""}`}>{value}</p>
    </div>
  );
}
