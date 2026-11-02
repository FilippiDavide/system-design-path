"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Canvas, Group, Label, NEON } from "../primitives";

type Mode = "local" | "global";
type Op = "read" | "write";

/** A data shard with its records; `local` adds the per-shard index. */
function DataShard({
  x,
  y,
  h,
  title,
  range,
  records,
  index,
  hit,
}: {
  x: number;
  y: number;
  h: number;
  title: string;
  range: string;
  records: string[];
  index?: string[];
  hit?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={240} height={h} fill="#fff" stroke={hit ?? "var(--ink)"} strokeWidth={hit ? 2 : 1.5} />
      <Label x={x + 12} y={y + 16} lines={title} size={12} weight={600} anchor="start" />
      <Label x={x + 228} y={y + 16} lines={range} size={10} mono color="var(--ink-2)" anchor="end" />
      {records.map((r, i) => (
        <Label key={r} x={x + 12} y={y + 38 + i * 15} lines={r} size={11} mono anchor="start" color="var(--ink-2)" />
      ))}
      {index && (
        <g>
          <rect x={x + 124} y={y + 28} width={106} height={h - 40} fill="var(--surface-2)" stroke="var(--line-soft)" strokeWidth={1} />
          <Label x={x + 130} y={y + 40} lines="local index" size={9} mono upper color="var(--ink-2)" anchor="start" />
          {index.map((l, i) => (
            <Label key={l} x={x + 130} y={y + 56 + i * 15} lines={l} size={10} mono anchor="start" />
          ))}
        </g>
      )}
    </g>
  );
}

/**
 * Local vs global secondary index on "color". Toggle the layout, then
 * run a read (all red cars) or a write (car 603 becomes red) and see
 * which shards each one has to touch.
 */
