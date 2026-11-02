"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Canvas, Group, Label, NEON } from "../primitives";

const COLS = ["date", "product", "store", "qty", "price", "…"];
const ROWS = [
  ["01-14", "31", "3", "2", "9.90", "…"],
  ["01-14", "68", "3", "1", "4.50", "…"],
  ["01-15", "31", "7", "5", "9.90", "…"],
  ["01-15", "69", "3", "1", "12.00", "…"],
];

const CELL_W = 68;
const CELL_H = 28;
const COL_X = 80;

/**
 * Row-oriented vs column-oriented layout of the same fact table. The
 * query "SUM(qty)" shows which bytes each layout has to read.
 */
export function RowVsColumn() {
  const [byColumn, setByColumn] = useState(false);
  const qtyIdx = COLS.indexOf("qty");

  return (
    <Figure
      label="FIG 04"
      title={byColumn ? "column-oriented: one file per column" : "row-oriented: one record after another"}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {(["By row", "By column"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setByColumn(m === "By column")}
                aria-pressed={(m === "By column") === byColumn}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  (m === "By column") === byColumn ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {m}
              </button>
            ))}
          </span>
          <span>
            {byColumn
              ? "Each column is its own file; the k-th value of every file belongs to row k, so rows are reassembled by position. SUM(qty) reads one file and nothing else."
              : "Each row is stored whole. A query that only needs qty still pulls every row off disk and throws away the other columns."}
          </span>
        </div>
      }
    >
      <Canvas w={780} h={290}>
        <Label x={20} y={30} lines="SELECT SUM(qty) FROM fact_sales" size={12} weight={600} mono anchor="start" />
        {byColumn ? (
          <>
            <Group x={60} y={70} w={COLS.length * (CELL_W + 14)} h={170} label="column files · same row order in each" />
            {COLS.map((c, ci) => {
              const x = COL_X + ci * (CELL_W + 14);
              const hot = ci === qtyIdx;
              return (
                <g key={c}>
                  <Label x={x + CELL_W / 2} y={88} lines={c} size={10} mono upper color={hot ? NEON.magenta : "var(--ink-2)"} />
                  <rect
                    x={x}
                    y={100}
                    width={CELL_W}
                    height={ROWS.length * CELL_H}
                    fill={hot ? "#fff" : "var(--surface-2)"}
                    stroke={hot ? NEON.magenta : "var(--ink)"}
                    strokeWidth={hot ? 2 : 1.5}
                  />
                  {ROWS.map((r, ri) => (
                    <g key={ri}>
                      {ri > 0 && <line x1={x} y1={100 + ri * CELL_H} x2={x + CELL_W} y2={100 + ri * CELL_H} stroke={hot ? NEON.magenta : "var(--ink)"} strokeWidth={0.75} />}
                      <Label x={x + CELL_W / 2} y={100 + ri * CELL_H + CELL_H / 2} lines={r[ci]} size={11} mono color={hot ? "var(--ink)" : "var(--ink-2)"} />
                    </g>
                  ))}
                </g>
              );
            })}
            {ROWS.map((_, ri) => (
              <Label key={ri} x={66} y={100 + ri * CELL_H + CELL_H / 2} lines={`r${ri + 1}`} size={10} mono color="var(--ink-2)" anchor="end" />
            ))}
            <Label x={400} y={262} lines={"bytes read: 1 of 6 files (16%) · the qty file is read sequentially"} size={11} mono color={NEON.magenta} />
          </>
        ) : (
          <>
            <Group x={60} y={70} w={COLS.length * CELL_W + 40} h={170} label="one file · records back to back" />
            {COLS.map((c, ci) => (
              <Label key={c} x={COL_X + ci * CELL_W + CELL_W / 2} y={88} lines={c} size={10} mono upper color={ci === qtyIdx ? NEON.magenta : "var(--ink-2)"} />
            ))}
            {ROWS.map((r, ri) => {
              const y = 100 + ri * (CELL_H + 6);
              return (
                <g key={ri}>
                  <Label x={66} y={y + CELL_H / 2} lines={`r${ri + 1}`} size={10} mono color="var(--ink-2)" anchor="end" />
                  <rect x={COL_X} y={y} width={COLS.length * CELL_W} height={CELL_H} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
                  {r.map((v, ci) => (
                    <g key={ci}>
                      {ci > 0 && <line x1={COL_X + ci * CELL_W} y1={y} x2={COL_X + ci * CELL_W} y2={y + CELL_H} stroke="var(--ink)" strokeWidth={0.75} />}
                      {ci === qtyIdx && <rect x={COL_X + ci * CELL_W + 1} y={y + 1} width={CELL_W - 2} height={CELL_H - 2} fill="#fff" stroke={NEON.magenta} strokeWidth={2} />}
                      <Label x={COL_X + ci * CELL_W + CELL_W / 2} y={y + CELL_H / 2} lines={v} size={11} mono color={ci === qtyIdx ? "var(--ink)" : "var(--ink-2)"} />
                    </g>
                  ))}
                </g>
              );
            })}
            <Label x={400} y={262} lines={"bytes read: every row, all columns · 1 of 6 values used (16%), the rest is discarded"} size={11} mono color={NEON.magenta} />
          </>
        )}
      </Canvas>
    </Figure>
  );
}
