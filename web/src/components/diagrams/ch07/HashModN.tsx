"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Label, NEON } from "../primitives";

const KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const CHOICES = [3, 4, 5] as const;

/**
 * Why `hash % N` is the wrong way to assign keys to nodes: ten hash
 * values, N nodes. Change N and watch how many keys change node.
 */
export function HashModN() {
  const [n, setN] = useState<number>(3);
  const [prev, setPrev] = useState<number | null>(null);

  const moved = prev === null ? [] : KEYS.filter((h) => h % prev !== h % n);
  const nodeX = (i: number) => 390 + (i - (n - 1) / 2) * 150;

  return (
    <Figure
      label="FIG 02"
      title={`hash % ${n}`}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === n}
                onClick={() => {
                  if (c === n) return;
                  setPrev(n);
                  setN(c);
                }}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  c === n ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {c} nodes
              </button>
            ))}
          </span>
          <span>
            {prev === null ? (
              "Each key goes to node hash % N. Add or remove a node and count how many keys have to move."
            ) : (
              <>
                {prev} → {n} nodes: <strong>{moved.length} of 10 keys</strong> change node. Only the keys whose
                remainder happens to stay the same are left in place; everything else is copied across the network.
              </>
            )}
          </span>
        </div>
      }
    >
      <Canvas w={780} h={290}>
        <Label x={20} y={30} lines="keys · hash value" size={10} mono upper color="var(--ink-2)" anchor="start" />
        {KEYS.map((h) => {
          const x = 60 + h * 73;
          const isMoved = moved.includes(h);
          const color = isMoved ? NEON.magenta : "var(--ink-2)";
          return (
            <g key={h}>
              <circle cx={x} cy={70} r={14} fill="#fff" stroke={isMoved ? NEON.magenta : "var(--ink)"} strokeWidth={1.5} />
              <Label x={x} y={70} lines={String(h)} size={12} weight={600} mono color={isMoved ? NEON.magenta : "var(--ink)"} />
              <line x1={x} y1={84} x2={nodeX(h % n)} y2={190} stroke={color} strokeWidth={isMoved ? 1.5 : 1} strokeDasharray={isMoved ? undefined : "3 3"} />
            </g>
          );
        })}

        {Array.from({ length: n }, (_, i) => {
          const keys = KEYS.filter((h) => h % n === i);
          const movedHere = keys.filter((h) => moved.includes(h)).length;
          return (
            <Box
              key={i}
              x={nodeX(i) - 60}
              y={190}
              w={120}
              h={64}
              title={`node ${i}`}
              sub={`keys ${keys.join(" ")}${movedHere ? `\n${movedHere} arrived` : ""}`}
              accent={movedHere ? NEON.magenta : undefined}
              titleSize={12}
            />
          );
        })}

        {prev !== null && (
          <>
            <Arrow pts={[20, 150, 20, 180]} color="magenta" noHead />
            <Label
              x={20}
              y={120}
              lines={`${prev} → ${n}\n${moved.length}/10 moved`}
              size={10}
              mono
              color={NEON.magenta}
              anchor="start"
            />
          </>
        )}
        {/* Legend carries the rule; a side label would collide with node 0 at five nodes. */}
        <Label x={390} y={276} lines={`node = hash % ${n} · dashed: stays · magenta: moved`} size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}
