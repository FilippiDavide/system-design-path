"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Group, Label, NEON, INK, INK2, MONO } from "../primitives";

type Who = "A" | "B" | null;

const X0 = 190; // left edge of the first cell
const CW = 36; // cell width
const CH = 40; // cell height
const MAX = 7; // cells that fit before the consumers
const ROW = [70, 200]; // y of partition 0 and partition 1

/** Fixed read positions of the two consumers, per partition. */
const OFFSETS: Record<"A" | "B", [number, number]> = { A: [3, 1], B: [4, 4] };

/**
 * Log-based broker: two producers append to two partitions, two
 * consumers read each partition sequentially from their own offset.
 * Tap a consumer to highlight the messages it has already consumed;
 * append to a partition to see that the offsets do not move and the lag
 * grows, while nothing is ever deleted.
 */
export function LogBasedBroker() {
  const [who, setWho] = useState<Who>(null);
  const [len, setLen] = useState<[number, number]>([5, 4]);

  const append = (p: 0 | 1) =>
    setLen((l) => (l[p] >= MAX ? l : (l.map((v, i) => (i === p ? v + 1 : v)) as [number, number])));

  const lag = (c: "A" | "B", p: 0 | 1) => len[p] - OFFSETS[c][p];
  const colorOf = (c: "A" | "B") => (c === "A" ? NEON.blue : NEON.magenta);
  const arrowColor = (c: "A" | "B"): "blue" | "magenta" | "ink" | "soft" =>
    who === null ? "ink" : who === c ? (c === "A" ? "blue" : "magenta") : "soft";

  const sentence =
    who === "A"
      ? `Consumer A has read partition 0 up to offset 3 (${lag("A", 0)} behind the head) and partition 1 up to offset 1 (${lag("A", 1)} behind). The broker remembers just these two numbers, not an ack per message.`
      : who === "B"
        ? lag("B", 1) === 0
          ? "Consumer B is at offset 4 in partition 1: it has consumed everything and waits for the next append, like tail -f. Reading deletes nothing, so A will see the same messages later."
          : `Consumer B is at offset 4 in both partitions: it has fallen ${lag("B", 1)} behind on partition 1 since you appended. It will catch up by reading sequentially; the producer never waited for it.`
        : "Producers append at the end of a partition; each partition is an independent, totally ordered log with increasing offsets. Tap a consumer to see where it is reading.";

  return (
    <Figure
      label="FIG 02"
      title="log-based broker: partitions and offsets"
      caption={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex gap-px border border-line w-fit">
            {(["A", "B"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={who === c}
                onClick={() => setWho(who === c ? null : c)}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  who === c ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                Consumer {c}
              </button>
            ))}
          </span>
          <span className="flex gap-px border border-line-soft w-fit">
            {([0, 1] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => append(p)}
                disabled={len[p] >= MAX}
                className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
              >
                Append to P{p}
              </button>
            ))}
          </span>
          <span className="basis-full">{sentence}</span>
        </div>
      }
    >
      <Canvas w={780} h={300}>
        {/* Producers */}
        <Box x={20} y={ROW[0]} w={100} h={CH} title="Producer" />
        <Box x={20} y={ROW[1]} w={100} h={CH} title="Producer" />

        {([0, 1] as const).map((p) => {
          const y = ROW[p];
          const n = len[p];
          const endX = X0 + n * CW;
          return (
            <g key={p}>
              <Group x={175} y={y - 30} w={320} h={CH + 68} label={`partition ${p} · append-only log`} />
              <Arrow pts={[120, y + CH / 2, 150, y + CH / 2, 150, y - 14, endX + CW / 2, y - 14, endX + CW / 2, y - 1]} label="append at the end" labelOffset={-8} />
              {Array.from({ length: n }, (_, i) => {
                const consumed = who !== null && i < OFFSETS[who][p];
                return (
                  <g key={i}>
                    <rect
                      x={X0 + i * CW}
                      y={y}
                      width={CW}
                      height={CH}
                      fill={consumed ? "var(--surface-2)" : "#fff"}
                      stroke={INK}
                      strokeWidth={1.5}
                    />
                    <Label x={X0 + i * CW + CW / 2} y={y + CH / 2} lines={String(i)} size={12} mono weight={600} />
                  </g>
                );
              })}
              {/* the next slot, where the producer will append */}
              <rect x={endX} y={y} width={CW} height={CH} fill="none" stroke={INK2} strokeWidth={1} strokeDasharray="3 3" />
              <Label x={endX + CW / 2} y={y + CH / 2} lines="…" size={12} mono color={INK2} />
              <Label x={X0} y={y + CH + 10} lines="offset" size={9} mono color={INK2} anchor="start" />

              {/* consumer markers: offset = next message to read */}
              {(["A", "B"] as const).map((c, k) => {
                const off = OFFSETS[c][p];
                const mx = X0 + off * CW;
                const my = y + CH + 16 + k * 14;
                const dim = who !== null && who !== c;
                const col = dim ? INK2 : colorOf(c);
                return (
                  <g key={c} style={{ cursor: "pointer" }} onClick={() => setWho(who === c ? null : c)}>
                    <path d={`M${mx} ${y + CH + 2} l-5 8 h10 z`} fill={col} />
                    <text x={mx + 8} y={my + 4} fontFamily={MONO} fontSize={10} fill={col}>
                      {c} @ {off}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Partition -> consumer arrows */}
        <Arrow pts={[495, 82, 620, 82]} color={arrowColor("A")} />
        <Arrow pts={[495, 98, 530, 98, 530, 206, 620, 206]} color={arrowColor("B")} />
        <Arrow pts={[495, 212, 580, 212, 580, 104, 620, 104]} color={arrowColor("A")} />
        <Arrow pts={[495, 228, 620, 228]} color={arrowColor("B")} />

        {/* Consumers */}
        {(["A", "B"] as const).map((c, k) => (
          <g key={c} style={{ cursor: "pointer" }} onClick={() => setWho(who === c ? null : c)}>
            <Box
              x={620}
              y={k === 0 ? 62 : 192}
              w={140}
              h={50}
              title={`Consumer ${c}`}
              sub={`P0 @${OFFSETS[c][0]} · P1 @${OFFSETS[c][1]}`}
              accent={who === c ? colorOf(c) : undefined}
            />
          </g>
        ))}
        <Label x={690} y={150} lines={"reads sequentially\nthen waits, like tail -f"} size={10} mono color={INK2} />
      </Canvas>
    </Figure>
  );
}
