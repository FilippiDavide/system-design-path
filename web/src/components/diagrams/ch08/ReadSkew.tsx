"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Box, Canvas, INK2, Label, NEON } from "../primitives";
import { Lifelines, Msg, Stepper, Toggle } from "./seq";

const A = 130;
const DB = 390;
const T = 650;
const TOTAL = 4;
const LEVELS = ["read committed", "snapshot isolation"] as const;

/**
 * Read skew: Aaliyah reads two accounts while a transfer commits in
 * between. Every value she sees was committed, yet the total is wrong.
 * Toggle to snapshot isolation and the second read comes from the
 * snapshot taken at the start, so the total adds up.
 */
export function ReadSkew() {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("read committed");
  const si = level === "snapshot isolation";
  const st = (i: number): "past" | "now" | "future" => (i < step - 1 ? "past" : i === step - 1 ? "now" : "future");
  const transferred = step >= 2;
  const second = si ? 500 : 400;

  const explain = [
    "Aaliyah has 500 in each account. A transfer of 100 from account 2 to account 1 is about to run concurrently with her balance check.",
    "She reads account 1 and gets 500. The transfer has not committed yet, so under both levels this is the committed value.",
    "The transfer writes 600 and 400 and commits. Both values are now committed; nothing is dirty.",
    si
      ? "She reads account 2 from the snapshot taken when her transaction started: 500, even though 400 has been committed since."
      : "She reads account 2 and gets 400: the committed value, read committed is satisfied, and yet it comes from after the transfer.",
    si
      ? "Total 1000. Both reads come from the same instant, which is what a backup or a long analytic query needs."
      : "Total 900, 100 appear to be missing. Read skew: the two reads come from different instants. Tolerable for a web page, fatal for a backup.",
  ][step];

  return (
    <Figure
      label="FIG 02"
      title={si ? "read skew · prevented by a snapshot" : "read skew under read committed"}
      caption={
        <div className="space-y-2">
          <Stepper step={step} total={TOTAL} onStep={setStep}>
            <Toggle options={LEVELS} value={level} onChange={setLevel} />
          </Stepper>
          <p>{explain}</p>
        </div>
      }
    >
      <Canvas w={780} h={330}>
        <Lifelines
          cols={[
            { x: A, title: "Aaliyah", sub: "reads balances", accent: NEON.blue },
            { x: DB, title: "Database" },
            { x: T, title: "Transfer", sub: "100 from 2 to 1", accent: NEON.orange },
          ]}
          top={16}
          bottom={300}
        />

        {/* 1 · first read */}
        <Msg from={A} to={DB} y={96} text="account 1?" state={st(0)} />
        <Msg from={DB} to={A} y={118} text="500" state={st(0)} reply below />

        {/* 2 · the transfer commits */}
        <Msg from={T} to={DB} y={150} text="account 1 = 600 · account 2 = 400" state={st(1)} color="orange" />
        <Msg from={DB} to={T} y={172} text="commit" state={st(1)} color="orange" reply below />

        {/* 3 · second read */}
        <Msg from={A} to={DB} y={206} text="account 2?" state={st(2)} />
        <Msg from={DB} to={A} y={228} text={String(second)} state={st(2)} reply below />

        {/* 4 · the total */}
        {step >= 4 ? (
          <Box
            x={A - 70}
            y={250}
            w={140}
            h={40}
            title={si ? "total 1000" : "total 900"}
            sub={si ? "consistent" : "100 missing"}
            accent={si ? "var(--ok)" : "var(--bad)"}
            titleSize={12}
          />
        ) : (
          <Box x={A - 70} y={250} w={140} h={40} title="total ?" dashed titleSize={12} />
        )}

        {/* committed state of the database */}
        <Label x={DB} y={262} lines="committed" size={10} mono upper color={INK2} />
        <Label
          x={DB}
          y={282}
          lines={transferred ? "acct 1 = 600 · acct 2 = 400" : "acct 1 = 500 · acct 2 = 500"}
          size={11}
          mono
          color={transferred ? NEON.orange : INK2}
        />
        {si && step >= 1 && (
          <>
            <Label x={T} y={262} lines="aaliyah's snapshot" size={10} mono upper color={NEON.blue} />
            <Label x={T} y={282} lines="acct 1 = 500 · acct 2 = 500" size={11} mono color={NEON.blue} />
          </>
        )}
      </Canvas>
    </Figure>
  );
}
