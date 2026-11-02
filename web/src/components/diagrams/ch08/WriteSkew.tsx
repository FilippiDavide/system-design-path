"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Box, Canvas, INK2, Label, NEON } from "../primitives";
import { Lifelines, Msg, Stepper, Toggle } from "./seq";

const A = 130;
const DB = 390;
const B = 650;
const TOTAL = 6;
const LEVELS = ["snapshot isolation", "serializable"] as const;

/**
 * Write skew: two doctors each check "at least two on call?", each
 * removes only themselves, both commit, nobody is on call. They never
 * touch the same row, so no lock and no lost-update detector fires.
 * Under serializable (SSI) the second commit is aborted because its
 * premise was invalidated by the first.
 */
export function WriteSkew() {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("snapshot isolation");
  const ssi = level === "serializable";
  const st = (i: number): "past" | "now" | "future" => (i < step - 1 ? "past" : i === step - 1 ? "now" : "future");

  // Committed on-call set after each step.
  const onCall = step >= 6 && !ssi ? [] : step >= 5 ? ["Bryce"] : ["Aaliyah", "Bryce"];

  const explain = [
    "Aaliyah and Bryce are the two doctors on call. Both feel ill and press 'go home' at the same moment. The rule: at least one doctor must stay.",
    "Aaliyah's transaction counts the doctors on call and sees 2. Her premise: 'it is safe for me to leave'.",
    "Bryce's transaction runs the same query on the same snapshot and also sees 2. Neither row has changed yet.",
    "Aaliyah updates her own row: off call. Only her row is locked; Bryce never needs it.",
    "Bryce updates his own row: off call. A different row, so no lock conflict and no lost-update detector fires.",
    "Aaliyah commits. From here on there is one doctor on call, which is still fine.",
    ssi
      ? "Bryce commits: SSI sees that a row he read (Aaliyah's) was written by a transaction that committed after his snapshot. His premise is outdated, so the commit is aborted and the application retries."
      : "Bryce commits. Both transactions were correct on their own, each saw 2, and yet nobody is on call. Write skew: no dirty write, no lost update, two different objects.",
  ][step];

  return (
    <Figure
      label="FIG 03"
      title={ssi ? "write skew · caught at commit by SSI" : "write skew · the doctors on call"}
      caption={
        <div className="space-y-2">
          <Stepper step={step} total={TOTAL} onStep={setStep}>
            <Toggle options={LEVELS} value={level} onChange={setLevel} />
          </Stepper>
          <p>{explain}</p>
        </div>
      }
    >
      <Canvas w={780} h={396}>
        <Lifelines
          cols={[
            { x: A, title: "Tx Aaliyah", sub: "wants to go home", accent: NEON.blue },
            { x: DB, title: "Database", sub: "on_call table" },
            { x: B, title: "Tx Bryce", sub: "wants to go home", accent: NEON.magenta },
          ]}
          top={16}
          bottom={366}
        />

        <Msg from={A} to={DB} y={98} text="how many on call?" state={st(0)} />
        <Msg from={DB} to={A} y={118} text="2" state={st(0)} reply below />

        <Msg from={B} to={DB} y={152} text="how many on call?" state={st(1)} color="magenta" />
        <Msg from={DB} to={B} y={172} text="2" state={st(1)} color="magenta" reply below />

        <Msg from={A} to={DB} y={208} text="Aaliyah off call" state={st(2)} />
        <Msg from={B} to={DB} y={238} text="Bryce off call" state={st(3)} color="magenta" />
        <Msg from={A} to={DB} y={268} text="commit" state={st(4)} />
        <Msg from={B} to={DB} y={298} text="commit" state={st(5)} color="magenta" />
        {ssi && (
          <Msg from={DB} to={B} y={318} text="abort: premise outdated" state={st(5)} color="magenta" reply below />
        )}

        {/* committed state */}
        <Label x={DB} y={354} lines="on call now" size={10} mono upper color={INK2} />
        {step >= 6 ? (
          <Box
            x={DB - 90}
            y={364}
            w={180}
            h={26}
            title={ssi ? "1 on call · Bryce" : "0 on call"}
            accent={ssi ? "var(--ok)" : "var(--bad)"}
            titleSize={11}
          />
        ) : (
          <Box x={DB - 90} y={364} w={180} h={26} title={`${onCall.length} on call · ${onCall.join(", ")}`} titleSize={11} />
        )}
      </Canvas>
    </Figure>
  );
}
