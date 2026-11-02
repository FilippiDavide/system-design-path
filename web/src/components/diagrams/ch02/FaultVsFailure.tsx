"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Group, Label } from "../primitives";

/**
 * Fault vs failure. One disk out of three stops working: that is a
 * failure of the disk and a fault of the system. Whether the system
 * fails too depends on whether it tolerates that fault.
 */
export function FaultVsFailure() {
  const [tolerated, setTolerated] = useState(true);

  return (
    <Figure
      label="FIG 05"
      title={tolerated ? "fault tolerated: the service continues" : "fault not tolerated: failure"}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {[
              { v: false, label: "No redundancy" },
              { v: true, label: "Tolerates 1 of 3" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setTolerated(o.v)}
                aria-pressed={tolerated === o.v}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  tolerated === o.v ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {o.label}
              </button>
            ))}
          </span>
          <span>
            {tolerated
              ? "The same fault, but the system was designed to survive one disk out of three (RAID, replication): the SLO is still met and nobody outside notices. Tolerance is always limited to a declared number and kind of faults."
              : "Disk 2 is a single point of failure: its fault turns into a failure of the whole system, which stops meeting its SLO. Fault and failure are the same event seen at two levels."}
          </span>
        </div>
      }
    >
      <Canvas w={780} h={280}>
        <Group x={30} y={50} w={390} h={200} label={tolerated ? "system · tolerates 1 disk out of 3" : "system · no redundancy"} />
        {[1, 2, 3].map((n, i) => {
          const faulty = n === 2;
          return (
            <Cylinder
              key={n}
              x={60 + i * 115}
              y={80}
              w={100}
              h={70}
              title={`Disk ${n}`}
              sub={faulty ? "fault" : "ok"}
              accent={faulty ? "var(--bad)" : tolerated ? "var(--ok)" : undefined}
            />
          );
        })}
        {tolerated && (
          <Label x={225} y={178} lines={"data also on disks 1 and 3 · rebuild from the copies"} size={10} mono color="var(--ok)" />
        )}
        <Label x={225} y={tolerated ? 220 : 200} lines={"failure of the disk = fault of the system"} size={11} mono color="var(--ink-2)" />
        {!tolerated && <Label x={225} y={222} lines={"single point of failure"} size={11} weight={600} mono color="var(--bad)" />}

        {/* Two outcomes; the active one is solid */}
        <Arrow pts={[420, 150, 470, 150, 470, 90, 540, 90]} color={tolerated ? "soft" : "ink"} dashed={tolerated} />
        {/* Labels placed by hand: the arrow midpoint sits too close to the boxes */}
        <Label x={480} y={78} lines="if not tolerated" size={10} mono color="var(--ink-2)" />
        <Box
          x={540}
          y={60}
          w={200}
          h={60}
          title="Failure"
          sub="system does not meet its SLO"
          accent={tolerated ? undefined : "var(--bad)"}
          dashed={tolerated}
          titleSize={12}
        />
        <Arrow pts={[420, 150, 470, 150, 470, 210, 540, 210]} color={tolerated ? "ink" : "soft"} dashed={!tolerated} />
        <Label x={480} y={224} lines="if tolerated" size={10} mono color="var(--ink-2)" />
        <Box
          x={540}
          y={180}
          w={200}
          h={60}
          title="Service continues"
          sub="SLO still met"
          accent={tolerated ? "var(--ok)" : undefined}
          dashed={!tolerated}
          titleSize={12}
        />
      </Canvas>
    </Figure>
  );
}
