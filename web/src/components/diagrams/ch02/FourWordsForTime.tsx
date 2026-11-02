"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Canvas, INK, INK2, Label, NEON } from "../primitives";

/** Milliseconds for one network hop, one unit of service. */
const NET_MS = 15;
const SERVICE_MS = 20;

/**
 * The sequence diagram of one request, with a slider for how many
 * requests are already waiting on the server. Service time never
 * changes; the response time seen by the client does, which is why
 * you measure on the client side.
 */
export function FourWordsForTime() {
  const [ahead, setAhead] = useState(2);
  const queueMs = ahead * SERVICE_MS;
  const total = NET_MS * 2 + queueMs + SERVICE_MS;

  // Time runs downwards between y0 and y1; scale the segments to fit.
  const y0 = 90;
  const y1 = 292;
  const s = (y1 - y0) / total;
  const yReqEnd = y0 + NET_MS * s;
  const yQueueEnd = yReqEnd + queueMs * s;
  const yServiceEnd = yQueueEnd + SERVICE_MS * s;
  const cx = 210;
  const sx = 560;

  return (
    <Figure
      label="FIG 04"
      title="response time, service time, queueing delay, latency"
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
            requests ahead in the queue
            <input
              type="range"
              min={0}
              max={8}
              value={ahead}
              onChange={(e) => setAhead(Number(e.target.value))}
              className="w-28 accent-black"
              aria-label="Requests ahead in the server queue"
            />
            <span className="font-dot text-sm w-4">{ahead}</span>
          </label>
          <span>
            The server&rsquo;s own metric says <strong>{SERVICE_MS} ms</strong> whatever happens. The client waited{" "}
            <strong>{total} ms</strong>: {queueMs} ms of it was queueing delay, {NET_MS * 2} ms network latency.
            {ahead >= 4 && " A few slow requests in front are enough to hold everything behind them: head-of-line blocking."}
          </span>
        </div>
      }
    >
      <Canvas w={780} h={320}>
        {/* Lifelines */}
        <rect x={cx - 55} y={22} width={110} height={40} fill="#fff" stroke={INK} strokeWidth={1.5} />
        <Label x={cx} y={42} lines="Client" size={13} weight={600} />
        <rect x={sx - 55} y={22} width={110} height={40} fill="#fff" stroke={INK} strokeWidth={1.5} />
        <Label x={sx} y={42} lines="Server" size={13} weight={600} />
        <line x1={cx} y1={62} x2={cx} y2={y1 + 12} stroke={INK2} strokeDasharray="4 4" />
        <line x1={sx} y1={62} x2={sx} y2={y1 + 12} stroke={INK2} strokeDasharray="4 4" />

        {/* Request over the network */}
        <line x1={cx} y1={y0} x2={sx - 7} y2={yReqEnd} stroke={INK} strokeWidth={1.5} markerEnd="url(#arrow-ink)" />
        <Label x={(cx + sx) / 2} y={y0 - 12} lines="request · network latency" size={10} mono color={INK2} />

        {/* Queue on the server lifeline */}
        {ahead > 0 && (
          <>
            <rect x={sx - 14} y={yReqEnd} width={28} height={yQueueEnd - yReqEnd} fill="var(--surface-2)" stroke={NEON.orange} strokeWidth={1.5} strokeDasharray="4 3" />
            <Label
              x={sx + 24}
              y={(yReqEnd + yQueueEnd) / 2}
              lines={[`queueing delay · ${queueMs} ms`, `${ahead} request${ahead > 1 ? "s" : ""} ahead, one CPU`]}
              size={10}
              mono
              color={NEON.orange}
              anchor="start"
            />
          </>
        )}

        {/* Service time */}
        <rect x={sx - 14} y={yQueueEnd} width={28} height={yServiceEnd - yQueueEnd} fill="#fff" stroke={NEON.blue} strokeWidth={2} />
        <Label x={sx + 24} y={(yQueueEnd + yServiceEnd) / 2} lines={`service time · ${SERVICE_MS} ms`} size={10} mono color={NEON.blue} anchor="start" />

        {/* Response over the network */}
        <line x1={sx} y1={yServiceEnd} x2={cx + 7} y2={y1} stroke={INK} strokeWidth={1.5} markerEnd="url(#arrow-ink)" />
        <Label x={(cx + sx) / 2} y={y1 + 14} lines="response · network latency" size={10} mono color={INK2} />

        {/* Response time bracket on the client side */}
        <line x1={cx - 60} y1={y0} x2={cx - 60} y2={y1} stroke={NEON.magenta} strokeWidth={2} />
        <line x1={cx - 66} y1={y0} x2={cx - 54} y2={y0} stroke={NEON.magenta} strokeWidth={2} />
        <line x1={cx - 66} y1={y1} x2={cx - 54} y2={y1} stroke={NEON.magenta} strokeWidth={2} />
        <Label x={cx - 70} y={(y0 + y1) / 2} lines={["response time", `${total} ms`, "client side"]} size={10} mono color={NEON.magenta} anchor="end" />

        {/* Latency bracket: everything that is not service time */}
        <Label x={(cx + sx) / 2} y={(yReqEnd + yQueueEnd + 2) / 2 + 8} lines={"latency = time during which\nthe request is not being processed"} size={10} mono color={INK2} />
      </Canvas>
    </Figure>
  );
}
