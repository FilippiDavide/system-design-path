import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { Layers } from "./Layers";
import { OneToMany } from "./OneToMany";
import { StarSchema } from "./StarSchema";
import { LucyGraph } from "./LucyGraph";
import { EventSourcing } from "./EventSourcing";
import { DecisionTree } from "./DecisionTree";
import { DeclarativeLab } from "@/components/labs/ch03/DeclarativeLab";
import { NormalizationLab } from "@/components/labs/ch03/NormalizationLab";
import { SchemaLab } from "@/components/labs/ch03/SchemaLab";
import { GraphTraversalLab } from "@/components/labs/ch03/GraphTraversalLab";

/** Custom diagrams for chapter 03, by mermaid block index (0-based). */
export const ch03Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: Layers,
  2: OneToMany,
  3: StarSchema,
  4: LucyGraph,
  5: EventSourcing,
  6: DecisionTree,
};

/** Interactive labs for chapter 03, anchored to section ids. */
export const ch03Labs: LabEntry[] = [
  {
    id: "declarative-query",
    title: "What vs how: who owns the plan?",
    blurb: "Ask the same question in SQL and as a loop, add an index, and see which text you have to rewrite.",
    afterSection: "0-the-layers",
    component: DeclarativeLab,
  },
  {
    id: "normalization",
    title: "ID or text: the cost of a rename",
    blurb: "Rename a region in a normalized and a denormalized store and count the rows each write touches.",
    afterSection: "normalization-id-or-text",
    component: NormalizationLab,
  },
  {
    id: "schema-on-read",
    title: "Add a field: on write vs on read",
    blurb: "Split name into first and last in both models and watch the migration against the read path.",
    afterSection: "schema-on-read-vs-schema-on-write",
    component: SchemaLab,
  },
  {
    id: "graph-traversal",
    title: "Who emigrated from the US to Europe?",
    blurb: "Run the Cypher query one step at a time and watch WITHIN*0.. climb the graph for each person.",
    afterSection: "property-graphs-and-cypher",
    component: GraphTraversalLab,
  },
];
