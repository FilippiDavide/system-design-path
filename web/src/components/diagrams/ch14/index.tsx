import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { FeedbackLoopLab } from "@/components/labs/ch14/FeedbackLoopLab";
import { DataRetentionLab } from "@/components/labs/ch14/DataRetentionLab";

/** Custom diagrams for chapter 14, by mermaid block index (0-based). */
export const ch14Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
};

/** Interactive labs for chapter 14, anchored to section ids. */
export const ch14Labs: LabEntry[] = [
  {
    id: "feedback-loop",
    title: "Feedback loops in predictive systems",
    blurb: "Pick the proxy a decision is based on and watch the share labelled risky drift away from the actual rate.",
    afterSection: "feedback-loops",
    component: FeedbackLoopLab,
  },
  {
    id: "data-retention",
    title: "Data minimization and erasure",
    blurb: "Toggle purpose limitation, retention and sharing, then request erasure and see which copies survive.",
    afterSection: "3-legislation-and-self-regulation",
    component: DataRetentionLab,
  },
];
