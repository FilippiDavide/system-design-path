import fs from "node:fs";
import { load as yamlLoad } from "js-yaml";

/** One flashcard as stored in the YAML decks. */
export interface Card {
  /** Stable id: `${chapter}:${index}`. */
  id: string;
  front: string;
  back: string;
  tags: string[];
}

export interface Deck {
  chapter: number;
  title: string;
  cards: Card[];
}

interface RawDeck {
  chapter: number;
  title: string;
  cards: { front: string; back: string; tags?: string[] }[];
}

/**
 * Load and normalise a flashcard deck from disk.
 *
 * @param deckPath Absolute path to the YAML file.
 * @returns The deck with stable card ids.
 * @throws Error when the file cannot be parsed.
 */
export function loadDeck(deckPath: string): Deck {
  const raw = yamlLoad(fs.readFileSync(deckPath, "utf8")) as RawDeck;
  if (!raw || !Array.isArray(raw.cards)) {
    throw new Error(`Invalid deck: ${deckPath}`);
  }
  return {
    chapter: raw.chapter,
    title: raw.title,
    cards: raw.cards.map((c, i) => ({
      id: `${raw.chapter}:${i}`,
      front: String(c.front),
      back: String(c.back),
      tags: c.tags ?? [],
    })),
  };
}
