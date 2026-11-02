"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "", label: "Read" },
  { key: "labs", label: "Labs" },
  { key: "cards", label: "Cards" },
  { key: "quiz", label: "Quiz" },
] as const;

/**
 * Chapter mode switcher. Active tab is derived from the pathname so the
 * static pages need no extra props.
 */
export function ChapterTabs({ slug }: { slug: string }) {
  const pathname = usePathname() ?? "";
  const base = `/chapters/${slug}`;
  const current = pathname.replace(base, "").replace(/\//g, "");

  return (
    <nav
      aria-label="Chapter modes"
      className="mt-6 -mb-5 flex gap-6 overflow-x-auto font-mono text-[12px] uppercase tracking-[0.18em]"
    >
      {TABS.map((t) => {
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            href={`${base}/${t.key ? t.key + "/" : ""}`}
            className={`relative pb-4 whitespace-nowrap ${
              active ? "text-ink" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 -top-3 w-1.5 h-1.5 rounded-full bg-accent"
              />
            )}
            {t.label}
            {active && (
              <span aria-hidden className="absolute left-0 right-0 -bottom-px h-[2px] bg-ink" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
