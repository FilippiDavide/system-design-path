import { notFound } from "next/navigation";
import Link from "next/link";
import { getChapter, getChapters } from "@/lib/chapters";
import { pdfHref } from "@/lib/pdf";
import { ChapterTabs } from "@/components/study/ChapterTabs";

/** Pre-render one route per translated chapter. */
export function generateStaticParams() {
  return getChapters()
    .filter((c) => c.docPath)
    .map((c) => ({ slug: c.slug }));
}

/**
 * Chapter shell: header with number/title, PDF link, tabs. The nested
 * pages (read, cards, quiz, labs) render below.
 */
export default async function ChapterLayout({
  children,
  params,
}: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter || !chapter.docPath) notFound();

  const all = getChapters().filter((c) => c.docPath);
  const idx = all.findIndex((c) => c.slug === slug);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <header className="pt-8 pb-5 border-b border-line">
        <div className="flex items-end gap-4 sm:gap-6">
          <span className="font-dot text-6xl sm:text-8xl font-bold leading-[0.85]">
            {String(chapter.number).padStart(2, "0")}
          </span>
          <div className="pb-1 min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-2">
              Chapter {chapter.number}
            </p>
            <h1 className="text-xl sm:text-3xl font-semibold leading-tight mt-1">
              {chapter.title}
            </h1>
            <a
              href={pdfHref(chapter.firstPage)}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 font-mono text-[11px] uppercase tracking-[0.16em] underline underline-offset-4 hover:text-ink-2"
            >
              Open in book · pp. {chapter.firstPage}–{chapter.lastPage}
            </a>
          </div>
        </div>
        <ChapterTabs slug={slug} />
      </header>

      {children}

      <nav className="mt-16 pt-6 border-t border-line flex justify-between font-mono text-[11px] uppercase tracking-[0.16em]">
        {prev ? (
          <Link href={`/chapters/${prev.slug}/`} className="underline underline-offset-4">
            ← {String(prev.number).padStart(2, "0")} {prev.shortTitle}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/chapters/${next.slug}/`} className="underline underline-offset-4 text-right">
            {String(next.number).padStart(2, "0")} {next.shortTitle} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
