import { notFound } from "next/navigation";
import { getChapter } from "@/lib/chapters";
import { loadDeck } from "@/lib/flashcards";
import { Flashcards } from "@/components/study/Flashcards";

/** Cards mode: spaced-repetition review of the chapter deck. */
export default async function CardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter?.docPath) notFound();

  if (!chapter.deckPath) {
    return (
      <p className="pt-10 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-3">
        No flashcards for this chapter yet.
      </p>
    );
  }
  const deck = loadDeck(chapter.deckPath);
  return (
    <div className="pt-8">
      <Flashcards deck={deck} />
    </div>
  );
}
