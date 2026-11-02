import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { WhoUsesData } from "./WhoUsesData";
import { EtlPipeline } from "./EtlPipeline";
import { SystemOfRecord } from "./SystemOfRecord";
import { BuildOrBuy } from "./BuildOrBuy";
import { StorageCompute } from "./StorageCompute";
import { TimeoutQuestion } from "./TimeoutQuestion";
import { AccessPatternLab } from "@/components/labs/ch01/AccessPatternLab";
import { DerivedDataLab } from "@/components/labs/ch01/DerivedDataLab";
import { TimeoutLab } from "@/components/labs/ch01/TimeoutLab";
import { DistributeLab } from "@/components/labs/ch01/DistributeLab";

/** Custom diagrams for chapter 1, by mermaid block index. */
export const ch01Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: WhoUsesData,
  2: EtlPipeline,
  3: SystemOfRecord,
  4: BuildOrBuy,
  5: StorageCompute,
  6: TimeoutQuestion,
};

/** Interactive labs for chapter 1, anchored to section ids. */
export const ch01Labs: LabEntry[] = [
  {
    id: "access-pattern",
    title: "OLTP vs OLAP access patterns",
    blurb: "Run a point query and an aggregate over the same table and count what gets touched.",
    afterSection: "oltp-vs-olap",
    component: AccessPatternLab,
  },
  {
    id: "derived-data",
    title: "System of record and derived data",
    blurb: "Write to the source, watch the copies lag, break one and rebuild it from the source.",
    afterSection: "system-of-record-vs-derived-data",
    component: DerivedDataLab,
  },
  {
    id: "distribute",
    title: "Should you distribute?",
    blurb: "Tick the reasons that apply and see the costs you sign up for.",
    afterSection: "nine-reasons-to-distribute",
    component: DistributeLab,
  },
  {
    id: "timeout",
    title: "Timeout and retry",
    blurb: "Send requests over a lossy network and find out why a retry can double-charge.",
    afterSection: "the-price",
    component: TimeoutLab,
  },
];
