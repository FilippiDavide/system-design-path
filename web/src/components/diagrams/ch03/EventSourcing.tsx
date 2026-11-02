"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Label, NEON } from "../primitives";

interface Step {
  title: string;
  note: string;
}

const STEPS: Step[] = [
  {
    title: "a command arrives",
    note: "'Book 2 seats for Ada' is a command: a request, not yet a fact. It can still be refused.",
  },
  {
    title: "validate",
    note: "Are there 2 seats left? Only a valid command becomes an event. The log never contains anything a view could reject.",
  },
  {
    title: "append the event",
    note: "SeatsWereBooked(ada, 2) is appended, in the past tense: it happened, and it stays true even if a later event cancels it. The log is immutable and it is the source of truth.",
  },
  {
    title: "update the views",
    note: "Each view folds the new event into its own shape: booking state, organizer dashboard, a flat file for the badges. Same facts, several read models (CQRS).",
  },
  {
    title: "rebuild a broken view",
    note: "A bug in the dashboard? Delete the view and replay the log with fixed code. Views are derived, so nothing is lost. Replay must be deterministic: no exchange rate fetched at replay time, no email re-sent.",
  },
  {
    title: "a cancellation is another event",
    note: "BookingWasCancelled(bob) is appended; e1 is not edited. Order matters: every view must see e1 before e3, which is hard across machines (ch. 10).",
  },
];

const LOG = ["e1 SeatsWereBooked(bob, 1)", "e2 SeatsWereBooked(ada, 2)", "e3 BookingWasCancelled(bob)"];

const VIEWS = [
  { key: "state", title: "View: booking state", y: 30 },
  { key: "dash", title: "View: organizer dashboard", y: 118 },
  { key: "badges", title: "View: file for the badges", y: 206 },
];

/**
 * Event sourcing and CQRS as a six-step walkthrough: a command is
 * validated into an immutable event, every view derives its own shape
 * from the log, and a broken view is fixed by replaying.
 */
export function EventSourcing() {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  const logVisible = i >= 2 ? (i >= 5 ? 3 : 2) : 1;
  const viewsFresh = i >= 3;
  const rebuilding = i === 4;

  const viewSub = (key: string) => {
    const booked = i >= 5 ? "ada: 2" : viewsFresh ? "ada: 2 · bob: 1" : "bob: 1";
    const seats = i >= 5 ? 2 : viewsFresh ? 3 : 1;
    if (key === "state") return booked;
    if (key === "dash") return rebuilding ? "replaying e1..e2" : `${seats} seats sold`;
    return viewsFresh ? (i >= 5 ? "ada.csv" : "bob.csv · ada.csv") : "bob.csv";
  };

  return (
    <Figure
      label="FIG 06"
      title={`step ${i + 1}/${STEPS.length} · ${s.title}`}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            <button
              type="button"
              onClick={() => setI((n) => Math.max(0, n - 1))}
              disabled={i === 0}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setI((n) => Math.min(STEPS.length - 1, n + 1))}
              disabled={i === STEPS.length - 1}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-surface disabled:opacity-40"
            >
              Next
            </button>
          </span>
          <span>{s.note}</span>
        </div>
      }
    >
      <Canvas w={800} h={310}>
        <Box
          x={30}
          y={110}
          w={140}
          h={60}
          title="Command"
          sub={i >= 5 ? "cancel bob" : "book 2 seats, ada"}
          accent={i <= 1 || i === 5 ? NEON.orange : undefined}
          titleSize={12}
        />
        <Arrow pts={[170, 140, 240, 140]} color={i === 1 ? "orange" : i === 2 || i === 5 ? "blue" : "ink"} width={i === 1 ? 2 : 1.5} />
        <Label x={205} y={124} lines="validate" size={10} mono color={i === 1 ? NEON.orange : "var(--ink-2)"} />
        {/* short on purpose: it has to fit the 70px gap between the box and the log */}
        {i === 1 && <Label x={205} y={156} lines="2 left ✓" size={10} mono color="var(--ok)" />}

        <Cylinder x={240} y={62} w={180} h={156} title="Event log" sub="immutable · source of truth" accent={NEON.blue} />
        {LOG.slice(0, logVisible).map((line, k) => (
          <Label
            key={line}
            x={330}
            y={94 + k * 14}
            lines={line}
            size={10}
            mono
            color={(i === 2 && k === 1) || (i === 5 && k === 2) ? NEON.blue : "var(--ink)"}
          />
        ))}

        {VIEWS.map((v) => {
          const broken = rebuilding && v.key === "dash";
          return (
            <g key={v.key}>
              <Arrow pts={[420, 140, 470, 140, 470, v.y + 25, 540, v.y + 25]} color={broken ? "magenta" : i === 3 ? "green" : "ink"} width={i === 3 ? 2 : 1.5} />
              <Cylinder
                x={540}
                y={v.y}
                w={210}
                h={52}
                title={v.title}
                sub={viewSub(v.key)}
                accent={broken ? "var(--bad)" : i === 3 ? NEON.green : undefined}
              />
              <Arrow
                pts={[750, v.y + 32, 775, v.y + 32, 775, 290, 330, 290, 330, 218]}
                dashed
                color={broken ? "magenta" : "soft"}
                width={broken ? 2 : 1}
              />
            </g>
          );
        })}
        <Label x={560} y={302} lines="recomputable from scratch · replay the log" size={10} mono color={rebuilding ? NEON.magenta : "var(--ink-2)"} />
      </Canvas>
    </Figure>
  );
}
