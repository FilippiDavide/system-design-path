"use client";

import { useState } from "react";
import { Figure } from "@/components/study/Figure";
import { Arrow, Box, Canvas, Cylinder, Label, NEON } from "../primitives";

type Color = "ink" | "soft" | "blue" | "magenta" | "green" | "violet" | "orange";

const STEPS: { title: string; text: string }[] = [
  {
    title: "a job request arrives",
    text: "The request says what the job needs: how many tasks, CPU, RAM and GPU per task, which container image to run and which input files to read.",
  },
  {
    title: "the resource manager knows the cluster",
    text: "It keeps the global view of the hardware: which nodes exist, how much of each is free, who is alive. It is centralised, hence a potential bottleneck; its state lives in etcd or ZooKeeper.",
  },
  {
    title: "the scheduler places tasks",
    text: "It matches tasks to nodes using free resources, data locality, priorities and quotas. Allocation is NP-hard, so it is heuristics all the way: FIFO, dominant resource fairness, bin-packing.",
  },
  {
    title: "executors run and report",
    text: "On every node an executor (kubelet, NodeManager) downloads the code, launches the task isolated in a cgroup, monitors it and sends heartbeats and status back to the resource manager.",
  },
  {
    title: "node 2 is preempted",
    text: "A spot instance is reclaimed: heartbeats from node 2 stop, the resource manager marks it down, and the scheduler relaunches just that task on node n. Since output is regenerated from scratch, only time is lost.",
  },
];

const EXEC_Y = [30, 120, 210];

/**
 * The three components of an orchestrator (scheduler, resource manager,
 * executors) as a five-step walkthrough: request, cluster state,
 * placement, heartbeats, and what happens when a node is preempted.
 */
export function Orchestrator() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const on = (k: number): boolean => step === k;
  const col = (k: number, c: Color): Color => (on(k) ? c : "ink");
  const preempted = step === 4;

  return (
    <Figure
      label="FIG 02"
      title={`job orchestration · ${s.title}`}
      caption={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex gap-px border border-line w-fit">
            <button
              type="button"
              onClick={() => setStep((v) => Math.max(0, v - 1))}
              disabled={step === 0}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-3 py-1 font-dot text-sm font-bold border-x border-line">
              {step + 1}/{STEPS.length}
            </span>
            <button
              type="button"
              onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
              disabled={step === STEPS.length - 1}
              className="px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-40"
            >
              Next
            </button>
          </span>
          <span>{s.text}</span>
        </div>
      }
    >
      <Canvas w={780} h={330}>
        <Box
          x={20}
          y={60}
          w={160}
          h={74}
          title="Job request"
          sub={"tasks, CPU, RAM, GPU\nimage, input files"}
          accent={on(0) ? NEON.blue : undefined}
        />
        <Cylinder
          x={20}
          y={190}
          w={160}
          h={100}
          title="Resource manager"
          sub={"cluster state\netcd / ZooKeeper"}
          accent={on(1) || preempted ? NEON.violet : undefined}
        />
        <Box
          x={300}
          y={100}
          w={140}
          h={70}
          title="Scheduler"
          sub={on(1) ? "free cores?\nwho is alive?" : "task → node"}
          accent={on(2) || preempted ? NEON.green : undefined}
        />

        {/* inputs to the scheduler */}
        <Arrow pts={[180, 97, 240, 97, 240, 125, 300, 125]} color={col(0, "blue")} width={on(0) ? 2 : 1.5} />
        <Arrow
          pts={[180, 240, 240, 240, 240, 145, 300, 145]}
          color={col(1, "violet")}
          width={on(1) ? 2 : 1.5}
        />

        {/* executors */}
        {EXEC_Y.map((y, i) => {
          const dead = preempted && i === 1;
          const name = i === 2 ? "n" : String(i + 1);
          return (
            <g key={y}>
              <Arrow
                pts={[440, 135, 500, 135, 500, y + 28, 560, y + 28]}
                color={col(2, "green")}
                width={on(2) ? 2 : 1.5}
              />
              <Box
                x={560}
                y={y}
                w={160}
                h={56}
                title={`Executor · node ${name}`}
                sub={dead ? "preempted\nno heartbeat" : on(3) ? "cgroup, heartbeat" : "kubelet / NodeManager"}
                titleSize={12}
                accent={dead ? "var(--bad)" : on(3) ? NEON.orange : undefined}
                dashed={dead}
              />
              {dead ? (
                <Label x={750} y={y + 28} lines="×" size={16} weight={700} color="var(--bad)" />
              ) : (
                <Arrow
                  pts={[720, y + 28, 750, y + 28, 750, 310, 100, 310, 100, 290]}
                  dashed
                  color={on(3) ? "orange" : "soft"}
                  width={on(3) ? 1.5 : 1}
                  label={i === 2 ? "heartbeat, status" : undefined}
                  labelOffset={-8}
                />
              )}
            </g>
          );
        })}

        {preempted && (
          <>
            <Arrow pts={[440, 160, 475, 160, 475, 252, 560, 252]} color="magenta" width={2} />
            <Label x={518} y={266} lines="relaunch" size={10} mono color={NEON.magenta} />
            <Label x={370} y={60} lines={"one task retried,\nnot the whole job"} size={10} mono color={NEON.magenta} />
          </>
        )}

        <Label x={370} y={200} lines={"allocation is NP-hard:\nheuristics, quotas, priorities"} size={10} mono color="var(--ink-2)" />
      </Canvas>
    </Figure>
  );
}
