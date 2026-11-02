"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Label, NEON } from "../primitives";

type Mode = "backward" | "forward" | "trap";

const MODES: { key: Mode; label: string; title: string; text: string }[] = [
  {
    key: "backward",
    label: "Backward",
    title: "backward: new code reads old data",
    text: "New code reads data written by old code. The easy direction: the old format is known, so the new code handles it explicitly (a missing field gets its default).",
  },
  {
    key: "forward",
    label: "Forward",
    title: "forward: old code reads new data",
    text: "Old code reads data written by new code. Harder: the old code must ignore what it does not know about without breaking.",
  },
  {
    key: "trap",
    label: "The trap",
    title: "forward: read, modify, write back",
    text: "Old code reads the new record, changes one field and writes it back. If its in-memory model dropped the unknown field, that field silently disappears from the database. Unknown fields must be preserved, not discarded.",
  },
];

/**
 * The two directions of compatibility, as two rows: who writes, who
 * reads. The third mode adds the write-back arrow that turns a
 * harmless forward read into data loss.
 */
export function Compatibility() {
  const [mode, setMode] = useState<Mode>("backward");
  const m = MODES.find((x) => x.key === mode) ?? MODES[0];
  const rowA = mode === "backward";
  const dim = (on: boolean) => (on ? 1 : 0.3);

  return (
    <Figure
      label="FIG 02"
      title={m.title}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {MODES.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setMode(x.key)}
                aria-pressed={mode === x.key}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  mode === x.key ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {x.label}
              </button>
            ))}
          </span>
          <span>{m.text}</span>
        </div>
      }
    >
      <Canvas w={760} h={mode === "trap" ? 330 : 260}>
        {/* Row A: backward compatibility */}
        <g opacity={dim(rowA)}>
          <Box x={40} y={40} w={120} h={60} title="Old code" sub="v1" />
          <Arrow pts={[160, 70, 250, 70]} label="writes" color={rowA ? "blue" : "ink"} />
          <Cylinder x={250} y={36} w={110} h={68} title="Data" sub="old format" />
          <Arrow pts={[360, 70, 450, 70]} label="reads" color={rowA ? "blue" : "ink"} />
          <Box x={450} y={40} w={120} h={60} title="New code" sub="v2" />
          <Arrow pts={[570, 70, 600, 70]} noHead dashed color="soft" />
          <Box x={600} y={40} w={140} h={60} title="Backward" sub="new reads old" accent={NEON.blue} titleSize={12} />
        </g>

        {/* Row B: forward compatibility */}
        <g opacity={dim(!rowA)}>
          <Box x={40} y={170} w={120} h={60} title="New code" sub="v2" />
          <Arrow pts={[160, 200, 250, 200]} label="writes" color={rowA ? "ink" : "magenta"} />
          <Cylinder x={250} y={166} w={110} h={68} title="Data" sub="+ new field" />
          <Arrow pts={[360, 200, 450, 200]} label="reads" color={rowA ? "ink" : "magenta"} />
          <Box x={450} y={170} w={120} h={60} title="Old code" sub="v1" />
          <Arrow pts={[570, 200, 600, 200]} noHead dashed color="soft" />
          <Box x={600} y={170} w={140} h={60} title="Forward" sub="old reads new" accent={NEON.magenta} titleSize={12} />
        </g>

        {mode === "trap" && (
          <g>
            <Arrow pts={[510, 230, 510, 285, 305, 285, 305, 236]} color="orange" label="modifies, writes back" labelOffset={14} />
            <Label
              x={407}
              y={318}
              lines="the new field is gone unless the old code kept the unknown bytes"
              size={10}
              mono
              color="var(--bad)"
            />
          </g>
        )}
      </Canvas>
    </Figure>
  );
}
