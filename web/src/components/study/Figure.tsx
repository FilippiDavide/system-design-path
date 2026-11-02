import type { ReactNode } from "react";

/**
 * Frame shared by every diagram and lab: thin border, a dotted label
 * on top and an optional caption below. Scrolls horizontally on narrow
 * screens rather than squashing the drawing.
 */
export function Figure({
  label,
  title,
  caption,
  children,
  scroll = true,
}: {
  label: string;
  title?: string;
  caption?: ReactNode;
  children: ReactNode;
  /** Allow horizontal scrolling for wide drawings. */
  scroll?: boolean;
}) {
  return (
    <figure className="my-8 border border-line">
      <figcaption className="flex items-center gap-3 px-4 py-2 border-b border-line-soft">
        <span className="font-dot text-sm font-bold tracking-wider">{label}</span>
        {title && <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 truncate">{title}</span>}
      </figcaption>
      <div className={`p-3 sm:p-5 bg-grid ${scroll ? "overflow-x-auto" : ""}`}>{children}</div>
      {caption && (
        <div className="px-4 py-3 border-t border-line-soft text-sm text-ink-2 leading-relaxed">
          {caption}
        </div>
      )}
    </figure>
  );
}
