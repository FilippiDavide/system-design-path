"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/lib/markdown";
import { useProgress } from "@/lib/progress";

/**
 * Table of contents. On desktop it is a sticky sidebar that highlights
 * the section currently in view; on mobile it collapses behind a
 * disclosure. Read sections get a filled dot.
 */
export function Toc({
  slug,
  entries,
  collapsible = false,
}: {
  slug: string;
  entries: TocEntry[];
  collapsible?: boolean;
}) {
  const [progress] = useProgress();
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(!collapsible);

  useEffect(() => {
    if (collapsible) return;
    const headings = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!headings.length) return;
    const obs = new IntersectionObserver(
      (hits) => {
        const visible = hits
          .filter((h) => h.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [entries, collapsible]);

  const readCount = entries.filter(
    (e) => e.depth === 2 && progress.readSections[`${slug}#${e.id}`],
  ).length;
  const total = entries.filter((e) => e.depth === 2).length;

  return (
    <nav aria-label="Sections" className="font-mono text-[12px]">
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        className={`flex w-full items-center justify-between uppercase tracking-[0.18em] text-ink-2 ${
          collapsible ? "border border-line px-3 py-2" : "mb-3"
        }`}
      >
        <span>Contents</span>
        <span className="font-dot text-sm text-ink">
          {readCount}/{total}
        </span>
      </button>
      {open && (
        <ol className={`${collapsible ? "border border-t-0 border-line p-3" : ""} space-y-1.5`}>
          {entries.map((e) => {
            const read = Boolean(progress.readSections[`${slug}#${e.id}`]);
            const isActive = active === e.id;
            return (
              <li key={e.id} className={e.depth === 3 ? "pl-4" : ""}>
                <a
                  href={`#${e.id}`}
                  onClick={() => collapsible && setOpen(false)}
                  aria-current={isActive ? "location" : undefined}
                  className={`flex items-start gap-2 leading-snug transition-colors ${
                    isActive ? "text-accent font-semibold" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {/* Active section: Nothing-red dot; it wins over the green "read" dot. */}
                  {e.depth === 2 ? (
                    <span
                      aria-hidden
                      className={`mt-[5px] inline-block w-1.5 h-1.5 shrink-0 rounded-full border ${
                        isActive
                          ? "bg-accent border-accent"
                          : read
                            ? "bg-neon-3 border-neon-3"
                            : "border-ink"
                      }`}
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={`mt-[5px] inline-block h-px shrink-0 transition-all ${
                        isActive ? "w-3 bg-accent" : "w-1.5 bg-ink-3"
                      }`}
                    />
                  )}
                  <span className={e.depth === 2 ? "font-semibold" : ""}>{e.text}</span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
