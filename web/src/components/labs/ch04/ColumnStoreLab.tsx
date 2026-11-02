"use client";

import { useState } from "react";

interface Row {
  date: string;
  product: number;
  store: number;
  qty: number;
  price: number;
}

const COLS = ["date", "product", "store", "qty", "price"] as const;
type Col = (typeof COLS)[number];
const BYTES = 4; // every value is a 4-byte word, to keep the arithmetic honest

/** Twelve sales in arrival order (product 31 interleaved with the others, so its
 * unsorted bitmap is all short runs): three days, four products, three stores. */
const RAW: Row[] = [
  { date: "01-14", product: 31, store: 3, qty: 2, price: 9.9 },
  { date: "01-15", product: 68, store: 1, qty: 1, price: 4.5 },
  { date: "01-16", product: 31, store: 7, qty: 1, price: 9.9 },
  { date: "01-14", product: 69, store: 3, qty: 5, price: 12 },
  { date: "01-15", product: 31, store: 3, qty: 3, price: 9.9 },
  { date: "01-14", product: 30, store: 1, qty: 2, price: 7.2 },
  { date: "01-15", product: 31, store: 7, qty: 2, price: 9.9 },
  { date: "01-16", product: 68, store: 3, qty: 4, price: 4.5 },
  { date: "01-14", product: 31, store: 1, qty: 1, price: 9.9 },
  { date: "01-16", product: 69, store: 3, qty: 2, price: 12 },
  { date: "01-16", product: 31, store: 3, qty: 3, price: 9.9 },
  { date: "01-15", product: 30, store: 3, qty: 6, price: 7.2 },
];

const SORTED = [...RAW].sort((a, b) => a.date.localeCompare(b.date) || a.product - b.product || a.store - b.store);

type Query = "p31" | "p31s3";
const QUERIES: Record<Query, { sql: string; cols: Col[]; pred: (r: Row) => boolean }> = {
  p31: { sql: "SUM(qty) WHERE product = 31", cols: ["product", "qty"], pred: (r) => r.product === 31 },
  p31s3: { sql: "SUM(qty) WHERE product = 31 AND store = 3", cols: ["product", "store", "qty"], pred: (r) => r.product === 31 && r.store === 3 },
};

/** Run-length encode a bitmap: [value, run][] */
function rle(bits: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const b of bits) {
    const last = out[out.length - 1];
    if (last && last[0] === b) last[1]++;
    else out.push([b, 1]);
  }
  return out;
}

/**
 * The same fact table laid out by row or by column, sorted or not. A
 * query counts the bytes it has to read in each layout, and the
 * product column shows how bitmaps and run-length encoding behave
 * when the rows are sorted.
 */
