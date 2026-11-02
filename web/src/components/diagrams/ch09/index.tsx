import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { NoResponse } from "./NoResponse";
import { FencingToken } from "./FencingToken";
import { TimeoutDetectionLab } from "@/components/labs/ch09/TimeoutDetectionLab";
import { ClockSkewLab } from "@/components/labs/ch09/ClockSkewLab";
import { LeaseZombieLab } from "@/components/labs/ch09/LeaseZombieLab";
import { MajorityLab } from "@/components/labs/ch09/MajorityLab";

/** Custom diagrams for chapter 09, by mermaid block index (0-based). */
export const ch09Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: NoResponse,
  2: FencingToken,
};

/** Interactive labs for chapter 09, anchored to section ids. */
export const ch09Labs: LabEntry[] = [
  {
    id: "timeout-detection",
    title: "Timeout and failure detection",
    blurb: "Pick a timeout against a jittery, lossy network and count the live nodes you declare dead.",
    afterSection: "how-long-the-timeout",
    component: TimeoutDetectionLab,
  },
  {
    id: "clock-skew",
    title: "Clock skew and last write wins",
    blurb: "Skew two clocks, order two writes with LWW and lose an increment; time a call across an NTP step.",
    afterSection: "timestamps-for-ordering-lww",
    component: ClockSkewLab,
  },
  {
    id: "lease-zombie",
    title: "Lease, GC pause and fencing token",
    blurb: "Pause a leader past its lease, watch the stale write land, then fence it off at the storage.",
    afterSection: "process-pauses",
    component: LeaseZombieLab,
  },
  {
    id: "majority",
    title: "Who may declare whom dead",
    blurb: "Partition five nodes by hand and see which side can keep going; add a liar and watch the rule break.",
    afterSection: "the-majority-rules",
    component: MajorityLab,
  },
];
