"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Box, Canvas, Dot, Group, Label, NEON } from "../primitives";
import { Lifelines, Msg, Stepper, Toggle } from "./seq";

const C = 130;
const P1 = 390;
const P2 = 650;
const TOTAL = 6;
// Labels of coordinator/P2 messages, kept off participant 1's lifeline.
const LX2 = (P1 + P2) / 2;
const VOTES = ["all yes", "P2 says no"] as const;

/**
 * Two-phase commit as a sequence with its two points of no return: a
 * participant that votes yes gives up the right to abort, and the
 * coordinator's decision record on disk is the commit point. Toggle one
 * "no" vote to see the same protocol end in an abort for everyone.
 */
export function TwoPhaseCommit() {
  const [step, setStep] = useState(0);
  const [vote, setVote] = useState<(typeof VOTES)[number]>("all yes");
  const no = vote === "P2 says no";
  const st = (i: number): "past" | "now" | "future" => (i < step - 1 ? "past" : i === step - 1 ? "now" : "future");
  const decision = no ? "abort" : "commit";

  const explain = [
    "A transaction has written rows on two participants (two shards, or a database and a message broker). The coordinator must get both to commit, or neither.",
    "Phase 1. The coordinator sends prepare with the transaction id. Each participant checks its constraints and writes everything it would need to commit to disk.",
    "Participant 1 votes yes. Point of no return 1: it has promised it can commit, whatever happens next. A crash or a full disk are no longer valid excuses.",
    no
      ? "Participant 2 finds a violated constraint and votes no. It can still abort on its own: the promise is only made with a yes."
      : "Participant 2 votes yes as well. Both have surrendered the right to abort and now wait for the decision.",
    no
      ? "The coordinator records abort in its own log. One no is enough: the decision is all or nothing."
      : "The coordinator writes commit to its own log on disk. Point of no return 2, the commit point: from here it must retry forever until every participant has applied the decision.",
    no
      ? "Phase 2. Abort is sent to everyone; participant 1 undoes what it had prepared."
      : "Phase 2. Commit is sent to everyone. If a participant is down, the coordinator keeps resending: the decision cannot be retracted.",
    no
      ? "Both acknowledge. Nothing from this transaction is visible anywhere."
      : "Both acknowledge. If a participant crashed after voting yes and before hearing the decision, it is in doubt and asks the coordinator for the outcome by transaction id.",
  ][step];

  return (
    <Figure
      label="FIG 04"
      title={no ? "two-phase commit · one no, everybody aborts" : "two-phase commit · two points of no return"}
      caption={
        <div className="space-y-2">
          <Stepper step={step} total={TOTAL} onStep={setStep}>
            <Toggle options={VOTES} value={vote} onChange={setVote} />
          </Stepper>
          <p>{explain}</p>
        </div>
      }
    >
      <Canvas w={780} h={384}>
        <Lifelines
          cols={[
            { x: C, title: "Coordinator", sub: "transaction manager", accent: NEON.violet },
            { x: P1, title: "Participant 1", sub: "shard or database" },
            { x: P2, title: "Participant 2", sub: "shard or broker" },
          ]}
          top={16}
          bottom={368}
          w={150}
        />

        <Group x={40} y={86} w={700} h={118} label="phase 1 · votes" />
        <Msg from={C} to={P1} y={104} text="prepare (tx id)" state={st(0)} color="violet" />
        <Msg from={C} to={P2} y={124} text="prepare (tx id)" state={st(0)} color="violet" below lx={LX2} />

        <Msg from={P1} to={C} y={160} text="yes · written to disk, I can commit" state={st(1)} color="green" reply />
        {step >= 2 && (
          <>
            <Dot x={P1} y={160} r={5} color={NEON.orange} />
            <Label x={P1 + 12} y={160} lines="no way back for P1" size={10} mono color={NEON.orange} anchor="start" />
          </>
        )}
        <Msg
          from={P2}
          to={C}
          y={190}
          text={no ? "no · constraint violated" : "yes"}
          state={st(2)}
          color={no ? "orange" : "green"}
          reply
          lx={LX2}
        />
        {step >= 3 && !no && <Dot x={P2} y={190} r={5} color={NEON.orange} />}

        {/* the decision */}
        {step >= 4 ? (
          <Box
            x={C - 80}
            y={206}
            w={160}
            h={40}
            title={`decision: ${decision}`}
            sub={no ? "in the log" : "in the log · commit point"}
            accent={no ? "var(--bad)" : NEON.orange}
            titleSize={12}
          />
        ) : (
          <Box x={C - 80} y={206} w={160} h={40} title="decision: ?" sub="not yet in the log" dashed titleSize={12} />
        )}
        {step >= 4 && !no && <Label x={C + 92} y={226} lines="no way back for anyone" size={10} mono color={NEON.orange} anchor="start" />}

        <Group x={40} y={272} w={700} h={96} label="phase 2 · decision" />
        <Msg from={C} to={P1} y={290} text={decision} state={st(4)} color={no ? "orange" : "violet"} />
        <Msg from={C} to={P2} y={310} text={decision} state={st(4)} color={no ? "orange" : "violet"} below lx={LX2} />
        <Msg from={P1} to={C} y={338} text="ok" state={st(5)} color="green" reply />
        <Msg from={P2} to={C} y={356} text="ok" state={st(5)} color="green" reply below lx={LX2} />
      </Canvas>
    </Figure>
  );
}
