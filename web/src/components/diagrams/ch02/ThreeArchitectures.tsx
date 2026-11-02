"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Box, Canvas, Cylinder, Group, INK2, Label, NEON } from "../primitives";

type Arch = "memory" | "disk" | "nothing";

const INFO: Record<Arch, { name: string; pro: string; con: string; color: string }> = {
  memory: {
    name: "Shared memory (scale up)",
    pro: "One bigger machine, nothing to coordinate: the simplest option.",
    con: "Cost grows faster than linearly and internal bottlenecks mean twice the hardware is less than twice the throughput.",
    color: NEON.blue,
  },
  disk: {
    name: "Shared disk",
    pro: "Independent CPUs over a shared storage array; the traditional on-prem data warehouse.",
    con: "Contention and locking on the shared disks limit how far it scales.",
    color: NEON.violet,
  },
  nothing: {
    name: "Shared nothing (scale out)",
    pro: "Independent nodes with their own disks coordinate only over the network: potentially linear, best-priced hardware, elastic, multi-datacenter.",
    con: "Explicit sharding (ch. 7) and all the complexity of a distributed system (ch. 9).",
    color: NEON.green,
  },
};

/**
 * The three scaling architectures side by side. Tapping one highlights
 * it and explains its pros and cons; the dashed lines are the network,
 * the only thing shared-nothing nodes share.
 */
export function ThreeArchitectures() {
  const [active, setActive] = useState<Arch | null>(null);
  const info = active ? INFO[active] : null;
  const accent = (a: Arch) => (active === a ? INFO[a].color : undefined);
  const click = (a: Arch) => () => setActive(active === a ? null : a);

  return (
    <Figure
      label="FIG 06"
      title="shared memory · shared disk · shared nothing"
      caption={
        info ? (
          <span>
            <strong>{info.name}.</strong> {info.pro} <span className="text-ink">Cost:</span> {info.con}
          </span>
        ) : (
          "Tap an architecture. What the nodes share decides how far you can scale and how much coordination you pay for."
        )
      }
    >
      <Canvas w={780} h={300}>
        {/* Shared memory */}
        <g onClick={click("memory")} style={{ cursor: "pointer" }}>
          <Group x={20} y={40} w={230} h={240} label="shared memory · scale up" color={active === "memory" ? NEON.blue : INK2} />
          <Box x={45} y={70} w={180} h={140} title="One big machine" sub={"more cores\nmore RAM\none OS"} accent={accent("memory")} />
          <Label x={135} y={240} lines={"vertical: buy a bigger box"} size={10} mono color={INK2} />
        </g>

        {/* Shared disk */}
        <g onClick={click("disk")} style={{ cursor: "pointer" }}>
          <Group x={275} y={40} w={230} h={240} label="shared disk" color={active === "disk" ? NEON.violet : INK2} />
          <Box x={295} y={70} w={85} h={50} title="Node" sub="CPU + RAM" titleSize={12} accent={accent("disk")} />
          <Box x={400} y={70} w={85} h={50} title="Node" sub="CPU + RAM" titleSize={12} accent={accent("disk")} />
          <line x1={337} y1={120} x2={337} y2={150} stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={442} y1={120} x2={442} y2={150} stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={337} y1={150} x2={442} y2={150} stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={390} y1={150} x2={390} y2={170} stroke="var(--ink)" strokeWidth={1.5} />
          <Cylinder x={315} y={170} w={150} h={60} title="Shared storage" sub="NAS / SAN" accent={accent("disk")} />
          <Label x={390} y={252} lines={"locks and contention on the array"} size={10} mono color={INK2} />
        </g>

        {/* Shared nothing */}
        <g onClick={click("nothing")} style={{ cursor: "pointer" }}>
          <Group x={530} y={40} w={230} h={240} label="shared nothing · scale out" color={active === "nothing" ? NEON.green : INK2} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <Box x={560} y={64 + i * 60} w={110} h={42} title="Node" titleSize={12} accent={accent("nothing")} />
              <Cylinder x={680} y={64 + i * 60} w={50} h={42} title="disk" />
              <line x1={670} y1={85 + i * 60} x2={680} y2={85 + i * 60} stroke="var(--ink)" strokeWidth={1.5} />
              {i < 2 && (
                <line x1={615} y1={106 + i * 60} x2={615} y2={124 + i * 60} stroke={active === "nothing" ? NEON.green : INK2} strokeWidth={1.5} strokeDasharray="3 3" />
              )}
            </g>
          ))}
          <Label x={645} y={252} lines={"coordination over the network only"} size={10} mono color={INK2} />
        </g>
      </Canvas>
    </Figure>
  );
}
