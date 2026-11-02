import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { Compatibility } from "./Compatibility";
import { AvroResolution } from "./AvroResolution";
import { SchemaEvolutionLab } from "@/components/labs/ch05/SchemaEvolutionLab";
import { EncodingSizeLab } from "@/components/labs/ch05/EncodingSizeLab";
import { RollingUpgradeLab } from "@/components/labs/ch05/RollingUpgradeLab";

/** Custom diagrams for chapter 05, by mermaid block index (0-based). */
export const ch05Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: Compatibility,
  2: AvroResolution,
};

/** Interactive labs for chapter 05, anchored to section ids. */
export const ch05Labs: LabEntry[] = [
  {
    id: "schema-evolution",
    title: "Schema evolution rules",
    blurb: "Add, remove, rename or retag a field in Protobuf or Avro and see which direction of compatibility breaks.",
    afterSection: "avro-two-schemas",
    component: SchemaEvolutionLab,
  },
  {
    id: "encoding-size",
    title: "The same record, four encodings",
    blurb: "Edit a record, compare its size as JSON, MessagePack, Protobuf and Avro, and read every byte.",
    afterSection: "the-merits-of-schemas",
    component: EncodingSizeLab,
  },
  {
    id: "rolling-upgrade",
    title: "Rolling upgrade through a database",
    blurb: "Upgrade three app instances one at a time and find out which reads break and when a field silently disappears.",
    afterSection: "through-a-database",
    component: RollingUpgradeLab,
  },
];
