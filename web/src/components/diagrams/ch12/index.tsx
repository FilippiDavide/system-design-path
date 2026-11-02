import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { LogBasedBroker } from "./LogBasedBroker";
import { DualWrite } from "./DualWrite";
import { LogBrokerLab } from "@/components/labs/ch12/LogBrokerLab";
import { CdcLab } from "@/components/labs/ch12/CdcLab";
import { WindowsLab } from "@/components/labs/ch12/WindowsLab";
import { StreamJoinLab } from "@/components/labs/ch12/StreamJoinLab";

/** Custom diagrams for chapter 12, by mermaid block index (0-based). */
export const ch12Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: LogBasedBroker,
  2: DualWrite,
};

/** Interactive labs for chapter 12, anchored to section ids. */
export const ch12Labs: LabEntry[] = [
  {
    id: "log-broker",
    title: "Log-based broker vs message queue",
    blurb: "Produce, read, crash a consumer: replay from an offset versus redelivery after a lost ack.",
    afterSection: "log-based-brokers",
    component: LogBrokerLab,
  },
  {
    id: "cdc",
    title: "Change data capture and compaction",
    blurb: "Write to a database, feed a cache and an index from its log, compact it and rebuild from offset 0.",
    afterSection: "change-data-capture",
    component: CdcLab,
  },
  {
    id: "windows",
    title: "Event time, windows and watermarks",
    blurb: "Push on-time and late events into four kinds of window and replay a backlog to see a false spike.",
    afterSection: "reasoning-about-time",
    component: WindowsLab,
  },
  {
    id: "stream-joins",
    title: "Three stream joins",
    blurb: "Push scripted events into stream-stream, stream-table and table-table joins and watch the state.",
    afterSection: "stream-joins",
    component: StreamJoinLab,
  },
];
