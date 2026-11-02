import Link from "next/link";

/**
 * Global top bar: wordmark on the left, book link on the right.
 * Kept deliberately bare; chapter navigation lives in the chapter layout.
 */
export function TopBar() {
  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-6xl px-4 h-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-ink" aria-hidden />
          <span className="font-dot text-lg font-bold leading-none">DDIA</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2 hidden sm:inline">
            study companion
          </span>
        </Link>
        <a
          href="/book.pdf"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[11px] uppercase tracking-[0.18em] underline underline-offset-4 hover:text-ink-2"
        >
          Book PDF
        </a>
      </div>
    </header>
  );
}
