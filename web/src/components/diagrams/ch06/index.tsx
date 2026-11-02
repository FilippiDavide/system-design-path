import type { ComponentType } from "react";
import type { LabEntry } from "@/components/registry";
import { ChapterMap } from "./ChapterMap";
import { SingleLeader } from "./SingleLeader";
import { ReadYourWrites } from "./ReadYourWrites";
import { QuorumOverlap } from "./QuorumOverlap";
import { LeaderFailoverLab } from "@/components/labs/ch06/LeaderFailoverLab";
import { ReplicationLagLab } from "@/components/labs/ch06/ReplicationLagLab";
import { MultiLeaderLab } from "@/components/labs/ch06/MultiLeaderLab";
import { QuorumLab } from "@/components/labs/ch06/QuorumLab";

/** Custom diagrams for chapter 06, by mermaid block index (0-based). */
export const ch06Diagrams: Record<number, ComponentType> = {
  0: ChapterMap,
  1: SingleLeader,
  2: ReadYourWrites,
  3: QuorumOverlap,
};

/** Interactive labs for chapter 06, anchored to section ids. */
export const ch06Labs: LabEntry[] = [
  {
    id: "leader-failover",
    title: "Failover and lost writes",
    blurb: "Write to a leader, kill it mid-replication and count the acknowledged writes that vanish.",
    afterSection: "when-a-node-goes-down",
    component: LeaderFailoverLab,
  },
  {
    id: "replication-lag",
    title: "Replication lag anomalies",
    blurb: "Step through the three anomalies, then switch on the guarantee that prevents each one.",
    afterSection: "consistent-prefix-reads",
    component: ReplicationLagLab,
  },
  {
    id: "multi-leader-conflicts",
    title: "Multi-leader conflicts",
    blurb: "Edit the same cart on two leaders and compare what LWW, siblings and a CRDT throw away.",
    afterSection: "conflicting-writes",
    component: MultiLeaderLab,
  },
  {
    id: "quorum",
    title: "Leaderless quorum",
    blurb: "Pick w and r, write, take nodes down and see when a read misses the latest value.",
    afterSection: "the-limitations-of-quorums",
    component: QuorumLab,
  },
];