export function SecondaryIndex() {
  const [mode, setMode] = useState<Mode>("local");
  const [op, setOp] = useState<Op>("read");

  const local = mode === "local";
  const read = op === "read";
  const hitColor = read ? NEON.blue : NEON.orange;
  const hitKey = read ? ("blue" as const) : ("orange" as const);

  // Which boxes a given op touches. Shard 1 is always involved: 603
  // lives there and red cars are found there. Shard 0 only on reads.
  const touchShard0 = read;
  const touchShard1 = true;
  const touchIndex0 = !local; // "red" is a-r → index shard 0, for both read and write
  const touchIndex1 = !local && !read; // the write removes 603 from "silver"

  const explanation = local
    ? read
      ? "Nobody knows which shards hold red cars, so the query is sent to every shard and the results are gathered: scatter/gather. Adding shards does not make this query faster."
      : "Car 603 lives on shard 1, and so does its index entry: one shard, one local transaction."
    : read
      ? "The term 'red' lives on exactly one index shard, which returns the postings list 101, 342, 603. Only then are the records fetched from their data shards."
      : "The record changes on shard 1, 'red' gains 603 on index shard 0 and 'silver' loses it on index shard 1: three shards, so a distributed transaction or an asynchronous index that may be stale.";

  const toggle = (
    <span className="flex gap-px border border-line w-fit">
      {(["local", "global"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${mode === m ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
        >
          {m}
        </button>
      ))}
    </span>
  );
  const opToggle = (
    <span className="flex gap-px border border-line w-fit">
      {(["read", "write"] as const).map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={op === o}
          onClick={() => setOp(o)}
          className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${op === o ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
        >
          {o === "read" ? "read: color = red" : "write: 603 → red"}
        </button>
      ))}
    </span>
  );

  return (
    <Figure
      label="FIG 04"
      title={local ? "local index: document-partitioned" : "global index: term-partitioned"}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          {toggle}
          {opToggle}
          <span>{explanation}</span>
        </div>
      }
    >
      <Canvas w={780} h={local ? 240 : 330}>
        <rect x={20} y={100} width={100} height={44} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
        <Label x={70} y={114} lines="Client" size={12} weight={600} />
        <Label x={70} y={131} lines={read ? "red cars?" : "603 = red"} size={10} mono color={hitColor} />

        {local ? (
          <>
            <Group x={210} y={40} w={550} h={180} label="data shards, each with its own index" />
            <DataShard
              x={240}
              y={60}
              h={120}
              title="shard 0"
              range="cars 0–499"
              records={["101 red", "215 silver", "342 red"]}
              index={["red → 101, 342", "silver → 215"]}
              hit={touchShard0 ? hitColor : undefined}
            />
            <DataShard
              x={500}
              y={60}
              h={120}
              title="shard 1"
              range="cars 500–999"
              records={[read ? "603 red" : "603 → red", "780 silver"]}
              index={read ? ["red → 603", "silver → 780"] : ["red → +603", "silver → 780"]}
              hit={touchShard1 ? hitColor : undefined}
            />
            {read ? (
              <>
                <Arrow pts={[120, 112, 180, 112, 180, 90, 240, 90]} color={hitKey} />
                {/* Label kept clear of the vertical fan-out line at x=180. */}
                <Label x={140} y={84} lines="1 scatter" size={10} mono color={NEON.blue} />
                <Arrow pts={[180, 112, 180, 50, 620, 50, 620, 60]} color={hitKey} />
                <Arrow pts={[360, 180, 360, 205]} dashed color="soft" width={1} noHead />
                <Arrow pts={[620, 180, 620, 205]} dashed color="soft" width={1} noHead />
                <Arrow pts={[360, 205, 620, 205]} dashed color="soft" width={1} noHead />
                <Label x={490} y={224} lines="2 gather: 101, 342, 603" size={10} mono color={NEON.blue} />
              </>
            ) : (
              <>
                <Arrow pts={[120, 122, 180, 122, 180, 50, 620, 50, 620, 60]} color={hitKey} />
                <Label x={632} y={50} lines="one shard" size={10} mono color={NEON.orange} anchor="start" />
              </>
            )}
          </>
        ) : (
          <>
            <Group x={210} y={40} w={550} h={100} label="data shards · no index inside" />
            <DataShard
              x={240}
              y={60}
              h={64}
              title="shard 0"
              range="cars 0–499"
              records={["101 red · 215 silver · 342 red"]}
              hit={read && touchShard0 ? hitColor : undefined}
            />
            <DataShard
              x={500}
              y={60}
              h={64}
              title="shard 1"
              range="cars 500–999"
              records={[read ? "603 red · 780 silver" : "603 silver → red · 780 silver"]}
              hit={touchShard1 ? hitColor : undefined}
            />
            <Group x={210} y={190} w={550} h={110} label="index shards · partitioned by term" />
            <g>
              <rect x={240} y={210} width={240} height={70} fill="#fff" stroke={touchIndex0 ? hitColor : "var(--ink)"} strokeWidth={touchIndex0 ? 2 : 1.5} />
              <Label x={252} y={226} lines="index shard 0" size={12} weight={600} anchor="start" />
              <Label x={468} y={226} lines="terms a–r" size={10} mono color="var(--ink-2)" anchor="end" />
              <Label x={252} y={250} lines={read ? "red → 101, 342, 603" : "red → 101, 342, +603"} size={11} mono anchor="start" />
              <Label x={252} y={266} lines="blue → 455" size={11} mono anchor="start" color="var(--ink-2)" />
            </g>
            <g>
              <rect x={500} y={210} width={240} height={70} fill="#fff" stroke={touchIndex1 ? hitColor : "var(--ink)"} strokeWidth={touchIndex1 ? 2 : 1.5} />
              <Label x={512} y={226} lines="index shard 1" size={12} weight={600} anchor="start" />
              <Label x={728} y={226} lines="terms s–z" size={10} mono color="var(--ink-2)" anchor="end" />
              <Label x={512} y={250} lines={read ? "silver → 215, 780" : "silver → 215, 780, −603"} size={11} mono anchor="start" />
              <Label x={512} y={266} lines="white → 912" size={11} mono anchor="start" color="var(--ink-2)" />
            </g>
            {read ? (
              <>
                <Arrow pts={[120, 122, 180, 122, 180, 245, 240, 245]} color={hitKey} />
                {/* Labels sit beside the vertical run, never on it; the fetch lines stay above the group label. */}
                <Label x={172} y={200} lines="1 one shard" size={10} mono color={NEON.blue} anchor="end" />
                <Arrow pts={[360, 210, 360, 165, 300, 165, 300, 124]} dashed color="blue" width={1} />
                <Arrow pts={[360, 165, 560, 165, 560, 124]} dashed color="blue" width={1} />
                <Label x={430} y={150} lines="2 fetch 101, 342 from shard 0 · 603 from shard 1" size={10} mono color={NEON.blue} />
              </>
            ) : (
              <>
                {/* The record goes over the top of the data shards, not through shard 0. */}
                <Arrow pts={[120, 122, 180, 122, 180, 50, 620, 50, 620, 60]} color={hitKey} />
                <Label x={632} y={50} lines="record" size={10} mono color={NEON.orange} anchor="start" />
                <Arrow pts={[180, 122, 180, 245, 240, 245]} color={hitKey} />
                <Label x={172} y={200} lines="add term" size={10} mono color={NEON.orange} anchor="end" />
                <Arrow pts={[180, 245, 180, 310, 620, 310, 620, 280]} color={hitKey} label="remove old term" labelOffset={12} />
                <Label x={430} y={160} lines="3 shards for one write · one transaction" size={10} mono color={NEON.orange} />
              </>
            )}
          </>
        )}
      </Canvas>
    </Figure>
  );
}
