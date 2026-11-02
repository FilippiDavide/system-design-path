import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { HashModN } from "./HashModN";
import { RequestRouting } from "./RequestRouting";
import { SecondaryIndex } from "./SecondaryIndex";
import { KeyRangeLab } from "@/components/labs/ch07/KeyRangeLab";
import { RebalanceLab } from "@/components/labs/ch07/RebalanceLab";
import { HotKeyLab } from "@/components/labs/ch07/HotKeyLab";
import { SecondaryIndexLab } from "@/components/labs/ch07/SecondaryIndexLab";

/** Custom diagrams for chapter 07, by mermaid block index (0-based). */
export const ch07Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: HashModN,
  2: RequestRouting,
  3: SecondaryIndex,
};

/** Interactive labs for chapter 07, anchored to section ids. */
export const ch07Labs: LabEntry[] = [
  {
    id: "key-range-vs-hash",
    title: "Key range vs hash sharding",
    blurb: "Shard sensor readings by time, hash or sensor; write today's data and run range queries.",
    afterSection: "by-key-range",
    component: KeyRangeLab,
  },
  {
    id: "rebalancing",
    title: "Add a node and count the keys that move",
    blurb: "Compare hash mod N, fixed shards and consistent hashing when the cluster grows or shrinks.",
    afterSection: "by-hash-of-key",
    component: RebalanceLab,
  },
  {
    id: "hot-key",
    title: "A celebrity key and the suffix trick",
    blurb: "Pour writes onto one key, split it into 10 or 100 keys, and see what a read then costs.",
    afterSection: "skewed-load-and-hot-keys",
    component: HotKeyLab,
  },
  {
    id: "secondary-index",
    title: "Local vs global secondary index",
    blurb: "Run reads and a write against both layouts and count the shards each one touches.",
    afterSection: "4-secondary-indexes",
    component: SecondaryIndexLab,
  },
];
