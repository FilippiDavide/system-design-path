import type { LabEntry } from "@/components/registry";

/**
 * Wrapper that renders a lab inline in the reading flow with a small
 * "LAB" marker so it reads as a thing to play with, not prose.
 */
export function LabFrame({ lab }: { lab: LabEntry }) {
  const Component = lab.component;
  return (
    <section id={`lab-${lab.id}`} className="my-10 scroll-mt-20">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-dot text-sm font-bold tracking-wider bg-ink text-surface px-2 py-0.5">
          LAB
        </span>
        <h3 className="font-mono text-[12px] uppercase tracking-[0.16em]">{lab.title}</h3>
      </div>
      <Component />
    </section>
  );
}
