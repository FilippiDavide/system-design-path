import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { FanOut } from "./FanOut";
import { RetryStorm } from "./RetryStorm";
import { FourWordsForTime } from "./FourWordsForTime";
import { FaultVsFailure } from "./FaultVsFailure";
import { ThreeArchitectures } from "./ThreeArchitectures";
import { FanOutLab } from "@/components/labs/ch02/FanOutLab";
import { RetryStormLab } from "@/components/labs/ch02/RetryStormLab";
import { TailLatencyLab } from "@/components/labs/ch02/TailLatencyLab";
import { FaultToleranceLab } from "@/components/labs/ch02/FaultToleranceLab";

/** Custom diagrams for chapter 02, by mermaid block index (0-based). */
export const ch02Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: FanOut,
  2: RetryStorm,
  3: FourWordsForTime,
  4: FaultVsFailure,
  5: ThreeArchitectures,
};

/** Interactive labs for chapter 02, anchored to section ids. */
export const ch02Labs: LabEntry[] = [
  {
    id: "fan-out",
    title: "Timeline fan-out: push, pull, hybrid",
    blurb: "Post with 10 to 20M followers and see what each side pays, and why celebrities break push.",
    afterSection: "1-case-study-the-home-timeline-of-a-social-network",
    component: FanOutLab,
  },
  {
    id: "retry-storm",
    title: "Retry storm and metastable failure",
    blurb: "Spike a server, watch retries keep it down after the spike, then break the loop.",
    afterSection: "when-an-overloaded-system-wont-recover",
    component: RetryStormLab,
  },
  {
    id: "tail-latency",
    title: "Percentiles and tail latency amplification",
    blurb: "Sample 1,000 response times, read p50/p95/p99, then fan out and watch the page's tail grow.",
    afterSection: "average-median-percentiles",
    component: TailLatencyLab,
  },
  {
    id: "fault-tolerance",
    title: "Independent vs correlated faults",
    blurb: "Run a year on 12 nodes with limited tolerance, then wake a bug on every node at once.",
    afterSection: "software-faults-rare-but-correlated",
    component: FaultToleranceLab,
  },
];
