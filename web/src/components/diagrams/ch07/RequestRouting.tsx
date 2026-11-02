"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Group, Label, NEON } from "../primitives";

const STRATEGIES = [
  {
    key: "any",
    name: "1 · Any node",
    color: "blue" as const,
    note: "The client talks to whichever node it likes. Every node holds the map and forwards the request to the right one: one extra hop, no extra component. Cassandra and Riak work this way.",
  },
  {
    key: "tier",
    name: "2 · Routing tier",
    color: "magenta" as const,
    note: "A shard-aware router (MongoDB's mongos) is the only thing that knows the map; the nodes and the client stay simple. The tier itself must be fault-tolerant.",
  },
  {
    key: "client",
    name: "3 · Informed client",
    color: "green" as const,
    note: "The client subscribes to the map and goes straight to the right node: no extra hop, but every client library must track changes.",
  },
];

/**
 * Three ways to get a request to the node that owns the shard. Tap a
 * column to see who holds the key → shard → node map, and where that
 * map comes from.
 */
export function RequestRouting() {
  const [active, setActive] = useState<number | null>(null);
  const s = active === null ? null : STRATEGIES[active];
  const col = (i: number) => (active === null || active === i ? STRATEGIES[i].color : "soft");
  const accent = (i: number) => (active === i ? NEON[STRATEGIES[i].color] : undefined);

  return (
    <Figure
      label="FIG 03"
      title="request routing"
      caption={
        s ? (
          <span>
            <strong>{s.name}.</strong> {s.note} In all three the map is kept by a coordination service and pushed to
            whoever routes.
          </span>
        ) : (
          "Tap a strategy. The routing must know key → shard and shard → node, and must learn when that changes; a coordination service (ZooKeeper, etcd) keeps the authoritative map."
        )
      }
    >
      <Canvas w={780} h={340}>
        {STRATEGIES.map((st, i) => {
          const gx = 20 + i * 255;
          const bx = gx + 40;
          const cx = bx + 75;
          const dim = active !== null && active !== i;
          return (
            <g key={st.key} onClick={() => setActive(active === i ? null : i)} style={{ cursor: "pointer" }}>
              <Group x={gx} y={30} w={230} h={230} label={st.name} color={active === i ? NEON[st.color] : "var(--ink-2)"} />
              {/* a transparent hit area so the whole column is tappable */}
              <rect x={gx} y={30} width={230} height={230} fill="transparent" />
              <Box
                x={bx}
                y={44}
                w={150}
                h={44}
                title="Client"
                sub={i === 2 ? "knows the map" : undefined}
                accent={accent(i)}
                titleSize={12}
                dashed={dim}
              />
              {i === 0 && (
                <>
                  <Arrow pts={[cx, 88, cx, 124]} color={col(i)} />
                  <Box x={bx} y={124} w={150} h={44} title="Any node" sub="has the map" accent={accent(i)} titleSize={12} dashed={dim} />
                  <Arrow pts={[cx, 168, cx, 204]} color={col(i)} label="forwards" labelOffset={0} />
                </>
              )}
              {i === 1 && (
                <>
                  <Arrow pts={[cx, 88, cx, 124]} color={col(i)} />
                  <Box x={bx} y={124} w={150} h={44} title="Router" sub="shard-aware" accent={accent(i)} titleSize={12} dashed={dim} />
                  <Arrow pts={[cx, 168, cx, 204]} color={col(i)} />
                </>
              )}
              {i === 2 && <Arrow pts={[cx, 88, cx, 204]} color={col(i)} label="direct" labelOffset={0} />}
              <Box x={bx} y={204} w={150} h={44} title="Right node" sub="owns the shard" accent={accent(i)} titleSize={12} dashed={dim} />
            </g>
          );
        })}

        {/* The map and where it comes from */}
        <Box x={240} y={290} w={300} h={40} title="Coordination service" sub="ZooKeeper · etcd · Raft · gossip" titleSize={12} accent={s ? NEON[s.color] : undefined} />
        {/* to the node in column 1 */}
        <Arrow pts={[300, 290, 300, 276, 40, 276, 40, 146, 60, 146]} dashed color={active === 0 ? "blue" : "soft"} width={1} />
        {/* to the router in column 2 */}
        <Arrow pts={[390, 290, 390, 276, 500, 276, 500, 146, 465, 146]} dashed color={active === 1 ? "magenta" : "soft"} width={1} />
        {/* to the client in column 3 */}
        <Arrow pts={[480, 290, 480, 282, 765, 282, 765, 66, 720, 66]} dashed color={active === 2 ? "green" : "soft"} width={1} />
        <Label x={130} y={300} lines="map: key → shard → node" size={10} mono color="var(--ink-2)" />
        <Label x={650} y={300} lines="nodes register, routers subscribe" size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}
