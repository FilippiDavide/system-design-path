"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Group, Label, NEON } from "../primitives";

/**
 * ETL vs ELT. One toggle moves the Transform step from before the
 * warehouse to inside it, which is the whole difference between the two.
 */
export function EtlPipeline() {
  const [elt, setElt] = useState(false);

  return (
    <Figure
      label="FIG 02"
      title={elt ? "ELT: transform inside the warehouse" : "ETL: transform before loading"}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {(["ETL", "ELT"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setElt(m === "ELT")}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  (m === "ELT") === elt ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {m}
              </button>
            ))}
          </span>
          <span>
            {elt
              ? "Raw data is loaded first; the warehouse does the cleaning and reshaping with its own compute."
              : "Data is cleaned and reshaped into an analytical schema on the way in; the warehouse only ever sees the result."}
          </span>
        </div>
      }
    >
      <Canvas w={780} h={300}>
        <Group x={20} y={30} w={190} h={250} label="operational systems · one per service" />
        <Cylinder x={40} y={44} w={90} h={48} title="Website" />
        <Cylinder x={40} y={104} w={90} h={48} title="Checkouts" />
        <Cylinder x={40} y={164} w={90} h={48} title="Warehouse" sub="stock" />
        <Box x={40} y={226} w={150} h={42} title="External SaaS" sub="CRM, payments" titleSize={12} dashed />

        {/* into Extract */}
        <Arrow pts={[130, 68, 170, 68, 170, 140, 240, 140]} />
        <Arrow pts={[130, 128, 170, 128]} noHead />
        <Arrow pts={[130, 188, 170, 188]} noHead />
        <Arrow pts={[190, 247, 215, 247, 215, 140]} noHead dashed label="vendor API" labelOffset={14} />

        <Box x={240} y={110} w={90} h={60} title="Extract" accent={NEON.blue} />

        {elt ? (
          <>
            <Arrow pts={[330, 140, 380, 140]} />
            <Box x={380} y={110} w={90} h={60} title="Load" accent={NEON.green} />
            <Arrow pts={[470, 140, 520, 140]} />
            <Cylinder x={520} y={70} w={150} h={150} title="Data warehouse" sub="one per enterprise" accent={NEON.magenta} />
            <Box x={545} y={150} w={100} h={46} title="Transform" sub="inside, SQL" accent={NEON.orange} titleSize={12} />
          </>
        ) : (
          <>
            <Arrow pts={[330, 140, 380, 140]} />
            <Box x={380} y={110} w={100} h={60} title="Transform" sub="schema, cleaning" accent={NEON.orange} />
            <Arrow pts={[480, 140, 520, 140]} />
            <Box x={520} y={110} w={80} h={60} title="Load" accent={NEON.green} />
            <Arrow pts={[600, 140, 630, 140]} />
            <Cylinder x={630} y={92} w={130} h={96} title="Data warehouse" sub="read-only" accent={NEON.magenta} />
          </>
        )}

        <Arrow pts={[elt ? 595 : 695, elt ? 220 : 188, elt ? 595 : 695, 250]} />
        <Label x={elt ? 595 : 695} y={268} lines="analysts · dashboards" size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}
