"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Label, NEON } from "../primitives";

type NodeKey = "load" | "queue" | "rt" | "timeout" | "retry";

interface Step {
  active: NodeKey[];
  /** Show the countermeasure labels on the edges. */
  fixes?: boolean;
  /** Paint every node as failing. */
  meltdown?: boolean;
  text: string;
}

const STEPS: Step[] = [
  {
    active: ["load"],
    text: "A spike of requests arrives, more than the server can process per second.",
  },
  {
    active: ["load", "queue"],
    text: "Requests that cannot be served immediately wait in a queue behind the ones in progress.",
  },
  {
    active: ["queue", "rt"],
    text: "Waiting in the queue is part of the response time the client sees, so response time climbs.",
  },
  {
    active: ["rt", "timeout"],
    text: "Clients give up before the reply arrives. The server still processes the abandoned requests: wasted work.",
  },
  {
    active: ["timeout", "retry"],
    text: "Each timed-out client retries, adding its request to the load on top of the new arrivals.",
  },
  {
    active: ["load", "queue", "rt", "timeout", "retry"],
    meltdown: true,
    text: "The loop closes. Even when the external load returns to normal, the retries keep the queue full: a metastable failure that lasts until someone restarts the system.",
  },
  {
    active: [],
    fixes: true,
    text: "Breaking the loop: clients wait longer between retries (exponential backoff), stop calling a failing service (circuit breaker) or cap their rate (token bucket); the server rejects early (load shedding) or asks clients to slow down (backpressure).",
  },
];

const NODES: Record<NodeKey, { x: number; y: number; w: number; h: number; title: string; sub?: string }> = {
  load: { x: 40, y: 112, w: 150, h: 56, title: "High load", sub: "arrivals > capacity" },
  queue: { x: 240, y: 30, w: 130, h: 56, title: "Long queue", sub: "requests wait" },
  rt: { x: 430, y: 30, w: 150, h: 56, title: "High response time", sub: "queue + service" },
  timeout: { x: 600, y: 112, w: 140, h: 56, title: "Client timeouts", sub: "gives up early" },
  retry: { x: 430, y: 200, w: 130, h: 56, title: "Retry", sub: "adds to the load" },
};

/**
 * The retry-storm loop as a step-by-step walkthrough. Each step lights
 * up the edge that is firing; the last two steps show the loop closing
 * into a metastable failure and where the countermeasures cut it.
 */
export function RetryStorm() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const isOn = (k: NodeKey) => step.active.includes(k);
  const edge = (a: NodeKey, b: NodeKey): EdgeState =>
    step.meltdown ? "bad" : isOn(a) && isOn(b) ? "bad" : step.fixes ? "soft" : "ink";
  const btn = "border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-ink hover:text-surface disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink";

  return (
    <Figure
      label="FIG 03"
      title={step.fixes ? "where the loop can be broken" : step.meltdown ? "metastable failure" : "the retry storm loop"}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2">
            <button type="button" className={btn} onClick={() => setI((s) => Math.max(0, s - 1))} disabled={i === 0}>
              Prev
            </button>
            <span className="font-dot text-sm font-bold w-12 text-center">
              {i + 1}/{STEPS.length}
            </span>
            <button
              type="button"
              className={btn}
              onClick={() => setI((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={i === STEPS.length - 1}
            >
              Next
            </button>
          </span>
          <span>{step.text}</span>
        </div>
      }
    >
      <Canvas w={780} h={290}>
        <BadDefs />
        {(Object.keys(NODES) as NodeKey[]).map((k) => {
          const n = NODES[k];
          const on = step.meltdown || isOn(k);
          const accent = on ? "var(--bad)" : k === "retry" ? NEON.magenta : undefined;
          return <Box key={k} x={n.x} y={n.y} w={n.w} h={n.h} title={n.title} sub={n.sub} accent={accent} titleSize={12} />;
        })}

        {/* load -> queue */}
        <LoopArrow pts={[115, 112, 115, 58, 240, 58]} state={edge("load", "queue")} />
        {/* queue -> response time */}
        <LoopArrow pts={[370, 58, 430, 58]} state={edge("queue", "rt")} />
        {/* response time -> timeouts */}
        <LoopArrow pts={[580, 58, 670, 58, 670, 112]} state={edge("rt", "timeout")} />
        {/* timeouts -> retry */}
        <LoopArrow pts={[670, 168, 670, 228, 560, 228]} state={edge("timeout", "retry")} />
        {/* retry -> load */}
        <LoopArrow pts={[430, 228, 115, 228, 115, 168]} state={edge("retry", "load")} />

        {step.fixes && (
          <>
            <line x1={105} y1={90} x2={125} y2={90} stroke="var(--ok)" strokeWidth={2.5} />
            <Label x={130} y={98} lines={["server · load shedding", "reject before collapse"]} size={10} mono color="var(--ok)" anchor="start" />
            <line x1={660} y1={90} x2={680} y2={90} stroke="var(--ok)" strokeWidth={2.5} />
            <Label x={656} y={98} lines={["server · backpressure", "ask clients to slow down"]} size={10} mono color="var(--ok)" anchor="end" />
            <line x1={250} y1={218} x2={250} y2={238} stroke="var(--ok)" strokeWidth={2.5} />
            <Label x={250} y={258} lines={"client · exponential backoff · circuit breaker · token bucket"} size={10} mono color="var(--ok)" />
          </>
        )}

        {step.meltdown && (
          <Label x={300} y={150} lines={"external load back to normal,\nretries keep the queue full"} size={11} mono color="var(--bad)" />
        )}
      </Canvas>
    </Figure>
  );
}

type EdgeState = "bad" | "ink" | "soft";

/**
 * Arrow of the loop. A firing edge is drawn thick in the "bad" status
 * colour, which the shared `Arrow` cannot do, so it gets its own marker.
 */
function LoopArrow({ pts, state }: { pts: number[]; state: EdgeState }) {
  if (state !== "bad") return <Arrow pts={pts} color={state} />;
  const d = pts.reduce((acc, v, i) => (i % 2 === 0 ? `${acc}${i === 0 ? "M" : "L"}${v} ` : `${acc}${v} `), "").trim();
  return <path d={d} fill="none" stroke="var(--bad)" strokeWidth={2.5} markerEnd="url(#arrow-bad)" />;
}

/** Arrowhead in the "bad" status colour, defined once per canvas. */
function BadDefs() {
  return (
    <defs>
      <marker id="arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--bad)" />
      </marker>
    </defs>
  );
}
