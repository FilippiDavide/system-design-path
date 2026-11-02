import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { ReadSkew } from "./ReadSkew";
import { WriteSkew } from "./WriteSkew";
import { TwoPhaseCommit } from "./TwoPhaseCommit";
import { MvccLab } from "@/components/labs/ch08/MvccLab";
import { IsolationAnomaliesLab } from "@/components/labs/ch08/IsolationAnomaliesLab";
import { DoctorsLab } from "@/components/labs/ch08/DoctorsLab";
import { SerializableLab } from "@/components/labs/ch08/SerializableLab";

/** Custom diagrams for chapter 08, by mermaid block index (0-based). */
export const ch08Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: ReadSkew,
  2: WriteSkew,
  3: TwoPhaseCommit,
};

/** Interactive labs for chapter 08, anchored to section ids. */
export const ch08Labs: LabEntry[] = [
  {
    id: "mvcc-snapshot",
    title: "MVCC: one row, many versions",
    blurb: "Open a snapshot, let writers commit and abort around it, and see which version the reader gets and why.",
    afterSection: "snapshot-isolation",
    component: MvccLab,
  },
  {
    id: "isolation-anomalies",
    title: "Race two transactions by hand",
    blurb: "Interleave two transactions step by step under five isolation levels and watch each anomaly appear or get stopped.",
    afterSection: "lost-update",
    component: IsolationAnomaliesLab,
  },
  {
    id: "doctors-on-call",
    title: "Write skew: four ways to stop it",
    blurb: "Replay the doctors and the meeting room under FOR UPDATE, a materialized conflict and SSI.",
    afterSection: "write-skew-and-phantoms",
    component: DoctorsLab,
  },
  {
    id: "serializable-strategies",
    title: "Serial, 2PL or SSI: tick by tick",
    blurb: "Schedule the same three transactions three ways and count waits, a deadlock and an abort at commit.",
    afterSection: "serializable-snapshot-isolation",
    component: SerializableLab,
  },
];
