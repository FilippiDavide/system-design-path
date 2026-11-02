"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Label, NEON } from "../primitives";

interface Cause {
  key: string;
  title: string;
  /** Where on the wire the failure happens, for the marker. */
  at: "request" | "node" | "response";
  color: string;
  colorName: "orange" | "magenta" | "violet" | "blue" | "green";
  mark: string;
  why: string;
}

const CAUSES: Cause[] = [
  {
    key: "lost-req",
    title: "Request lost",
    at: "request",
    color: NEON.orange,
    colorName: "orange",
    mark: "dropped by a full switch queue",
    why: "The request never reached the node, so nothing was executed. Retrying is safe here, but the client cannot know it is in this case.",
  },
  {
    key: "down",
    title: "Node down",
    at: "node",
    color: NEON.magenta,
    colorName: "magenta",
    mark: "crashed, or the power went",
    why: "The node received nothing, or received it and died before replying. Maybe a TCP RST would tell you, but only if the machine is still up.",
  },
  {
    key: "paused",
    title: "Node paused",
    at: "node",
    color: NEON.violet,
    colorName: "violet",
    mark: "GC, VM suspend, swap",
    why: "The node is alive and will handle the request later: it is stopped by a garbage collection, a VM migration or a page fault. It will reply after you have given up.",
  },
  {
    key: "lost-resp",
    title: "Response lost",
    at: "response",
    color: NEON.blue,
    colorName: "blue",
    mark: "executed, reply dropped",
    why: "The request was executed. The reply was dropped on the way back, so the client believes nothing happened. A retry executes it twice.",
  },
  {
    key: "delayed",
    title: "Response delayed",
    at: "response",
    color: NEON.green,
    colorName: "green",
    mark: "queued behind others",
    why: "The request was executed and the reply is on its way, sitting in a queue. It will arrive after the timeout, when the client has already decided it failed.",
  },
];

/**
 * The five meanings of "no response". The wire is drawn once; tapping
 * a cause puts a marker where the failure actually happened, and the
 * point is that the client's view (the diamond) never changes.
 */
export function NoResponse() {
  const [active, setActive] = useState<string | null>(null);
  const cause = CAUSES.find((c) => c.key === active);

  const markerPos = (c: Cause): [number, number] =>
    c.at === "request" ? [330, 64] : c.at === "node" ? [690, 72] : c.at === "response" && c.key === "delayed" ? [260, 90] : [470, 90];

  return (
    <Figure
      label="FIG 02"
      title="what no response can mean"
      caption={
        cause ? (
          <span>
            <strong>{cause.title}</strong> · {cause.why}
          </span>
        ) : (
          "Tap a cause. Five different things happened on the wire, and from the client's side all five look exactly the same: silence until the timeout."
        )
      }
    >
      <Canvas w={780} h={330}>
        <Box x={30} y={36} w={120} h={56} title="Client" sub="sees: nothing" />
        <Box
          x={630}
          y={36}
          w={120}
          h={56}
          title="Node"
          sub={cause?.at === "node" ? (cause.key === "down" ? "dead" : "paused") : "alive?"}
          accent={cause?.at === "node" ? cause.color : undefined}
        />

        {/* The wire */}
        <Arrow pts={[150, 64, 630, 64]} label="request" labelOffset={-10} color={cause?.at === "request" ? cause.colorName : "ink"} />
        <Arrow pts={[630, 90, 150, 90]} dashed color={cause?.at === "response" ? cause.colorName : "soft"} label="response?" labelOffset={14} />

        {/* Failure marker on the wire */}
        {cause && (
          <g>
            {cause.at === "node" ? (
              cause.key === "down" ? (
                <>
                  <line x1={640} y1={44} x2={740} y2={84} stroke={cause.color} strokeWidth={2} />
                  <line x1={740} y1={44} x2={640} y2={84} stroke={cause.color} strokeWidth={2} />
                </>
              ) : (
                <Label x={735} y={28} lines="z z z" size={11} mono color={cause.color} />
              )
            ) : (
              <>
                <circle cx={markerPos(cause)[0]} cy={markerPos(cause)[1]} r={7} fill="#fff" stroke={cause.color} strokeWidth={2} />
                {cause.key !== "delayed" && (
                  <>
                    <line x1={markerPos(cause)[0] - 4} y1={markerPos(cause)[1] - 4} x2={markerPos(cause)[0] + 4} y2={markerPos(cause)[1] + 4} stroke={cause.color} strokeWidth={2} />
                    <line x1={markerPos(cause)[0] + 4} y1={markerPos(cause)[1] - 4} x2={markerPos(cause)[0] - 4} y2={markerPos(cause)[1] + 4} stroke={cause.color} strokeWidth={2} />
                  </>
                )}
                {cause.key === "delayed" && <circle cx={markerPos(cause)[0]} cy={markerPos(cause)[1]} r={3} fill={cause.color} />}
              </>
            )}
            <Label
              x={cause.at === "node" ? 690 : markerPos(cause)[0]}
              y={cause.at === "node" ? 108 : cause.at === "request" ? 40 : 112}
              lines={cause.mark}
              size={10}
              mono
              color={cause.color}
            />
          </g>
        )}

        {/* What the client concludes */}
        <Arrow pts={[90, 92, 90, 130, 390, 130, 390, 136]} color="soft" dashed label="timeout fires" labelOffset={-8} />
        <polygon points="390,136 520,170 390,204 260,170" fill="#fff" stroke="var(--bad)" strokeWidth={2} />
        <Label x={390} y={170} lines={"No response\nafter the timeout"} size={12} weight={600} />

        {/* Fan-out to the five causes */}
        {CAUSES.map((c, i) => {
          const x = 30 + i * 150;
          const cx = x + 65;
          const isActive = active === c.key;
          return (
            <g key={c.key} onClick={() => setActive(isActive ? null : c.key)} style={{ cursor: "pointer" }}>
              <Arrow pts={[390, 204, 390, 226, cx, 226, cx, 252]} color={isActive ? c.colorName : "ink"} />
              <Box x={x} y={252} w={130} h={44} title={c.title} titleSize={12} accent={isActive ? c.color : undefined} />
            </g>
          );
        })}
        <Label x={390} y={316} lines="indistinguishable from the client: the only fact is “no response yet”" size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}
