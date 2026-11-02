"use client";

import { useMemo, useState } from "react";

type Mode = "oltp" | "olap";

const COLS = ["id", "customer", "product", "qty", "price", "month"] as const;
const PRODUCTS = ["lamp", "chair", "desk", "mug", "cable", "shelf"];
const CUSTOMERS = ["ada", "bob", "cy", "dee", "eli", "fay"];

/** Deterministic pseudo-random rows so the lab renders the same on every load. */
function makeRows(n: number) {
  const rows = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 1; i <= n; i++) {
    rows.push({
      id: i,
      customer: CUSTOMERS[Math.floor(rnd() * CUSTOMERS.length)],
      product: PRODUCTS[Math.floor(rnd() * PRODUCTS.length)],
      qty: 1 + Math.floor(rnd() * 4),
      price: 10 + Math.floor(rnd() * 90),
      month: ["Jan", "Feb", "Mar"][Math.floor(rnd() * 3)],
    });
  }
  return rows;
}

/**
 * The same orders table under two workloads: an OLTP point query
 * touches one row through the primary key; an OLAP aggregate touches
 * one column of every row. The counters are the point.
 */
export function AccessPatternLab() {
  const rows = useMemo(() => makeRows(14), []);
  const [mode, setMode] = useState<Mode>("oltp");
  const [key, setKey] = useState(7);
  const [month, setMonth] = useState<string | null>(null);

  const hitRow = (id: number) => mode === "oltp" && id === key;
  const hitCell = (id: number, col: string, m: string) =>
    mode === "olap" && (col === "price" || col === "month") && (!month || m === month);

  const olapRows = rows.filter((r) => !month || r.month === month);
  const sum = olapRows.reduce((a, r) => a + r.price * r.qty, 0);
  const touched = mode === "oltp" ? 1 : olapRows.length;
  const cells = mode === "oltp" ? COLS.length : olapRows.length * 3;

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex border border-line">
          <button
            type="button"
            onClick={() => setMode("oltp")}
            className={`px-3 py-1.5 ${mode === "oltp" ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
          >
            OLTP point query
          </button>
          <button
            type="button"
            onClick={() => setMode("olap")}
            className={`px-3 py-1.5 ${mode === "olap" ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
          >
            OLAP aggregate
          </button>
        </span>
        {mode === "oltp" ? (
          <label className="flex items-center gap-2">
            id =
            <input
              type="number"
              min={1}
              max={rows.length}
              value={key}
              onChange={(e) => setKey(Math.max(1, Math.min(rows.length, Number(e.target.value))))}
              className="w-14 border border-line px-2 py-1 font-mono text-sm"
            />
          </label>
        ) : (
          <span className="flex gap-1">
            {[null, "Jan", "Feb", "Mar"].map((m) => (
              <button
                key={m ?? "all"}
                type="button"
                onClick={() => setMonth(m)}
                className={`px-2 py-1 border ${month === m ? "border-ink bg-ink text-surface" : "border-line-soft hover:border-ink"}`}
              >
                {m ?? "all months"}
              </button>
            ))}
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-[1fr_220px]">
        <div className="overflow-x-auto p-3 min-w-0">
          <p className="font-mono text-[12px] mb-2 text-ink-2">
            {mode === "oltp" ? (
              <>SELECT * FROM orders WHERE id = <b className="text-ink">{key}</b></>
            ) : (
              <>
                SELECT SUM(price * qty) FROM orders{month ? <> WHERE month = &apos;{month}&apos;</> : null}
              </>
            )}
          </p>
          <table className="w-full font-mono text-[12px] border-collapse">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c}
                    className={`text-left px-2 py-1 border-b border-line uppercase text-[10px] tracking-[0.12em] ${
                      mode === "olap" && (c === "price" || c === "qty") ? "text-neon-2" : ""
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={hitRow(r.id) ? "bg-neon-1/10" : ""}>
                  {COLS.map((c) => {
                    const hot =
                      hitRow(r.id) ||
                      (mode === "olap" && (c === "price" || c === "qty" || c === "month") && (!month || r.month === month));
                    return (
                      <td
                        key={c}
                        className={`px-2 py-0.5 border-b border-line-soft ${
                          hot ? (mode === "oltp" ? "text-ink font-semibold" : "bg-neon-2/10 text-ink font-semibold") : "text-ink-3"
                        } ${hitCell(r.id, c, r.month) ? "" : ""}`}
                      >
                        {r[c]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="border-t md:border-t-0 md:border-l border-line-soft p-4 space-y-4">
          <Stat label="rows touched" value={touched} of={rows.length} />
          <Stat label="cells read" value={cells} of={rows.length * COLS.length} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">result</p>
            <p className="font-dot text-3xl font-bold mt-1">
              {mode === "oltp" ? `1 row` : sum.toLocaleString()}
            </p>
          </div>
          <p className="text-[12px] text-ink-2 leading-relaxed">
            {mode === "oltp"
              ? "An index on the key finds the row directly. The cost does not grow with the table."
              : "Every row has to be scanned, but only three columns matter. That gap is why analytical stores lay data out by column (ch. 4)."}
          </p>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, of }: { label: string; value: number; of: number }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className="font-dot text-3xl font-bold mt-1">
        {value}
        <span className="text-ink-3 text-lg"> / {of}</span>
      </p>
      <div className="mt-1 h-1.5 bg-surface-2 border border-line-soft">
        <div className="h-full bg-ink" style={{ width: `${(value / of) * 100}%` }} />
      </div>
    </div>
  );
}