export function ColumnStoreLab() {
  const [byColumn, setByColumn] = useState(false);
  const [sorted, setSorted] = useState(false);
  const [q, setQ] = useState<Query>("p31");
  const [ran, setRan] = useState(false);

  const rows = sorted ? SORTED : RAW;
  const query = QUERIES[q];
  const match = rows.map(query.pred);
  const sum = rows.filter(query.pred).reduce((a, r) => a + r.qty, 0);
  const totalBytes = rows.length * COLS.length * BYTES;
  const readBytes = byColumn ? rows.length * query.cols.length * BYTES : totalBytes;

  const products = [...new Set(rows.map((r) => r.product))].sort((a, b) => a - b);
  const bitmaps = products.map((p) => ({ p, bits: rows.map((r) => (r.product === p ? 1 : 0)) }));
  const storeBits = rows.map((r) => (r.store === 3 ? 1 : 0));
  const b31 = bitmaps.find((b) => b.p === 31)!;
  const runs31 = rle(b31.bits);

  const hotCols = (c: Col) => ran && (byColumn ? query.cols.includes(c) : true);

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex gap-px border border-line">
          {(["row", "column"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setByColumn(m === "column")}
              aria-pressed={(m === "column") === byColumn}
              className={`px-3 py-1.5 ${(m === "column") === byColumn ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              by {m}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => setSorted((v) => !v)}
          aria-pressed={sorted}
          className={`border px-3 py-1.5 ${sorted ? "border-ink bg-ink text-surface" : "border-line-soft hover:border-ink"}`}
        >
          sort by (date, product)
        </button>
        <select value={q} onChange={(e) => setQ(e.target.value as Query)} aria-label="Query" className="max-w-full border border-line-soft bg-surface px-2 py-1 font-mono text-[11px] uppercase">
          {(Object.keys(QUERIES) as Query[]).map((k) => (
            <option key={k} value={k}>
              {QUERIES[k].sql}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setRan(true)} className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface">
          Run
        </button>
      </div>

      <div className="grid md:grid-cols-[1.2fr_1fr] gap-px bg-line-soft">
        <div className="bg-surface p-3 overflow-x-auto">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="font-semibold text-sm">fact_sales · {rows.length} rows</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{byColumn ? "one file per column" : "one file, rows back to back"}</span>
          </div>
          {byColumn ? (
            <div className="flex gap-2">
              {COLS.map((c) => (
                <div key={c} className={`border px-1.5 py-1 font-mono text-[11px] ${hotCols(c) ? "border-neon-2" : "border-line-soft text-ink-3"}`}>
                  <p className={`uppercase text-[10px] tracking-[0.12em] mb-1 ${hotCols(c) ? "text-neon-2" : ""}`}>{c}</p>
                  {rows.map((r, i) => (
                    <p key={i} className={`text-right ${ran && match[i] && hotCols(c) ? "bg-neon-2 text-surface px-0.5" : "px-0.5"}`}>
                      {r[c]}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <table className="font-mono text-[11px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-ink-3 pr-2 font-normal">#</th>
                  {COLS.map((c) => (
                    <th key={c} className="text-right px-1.5 uppercase text-[10px] tracking-[0.12em] font-normal text-ink-2">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-t border-line-soft ${ran ? (match[i] ? "" : "text-ink-3") : ""}`}>
                    <td className="text-ink-3 pr-2">r{i + 1}</td>
                    {COLS.map((c) => (
                      <td key={c} className={`text-right px-1.5 ${ran && match[i] && query.cols.includes(c) ? "bg-neon-2 text-surface" : ""}`}>
                        {r[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-surface p-3 space-y-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{query.sql}</p>
            {ran ? (
              <>
                <p className="font-dot text-3xl font-bold mt-1">
                  {sum}
                  <span className="text-ink-3 text-base"> · {match.filter(Boolean).length} rows</span>
                </p>
                <p className="font-mono text-[11px] mt-1">
                  bytes read <span className={readBytes < totalBytes ? "text-neon-2" : ""}>{readBytes}</span> of {totalBytes}
                  <span className="text-ink-2"> · {byColumn ? `${query.cols.length} of ${COLS.length} column files` : "every row, every column"}</span>
                </p>
                <div className="mt-1 flex h-1.5 w-full max-w-xs gap-px">
                  {COLS.map((c) => (
                    <span key={c} className={`flex-1 ${byColumn && !query.cols.includes(c) ? "bg-line-soft" : "bg-neon-2"}`} />
                  ))}
                </div>
              </>
            ) : (
              <p className="font-mono text-[12px] text-ink-3 mt-1">press Run</p>
            )}
          </div>

          <div className="border-t border-line-soft pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 mb-1">product column as bitmaps · one per value</p>
            <ul className="font-mono text-[11px] space-y-0.5">
              {bitmaps.map((b) => (
                <li key={b.p} className={`flex items-center gap-2 ${b.p === 31 ? "" : "text-ink-3"}`}>
                  <span className="w-6">{b.p}</span>
                  <span className="flex gap-px">
                    {b.bits.map((bit, i) => (
                      <span key={i} className={`w-3 h-3 border ${bit ? (b.p === 31 ? "bg-neon-2 border-neon-2" : "bg-ink-3 border-ink-3") : "border-line-soft"}`} />
                    ))}
                  </span>
                </li>
              ))}
              {q === "p31s3" && (
                <>
                  <li className="flex items-center gap-2 pt-1">
                    <span className="w-6 text-[10px]">s=3</span>
                    <span className="flex gap-px">
                      {storeBits.map((bit, i) => (
                        <span key={i} className={`w-3 h-3 border ${bit ? "bg-neon-1 border-neon-1" : "border-line-soft"}`} />
                      ))}
                    </span>
                  </li>
                  <li className="flex items-center gap-2 border-t border-line-soft pt-1">
                    <span className="w-6 text-[10px]">AND</span>
                    <span className="flex gap-px">
                      {rows.map((_, i) => (
                        <span key={i} className={`w-3 h-3 border ${b31.bits[i] && storeBits[i] ? "bg-ink border-ink" : "border-line-soft"}`} />
                      ))}
                    </span>
                  </li>
                </>
              )}
            </ul>
            <p className="font-mono text-[11px] mt-2">
              <span className="text-ink-2">RLE of 31: </span>
              {runs31.map(([v, n], i) => (
                <span key={i} className={v ? "text-neon-2" : ""}>
                  {n}×{v}
                  {i < runs31.length - 1 ? " " : ""}
                </span>
              ))}
              <span className="text-ink-2"> · {runs31.length} runs{sorted ? "" : " (sort to shorten)"}</span>
            </p>
          </div>
        </div>
      </div>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Run the query by row, then by column: the answer is the same, the bytes read are not. By row, a query that
        needs two of five columns still drags all five off disk. By column, the product column with four distinct
        values becomes four bitmaps, the filter is a bitwise AND, and the k-th bit is the same row in every
        column. Sort the rows by (date, product): the bitmap of product 31 collapses into a few long runs that
        run-length encoding stores in a handful of bytes, and rows in the middle can no longer be inserted
        cheaply, which is why writes go through a log-structured in-memory store first.
      </p>
    </div>
  );
}
