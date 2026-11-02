"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";

const STOPS = [
  {
    name: "Bespoke",
    sub: "written and operated in-house",
    control: 5,
    ops: 5,
    note: "You own every line and every pager. Justified only for a core competency.",
  },
  {
    name: "Open source, modified",
    sub: "you patch it, you run it",
    control: 4,
    ops: 4,
    note: "Full visibility, but you now maintain a fork and the operations.",
  },
  {
    name: "Off-the-shelf, self-hosted",
    sub: "on-prem or on IaaS VMs",
    control: 3,
    ops: 3,
    note: "Standard software, your machines: you tune it, you upgrade it, you back it up.",
  },
  {
    name: "Managed service",
    sub: "vendor runs it for you",
    control: 2,
    ops: 2,
    note: "Same software, but the vendor does provisioning, patches and failover.",
  },
  {
    name: "SaaS / cloud service",
    sub: "API only",
    control: 1,
    ops: 1,
    note: "No operations at all, and no control: outages you wait out, bugs you cannot diagnose.",
  },
];

/**
 * Build-or-buy as a slider. Two meters move together: the control you
 * keep and the operations you carry are the same quantity seen twice.
 */
export function BuildOrBuy() {
  const [i, setI] = useState(2);
  const s = STOPS[i];
  return (
    <Figure label="FIG 04" title="the build-or-buy spectrum" scroll={false}>
      <div className="max-w-xl mx-auto">
        <div className="relative pt-2 pb-8">
          <input
            type="range"
            min={0}
            max={STOPS.length - 1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            aria-label="Position on the build-or-buy spectrum"
            className="w-full accent-black"
          />
          <div className="absolute left-0 right-0 bottom-0 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
            <span>Bespoke</span>
            <span>SaaS</span>
          </div>
        </div>

        <div className="border border-line bg-surface p-4">
          <div className="flex items-baseline gap-3">
            <span className="font-dot text-3xl font-bold">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2">{s.sub}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-2 leading-relaxed">{s.note}</p>
          <div className="mt-4 space-y-2">
            <Meter label="control you keep" value={s.control} color="var(--neon-1)" />
            <Meter label="operations you carry" value={s.ops} color="var(--neon-5)" />
          </div>
        </div>
      </div>
    </Figure>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{label}</span>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className="w-6 h-2.5 border border-ink"
            style={{ background: n <= value ? color : "transparent" }}
          />
        ))}
      </span>
    </div>
  );
}
