"use client";

import { pdfHref } from "@/lib/pdf";
import { useProgress } from "@/lib/progress";

/**
 * Section heading with a deep link into the book PDF and a "read"
 * toggle persisted in localStorage.
 */
export function SectionHeading({
  slug,
  id,
  depth,
  text,
  pdfPage,
}: {
  slug: string;
  id: string;
  depth: 2 | 3;
  text: string;
  pdfPage: number | null;
}) {
  const [progress, update] = useProgress();
  const key = `${slug}#${id}`;
  const read = Boolean(progress.readSections[key]);

  const toggle = () =>
    update((p) => {
      const next = { ...p.readSections };
      if (next[key]) delete next[key];
      else next[key] = true;
      return { ...p, readSections: next };
    });

  const Tag = depth === 2 ? "h2" : "h3";
  const pdf = pdfPage ? (
    <a
      href={pdfHref(pdfPage)}
      target="_blank"
      rel="noreferrer"
      title={`Open the book at page ${pdfPage}`}
      className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink underline underline-offset-4 whitespace-nowrap"
    >
      p. {pdfPage} ↗
    </a>
  ) : null;

  return (
    <div className={`prose scroll-mt-20 ${depth === 2 ? "section-h2 mt-14" : "mt-10"}`} id={id}>
      <div className="flex items-baseline justify-between gap-4">
        <Tag className="!mt-0 min-w-0">{text}</Tag>
        <div className="flex items-center gap-3 shrink-0">
          {pdf}
          {depth === 2 && (
            <button
              type="button"
              onClick={toggle}
              aria-pressed={read}
              title={read ? "Mark as unread" : "Mark as read"}
              className={`w-4 h-4 rounded-full border border-ink transition-colors ${
                read ? "bg-neon-3 border-neon-3" : "bg-transparent hover:bg-surface-2"
              }`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
