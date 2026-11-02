import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { LsmTree } from "./LsmTree";
import { BTreePages } from "./BTreePages";
import { RowVsColumn } from "./RowVsColumn";
import { HashIndexLab } from "@/components/labs/ch04/HashIndexLab";
import { LsmTreeLab } from "@/components/labs/ch04/LsmTreeLab";
import { BTreeLab } from "@/components/labs/ch04/BTreeLab";
import { ColumnStoreLab } from "@/components/labs/ch04/ColumnStoreLab";

/** Custom diagrams for chapter 04, by mermaid block index (0-based). */
export const ch04Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: LsmTree,
  2: BTreePages,
  3: RowVsColumn,
};

/** Interactive labs for chapter 04, anchored to section ids. */
export const ch04Labs: LabEntry[] = [
  {
    id: "hash-index",
    title: "Append-only log with a hash index",
    blurb: "Append, overwrite and look up records; restart, compact, and try a range query.",
    afterSection: "first-step-an-in-memory-hash-index",
    component: HashIndexLab,
  },
  {
    id: "lsm-tree",
    title: "LSM-tree: memtable, segments, Bloom",
    blurb: "Put keys until the memtable flushes, read through the segments, delete, compact.",
    afterSection: "bloom-filter",
    component: LsmTreeLab,
  },
  {
    id: "b-tree",
    title: "B-tree page splits and the WAL",
    blurb: "Insert keys, watch pages split, then crash mid-split with and without a log.",
    afterSection: "making-it-reliable",
    component: BTreeLab,
  },
  {
    id: "column-store",
    title: "Row vs column layout and bitmaps",
    blurb: "Run an aggregate in both layouts, count bytes read, sort and watch the bitmap compress.",
    afterSection: "sort-order",
    component: ColumnStoreLab,
  },
];
