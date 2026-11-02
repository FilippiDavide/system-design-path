import fs from "node:fs";
import path from "node:path";

/** Root of the study material (one level above the Next.js app). */
export const CONTENT_ROOT = path.resolve(process.cwd(), "..");

/** One book chapter and where its material lives on disk. */
export interface Chapter {
  /** URL slug, e.g. `ch01`. */
  slug: string;
  /** Chapter number, 1-based. */
  number: number;
  /** Official English title from the book. */
  title: string;
  /** Short title shown in tight spaces (nav, cards). */
  shortTitle: string;
  /** First PDF page of the chapter. */
  firstPage: number;
  /** Last PDF page of the chapter. */
  lastPage: number;
  /** Word count of the original chapter text. */
  words: number;
  /** Absolute path to the English summary, or null if not translated yet. */
  docPath: string | null;
  /** Absolute path to the English flashcard deck, or null if missing. */
  deckPath: string | null;
}

interface ManifestEntry {
  number: number;
  title: string;
  file: string;
  first_page: number;
  last_page: number;
  pages: number;
  words: number;
}

/** Short titles used in navigation; keyed by chapter number. */
const SHORT_TITLES: Record<number, string> = {
  1: "Trade-offs",
  2: "Nonfunctional requirements",
  3: "Data models",
  4: "Storage & retrieval",
  5: "Encoding & evolution",
  6: "Replication",
  7: "Sharding",
  8: "Transactions",
  9: "Distributed trouble",
  10: "Consistency & consensus",
  11: "Batch processing",
  12: "Stream processing",
  13: "Streaming philosophy",
  14: "Doing the right thing",
};

/**
 * Find the summary file for a chapter number inside `docs/`.
 *
 * @param number Chapter number.
 * @returns Absolute path or null when the file is not there yet.
 */
function findDoc(number: number): string | null {
  const dir = path.join(CONTENT_ROOT, "docs");
  const prefix = `ch${String(number).padStart(2, "0")}-`;
  const hit = fs
    .readdirSync(dir)
    .find((f) => f.startsWith(prefix) && f.endsWith(".md"));
  return hit ? path.join(dir, hit) : null;
}

/**
 * Load the chapter manifest produced by `tools/extract_chapters.py`
 * and join it with the translated docs and decks on disk.
 *
 * @returns Chapters in book order.
 */
export function getChapters(): Chapter[] {
  const manifest: ManifestEntry[] = JSON.parse(
    fs.readFileSync(
      path.join(CONTENT_ROOT, "source", "chapters.json"),
      "utf8",
    ),
  );
  return manifest.map((m) => {
    const slug = `ch${String(m.number).padStart(2, "0")}`;
    const deck = path.join(CONTENT_ROOT, "data", "flashcards", `${slug}.yaml`);
    return {
      slug,
      number: m.number,
      title: m.title,
      shortTitle: SHORT_TITLES[m.number] ?? m.title,
      firstPage: m.first_page,
      lastPage: m.last_page,
      words: m.words,
      docPath: findDoc(m.number),
      deckPath: fs.existsSync(deck) ? deck : null,
    };
  });
}

/**
 * Look up one chapter by slug.
 *
 * @param slug URL slug such as `ch06`.
 * @returns The chapter, or undefined when the slug is unknown.
 */
export function getChapter(slug: string): Chapter | undefined {
  return getChapters().find((c) => c.slug === slug);
}

