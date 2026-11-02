import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { WriteReadPath } from "./WriteReadPath";
import { UniquenessLog } from "./UniquenessLog";
import { UnbundledDatabaseLab } from "@/components/labs/ch13/UnbundledDatabaseLab";
import { RequestIdLab } from "@/components/labs/ch13/RequestIdLab";
import { MultishardPaymentLab } from "@/components/labs/ch13/MultishardPaymentLab";

/** Custom diagrams for chapter 13, by mermaid block index (0-based). */
export const ch13Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: WriteReadPath,
  2: UniquenessLog,
};

/** Interactive labs for chapter 13, anchored to section ids. */
export const ch13Labs: LabEntry[] = [
  {
    id: "unbundled-database",
    title: "Unbundling the database",
    blurb: "Subscribe derived views to one log, add and remove them freely, then switch to dual writes and watch them drift.",
    afterSection: "making-unbundling-work",
    component: UnbundledDatabaseLab,
  },
  {
    id: "end-to-end-request-id",
    title: "End-to-end request ID",
    blurb: "Resubmit a $11 transfer after a lost response and see which layer can stop the double charge.",
    afterSection: "the-end-to-end-argument",
    component: RequestIdLab,
  },
  {
    id: "multishard-payment",
    title: "Multishard payment without 2PC",
    blurb: "Run a payment across three sharded logs, crash the processor halfway and check that the money still adds up.",
    afterSection: "enforcing-constraints",
    component: MultishardPaymentLab,
  },
];
