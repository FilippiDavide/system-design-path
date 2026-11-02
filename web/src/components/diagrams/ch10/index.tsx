import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { LinearizableHistory } from "./LinearizableHistory";
import { ConsensusFaces } from "./ConsensusFaces";
import { TwoRoundsVoting } from "./TwoRoundsVoting";
import { LinearizabilityLab } from "@/components/labs/ch10/LinearizabilityLab";
import { LogicalClocksLab } from "@/components/labs/ch10/LogicalClocksLab";
import { TwoPhaseCommitLab } from "@/components/labs/ch10/TwoPhaseCommitLab";
import { RaftLab } from "@/components/labs/ch10/RaftLab";

/** Custom diagrams for chapter 10, by mermaid block index (0-based). */
export const ch10Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: LinearizableHistory,
  2: ConsensusFaces,
  3: TwoRoundsVoting,
};

/** Interactive labs for chapter 10, anchored to section ids. */
export const ch10Labs: LabEntry[] = [
  {
    id: "linearizability-checker",
    title: "Linearizability checker",
    blurb: "Shift reads around one write, pick what they return, and see whether the history is still linearizable.",
    afterSection: "what-makes-it-linearizable",
    component: LinearizabilityLab,
  },
  {
    id: "logical-clocks",
    title: "Lamport clocks vs vector clocks",
    blurb: "Post and send messages between three nodes; compare two events and see what each clock can and cannot tell you.",
    afterSection: "lamport-clocks",
    component: LogicalClocksLab,
  },
  {
    id: "two-phase-commit",
    title: "2PC coordinator crash vs consensus",
    blurb: "Run a commit across three participants, crash the coordinator after prepare and watch the locks stay held.",
    afterSection: "the-many-faces",
    component: TwoPhaseCommitLab,
  },
  {
    id: "raft-election",
    title: "Leader election and log replication",
    blurb: "Five nodes with terms and heartbeats: kill or isolate the leader, see the election and the stale entries overwritten.",
    afterSection: "from-single-leader-to-consensus",
    component: RaftLab,
  },
];
