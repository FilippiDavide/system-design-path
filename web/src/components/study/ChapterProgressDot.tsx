"use client";

import { useProgress } from "@/lib/progress";

/**
 * Small activity indicator for a chapter card: neutral when untouched,
 * filled when any section, card or quiz item of that chapter has been
 * worked on. Hydrates client-side so the static HTML stays clean.
 */
export function ChapterProgressDot({ slug }: { slug: string }) {
  const [progress] = useProgress();
  const chapterNumber = Number(slug.replace("ch", ""));
  const touched =
    Object.keys(progress.readSections).some((k) => k.startsWith(`${slug}#`)) ||
    Object.keys(progress.cards).some((k) => k.startsWith(`${chapterNumber}:`)) ||
    Object.keys(progress.quiz).some((k) => k.startsWith(`${slug}:`));

  return (
    <span
      aria-label={touched ? "in progress" : "not started"}
      className={`inline-block w-2.5 h-2.5 rounded-full border border-current ${
        touched ? "bg-neon-3 border-neon-3" : "bg-transparent"
      }`}
    />
  );
}
