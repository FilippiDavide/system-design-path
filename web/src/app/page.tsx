import Link from "next/link";
import { getChapters } from "@/lib/chapters";
import { ChapterProgressDot } from "@/components/study/ChapterProgressDot";

/**
 * Home: the fourteen chapters as a numbered grid. Chapters without a
 * translated summary yet are shown but not linked.
 */
export default function HomePage() {
  const chapters = getChapters();
  const parts = [
    { label: "Part I · Foundations of data systems", range: [1, 5] },
    { label: "Part II · Distributed data", range: [6, 10] },
    { label: "Part III · Derived data", range: [11, 14] },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24">
      <section className="py-14 sm:py-20 border-b border-line">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-2">
          Designing Data-Intensive Applications · 2nd edition
        </p>
        <h1 className="font-dot text-5xl sm:text-7xl font-bold leading-[0.95] mt-4">
          Read. See.
          <br />
          Play. Recall.
        </h1>
        <p className="mt-6 max-w-xl text-ink-2 leading-relaxed">
          Each chapter is a summary you can read, diagrams you can inspect,
          labs you can poke at, flashcards scheduled for you, and a short
          self-check. Every section links to the exact page of the book.
        </p>
      </section>

      {parts.map((part) => (
        <section key={part.label} className="pt-10">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-2 mb-4">
            {part.label}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-line">
            {chapters
              .filter((c) => c.number >= part.range[0] && c.number <= part.range[1])
              .map((c) => {
                const ready = Boolean(c.docPath);
                const body = (
                  <div className="h-full p-5 flex flex-col justify-between min-h-[150px]">
                    <div className="flex items-start justify-between">
                      <span className="font-dot text-5xl font-bold leading-none">
                        {String(c.number).padStart(2, "0")}
                      </span>
                      <ChapterProgressDot slug={c.slug} />
                    </div>
                    <div className="mt-6">
                      <p className="font-medium leading-snug">{c.title}</p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 group-hover:text-surface/70 mt-2">
                        {ready ? `pp. ${c.firstPage}–${c.lastPage}` : "not translated yet"}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={c.slug} className={`border-r border-b border-line ${ready ? "" : "opacity-40"}`}>
                    {ready ? (
                      // Hover inverts the card: black surface, white ink.
                      <Link
                        href={`/chapters/${c.slug}/`}
                        className="group block h-full bg-surface text-ink transition-colors duration-150 hover:bg-ink hover:text-surface"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </main>
  );
}
