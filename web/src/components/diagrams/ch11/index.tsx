import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { Orchestrator } from "./Orchestrator";
import { Shuffle } from "./Shuffle";
import { UnixPipelineLab } from "@/components/labs/ch11/UnixPipelineLab";
import { DataflowLab } from "@/components/labs/ch11/DataflowLab";
import { MapReduceLab } from "@/components/labs/ch11/MapReduceLab";
import { JoinLab } from "@/components/labs/ch11/JoinLab";

/** Custom diagrams for chapter 11, by mermaid block index (0-based). */
export const ch11Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: Orchestrator,
  2: Shuffle,
};

/** Interactive labs for chapter 11, anchored to section ids. */
export const ch11Labs: LabEntry[] = [
  {
    id: "unix-pipeline",
    title: "A Unix pipeline, one stage at a time",
    blurb: "Change the awk field and the head count, tap a stage and watch the stream; the log file never changes.",
    afterSection: "2-batch-processing-with-unix-tools",
    component: UnixPipelineLab,
  },
  {
    id: "mapreduce-by-hand",
    title: "MapReduce by hand",
    blurb: "Map eight log lines, partition by hash(key), merge at the reducers and sum; switch 2 or 3 reducers.",
    afterSection: "mapreduce",
    component: MapReduceLab,
  },
  {
    id: "dataflow-vs-mapreduce",
    title: "Intermediate state: DFS, memory, checkpoint",
    blurb: "Run one job on MapReduce, Spark and Flink, kill a node mid-run and count what each engine redoes.",
    afterSection: "dataflow-engines",
    component: DataflowLab,
  },
  {
    id: "batch-joins",
    title: "Sort-merge join vs broadcast hash join",
    blurb: "Join events with users through the shuffle or by broadcasting the small table; make one user hot.",
    afterSection: "joins-and-group-by",
    component: JoinLab,
  },
];
