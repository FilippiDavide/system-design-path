"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Group, INK2, Label, NEON } from "../primitives";

type Mode = "pull" | "push" | "celebrity";

const MODES: { key: Mode; label: string; title: string; text: string }[] = [
  {
    key: "pull",
    label: "Pull",
    title: "pull: query and polling",
    text: "Nothing is precomputed. Every 5 s each online user re-runs a two-join query that looks up 200 followed accounts: cheap writes, 400 million lookups per second on the read side.",
  },
  {
    key: "push",
    label: "Push",
    title: "push: fan-out on write",
    text: "One post is copied into the mailbox of each of its 200 followers; the reader just reads its own cached timeline. About 1 million timeline writes per second, 400 times fewer than the pull lookups.",
  },
  {
    key: "celebrity",
    label: "Celebrity",
    title: "hybrid: celebrity posts merged at read time",
    text: "A post with millions of followers cannot be fanned out and cannot be dropped. It is stored once, separately, and merged into the follower's timeline when the timeline is read: push for the many, pull for the few.",
  },
];

/**
 * The timeline case study as one switchable picture: pull (query +
 * polling), push (fan-out into materialized timelines) and the hybrid
 * used for celebrities. Same nodes as the summary's flowchart, with
 * the numbers of the chapter next to the arrows.
 */
export function FanOut() {
  const [mode, setMode] = useState<Mode>("push");
  const m = MODES.find((x) => x.key === mode)!;

  return (
    <Figure
      label="FIG 02"
      title={m.title}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            {MODES.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setMode(x.key)}
                aria-pressed={mode === x.key}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  mode === x.key ? "bg-ink text-surface" : "hover:bg-surface-2"
                }`}
              >
                {x.label}
              </button>
            ))}
          </span>
          <span>{m.text}</span>
        </div>
      }
    >
      <Canvas w={780} h={300}>
        {mode === "pull" && (
          <>
            <Box x={30} y={120} w={110} h={56} title="User 1" sub="client" />
            <Arrow pts={[140, 138, 300, 138]} label="query every 5 s" labelOffset={-10} />
            <Arrow pts={[300, 160, 140, 160]} dashed color="soft" label="2 joins · 200 lookups" labelOffset={14} />
            <Cylinder x={300} y={90} w={190} h={110} title="Database" sub={"users · posts · follows"} accent={NEON.magenta} />
            <Box x={640} y={120} w={110} h={56} title="Post by A" sub="1 insert" />
            <Arrow pts={[640, 148, 490, 148]} />
            <Label x={395} y={236} lines={"10M online users ÷ 5 s = 2M queries/s"} size={11} mono color={INK2} />
            <Label x={395} y={262} lines={"× 200 lookups = 400M lookups/s"} size={12} weight={600} color={NEON.magenta} mono />
          </>
        )}

        {mode === "push" && (
          <>
            <Box x={30} y={128} w={110} h={56} title="Post by A" sub="5,800 posts/s" />
            <Arrow pts={[140, 156, 200, 156]} />
            <Box x={200} y={122} w={120} h={68} title="Fan-out" sub="× 200 followers" accent={NEON.blue} />
            {[30, 100].map((y, i) => (
              <g key={y}>
                <Arrow pts={[320, 156, 370, 156, 370, y + 25, 420, y + 25]} color="blue" />
                <Cylinder x={420} y={y} w={150} h={56} title={`Timeline follower ${i + 1}`} sub="mailbox" />
              </g>
            ))}
            <Label x={495} y={172} lines="· · ·" size={14} color={INK2} />
            <Arrow pts={[320, 156, 370, 156, 370, 215, 420, 215]} color="blue" />
            <Cylinder x={420} y={190} w={150} h={56} title="Timeline follower 200" sub="mailbox" />
            <Arrow pts={[570, 55, 640, 55]} dashed color="soft" />
            <Box x={640} y={27} w={110} h={56} title="User 1" sub="1 read" />
            <Label x={695} y={100} lines={["reads from", "the cache"]} size={10} mono color={INK2} />
            <Group x={405} y={22} w={180} h={226} label="materialized views" />
            <Label x={215} y={236} lines={["5,800 posts/s × 200", "= ~1M writes/s"]} size={12} weight={600} color={NEON.blue} mono />
            <Label x={300} y={272} lines={"deliveries queue at peak: late by seconds, reads stay fast"} size={11} mono color={INK2} />
          </>
        )}

        {mode === "celebrity" && (
          <>
            <Box x={30} y={30} w={110} h={56} title="Post by A" sub="200 followers" />
            <Arrow pts={[140, 58, 200, 58]} />
            <Box x={200} y={28} w={110} h={60} title="Fan-out" sub="× 200" accent={NEON.blue} />
            <Arrow pts={[310, 58, 400, 58]} color="blue" />
            <Cylinder x={400} y={33} w={150} h={56} title="Timeline user 1" sub="mailbox" />

            <Box x={30} y={190} w={110} h={60} title="Post by C" sub={"celebrity\n10M followers"} />
            <Arrow pts={[140, 220, 200, 220]} />
            <Box x={200} y={190} w={110} h={60} title="No fan-out" sub="stored once" accent={NEON.orange} dashed />
            <Arrow pts={[310, 220, 400, 220]} color="orange" />
            <Cylinder x={400} y={195} w={150} h={56} title="Celebrity posts" sub="separate store" accent={NEON.orange} />

            <Arrow pts={[550, 58, 590, 58, 590, 128, 620, 128]} dashed color="soft" />
            <Arrow pts={[550, 220, 590, 220, 590, 152, 620, 152]} dashed color="orange" />
            <Box x={620} y={108} w={140} h={66} title="User 1 reads" sub={"timeline ∪ celebrity\nmerge at read time"} accent={NEON.green} titleSize={12} />
            <Label x={390} y={140} lines={"follows A and C"} size={10} mono color={INK2} />
          </>
        )}
      </Canvas>
    </Figure>
  );
}
