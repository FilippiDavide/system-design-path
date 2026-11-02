"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, INK, Label, NEON } from "../primitives";

interface Face {
  key: string;
  title: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: keyof typeof NEON;
  why: string;
}

const FACES: Face[] = [
  {
    key: "cas",
    title: "Linearizable CAS",
    sub: "fault-tolerant",
    x: 150,
    y: 36,
    w: 150,
    h: 56,
    color: "blue",
    why: "CAS ⇔ consensus. Start a register at null and let everyone do CAS(null, proposal): the value that sticks is the decision. The other way round, CAS operations with the same expected value propose their new values; the decided one wins, the rest fail.",
  },
  {
    key: "log",
    title: "Shared log",
    sub: "total order broadcast",
    x: 490,
    y: 36,
    w: 150,
    h: 56,
    color: "green",
    why: "Shared log ⇔ consensus. From the log: the first entry is the decided value. From consensus: one instance per slot, whoever loses retries on a later slot. Everyone reads the same prefix in the same order.",
  },
  {
    key: "ac",
    title: "Atomic commitment",
    sub: "all must vote commit",
    x: 150,
    y: 248,
    w: 150,
    h: 56,
    color: "violet",
    why: "Atomic commitment ⇔ consensus. Every node sends its vote to everyone; whoever sees all commits proposes commit, whoever sees an abort or a timeout proposes abort; everyone does what consensus decides. Unlike plain consensus, one abort vote forces abort.",
  },
  {
    key: "fa",
    title: "Fetch-and-add",
    sub: "consensus number 2",
    x: 490,
    y: 248,
    w: 150,
    h: 56,
    color: "orange",
    why: "Fetch-and-add is easy from CAS (read, CAS(v, v+1), retry). The reverse works only for two proposers: whoever reads 0 wins, whoever reads 1 knows the other one won. With three, the losers do not know who won, and if the winner crashes they hang.",
  },
];

/** Double-headed straight connector between two points. */
function BiArrow({ pts, color }: { pts: [number, number, number, number]; color: keyof typeof NEON | "ink" }) {
  const stroke = color === "ink" ? INK : NEON[color];
  return (
    <line
      x1={pts[0]}
      y1={pts[1]}
      x2={pts[2]}
      y2={pts[3]}
      stroke={stroke}
      strokeWidth={1.5}
      markerStart={`url(#arrow-${color})`}
      markerEnd={`url(#arrow-${color})`}
    />
  );
}

/**
 * FIG 03: the many faces of consensus. The hub in the middle is
 * equivalent to each of the four problems around it; tap one to see
 * how a solution converts into the other.
 */
export function ConsensusFaces() {
  const [active, setActive] = useState<string | null>(null);
  const info = FACES.find((f) => f.key === active);
  const cx = 395;
  const cy = 170;

  return (
    <Figure
      label="FIG 03"
      title="the many faces of consensus"
      caption={
        info ? (
          <span>
            <strong>{info.title}</strong> · {info.why}
          </span>
        ) : (
          "Tap a face. Each of the four problems converts into consensus and back, which is why a fault-tolerant CAS, a shared log and atomic commit are all the same problem. Fetch-and-add is the exception: it only gets you as far as two nodes."
        )
      }
    >
      <Canvas w={780} h={340}>
        {/* hub */}
        <circle cx={cx} cy={cy} r={46} fill="#fff" stroke={INK} strokeWidth={2} />
        <Label x={cx} y={cy} lines="Consensus" size={13} weight={600} />

        {FACES.map((f) => {
          const isActive = active === f.key;
          const fx = f.x + f.w / 2;
          const fy = f.y + f.h / 2;
          // Connector from the hub rim towards the face, stopping short of the box.
          const dx = fx - cx;
          const dy = fy - cy;
          const len = Math.hypot(dx, dy);
          const hx = cx + (dx / len) * 50;
          const hy = cy + (dy / len) * 50;
          const ex = fx - (dx / len) * (f.w / 2 + 26);
          const ey = fy - (dy / len) * (f.h / 2 + 26);
          return (
            <g key={f.key} onClick={() => setActive(isActive ? null : f.key)} style={{ cursor: "pointer" }}>
              <BiArrow pts={[hx, hy, ex, ey]} color={isActive ? f.color : "ink"} />
              <Box
                x={f.x}
                y={f.y}
                w={f.w}
                h={f.h}
                title={f.title}
                sub={f.sub}
                accent={isActive ? NEON[f.color] : undefined}
                titleSize={12}
              />
            </g>
          );
        })}

        {/* what the faces are used for */}
        <Arrow pts={[150, 64, 122, 64]} color={active === "cas" ? "blue" : "soft"} />
        <Box x={10} y={36} w={112} h={56} title="Locks, leases" sub="uniqueness" titleSize={12} dashed />
        <Arrow pts={[640, 64, 660, 64]} color={active === "log" ? "green" : "soft"} />
        <Box x={660} y={30} w={112} h={68} title="State machine" sub={"replication,\nevent sourcing"} titleSize={12} dashed />

        <Label x={395} y={325} lines="⇔  a solution to one converts into a solution to the other" size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}
