"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Deck, Card } from "@/lib/flashcards";
import { useProgress } from "@/lib/progress";
import { isDue, review, type Grade } from "@/lib/srs";

type Mode = "due" | "all" | "browse";

/**
 * Flashcard trainer with spaced repetition. "Due" reviews only the
 * cards the schedule asks for, "All" cycles the whole deck, "Browse"
 * shows the deck as a list for quick reading.
 */
export function Flashcards({ deck }: { deck: Deck }) {
  const [progress, update] = useProgress();
  const [mode, setModeState] = useState<Mode>("due");
  const [tag, setTagState] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  // A review session: a shuffle seed plus what happened to each card.
  // "done" cards leave the queue, "again" cards go to the back of it.
  const [session, setSession] = useState<Session>(() => newSession());
  // true only on the client after hydration (progress lives in localStorage).
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const tags = useMemo(
    () => Array.from(new Set(deck.cards.flatMap((c) => c.tags))).sort(),
    [deck],
  );
  const filtered = useMemo(
    () => deck.cards.filter((c) => !tag || c.tags.includes(tag)),
    [deck, tag],
  );
  const dueCount = filtered.filter((c) => isDue(progress.cards[c.id])).length;
  const seenCount = filtered.filter((c) => progress.cards[c.id]).length;

  // The queue is derived: cards of the mode, shuffled with the session
  // seed, minus the ones graded, with forgotten ones moved to the back.
  // Cards already handled stay in even if grading made them "not due".
  const queue = useMemo(() => {
    if (!hydrated) return [];
    const base =
      mode === "due"
        ? filtered.filter((c) => session.handled[c.id] || isDue(progress.cards[c.id]))
        : filtered;
    const order = shuffle(base, session.seed);
    const fresh = order.filter((c) => !session.handled[c.id]);
    const again = session.again.map((id) => order.find((c) => c.id === id)).filter((c): c is Card => Boolean(c));
    return [...fresh, ...again];
  }, [hydrated, mode, filtered, session, progress.cards]);
  const done = Object.values(session.handled).filter((h) => h === "done").length;

  const current = queue[0];

  /** Switch mode: new shuffle, counters reset. */
  const setMode = (m: Mode) => {
    setModeState(m);
    setSession(newSession());
    setFlipped(false);
  };
  /** Switch tag filter: new shuffle, counters reset. */
  const setTag = (t: string | null) => {
    setTagState(t);
    setSession(newSession());
    setFlipped(false);
  };

  const grade = (g: Grade) => {
    if (!current) return;
    update((p) => ({
      ...p,
      cards: { ...p.cards, [current.id]: review(p.cards[current.id], g) },
    }));
    setSession((s) => ({
      ...s,
      handled: { ...s.handled, [current.id]: g === 0 ? "again" : "done" },
      // A forgotten card comes back later in the same session.
      again: g === 0 ? [...s.again.filter((id) => id !== current.id), current.id] : s.again.filter((id) => id !== current.id),
    }));
    setFlipped(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[12px] uppercase tracking-[0.16em]">
        <div className="flex gap-4">
          {(["due", "all", "browse"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`pb-1 border-b-2 ${
                mode === m ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
              }`}
            >
              {m}
              {m === "due" && hydrated && (
                <span className="ml-1 font-dot text-sm normal-case tracking-normal">{dueCount}</span>
              )}
            </button>
          ))}
        </div>
        <span className="text-ink-3">
          {deck.cards.length} cards · {hydrated ? seenCount : 0} seen
        </span>
      </div>

      {tags.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip active={tag === null} onClick={() => setTag(null)}>
            all
          </Chip>
          {tags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(t === tag ? null : t)}>
              {t}
            </Chip>
          ))}
        </div>
      )}

      {mode === "browse" ? (
        <ol className="mt-8 border border-line divide-y divide-line-soft">
          {filtered.map((c) => (
            <li key={c.id} className="p-4 grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 sm:gap-6">
              <div className="font-semibold flex items-start gap-2">
                <StateDot due={isDue(progress.cards[c.id])} seen={Boolean(progress.cards[c.id])} />
                {c.front}
              </div>
              <div className="text-sm text-ink-2 leading-relaxed">{c.back}</div>
            </li>
          ))}
        </ol>
      ) : !hydrated ? null : !current ? (
        <div className="mt-10 border border-line p-8 text-center">
          <p className="font-dot text-4xl font-bold">
            {done > 0 ? "DONE" : "NOTHING DUE"}
          </p>
          <p className="mt-3 text-ink-2 text-sm">
            {done > 0
              ? `${done} cards reviewed. Come back when the schedule says so.`
              : "No cards are due right now. Switch to “all” to drill anyway."}
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2 mb-3">
            <span>
              {done + 1} / {done + queue.length}
            </span>
            <span className="flex gap-2">
              {current.tags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="w-full text-left border border-line min-h-[260px] sm:min-h-[300px] p-6 sm:p-8 flex flex-col justify-between bg-surface hover:bg-surface-2 transition-colors"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2">
              {flipped ? "Answer" : "Term · tap to flip"}
            </span>
            <span className={flipped ? "text-base sm:text-lg leading-relaxed" : "font-dot text-3xl sm:text-4xl font-bold leading-tight"}>
              {flipped ? current.back : current.front}
            </span>
            <span className="h-4" />
          </button>

          <div className={`mt-4 grid grid-cols-4 gap-px bg-line border border-line transition-opacity ${flipped ? "" : "opacity-30 pointer-events-none"}`}>
            {(
              [
                [0, "Forgot", "bg-bad"],
                [1, "Hard", "bg-neon-5"],
                [2, "Good", "bg-neon-3"],
                [3, "Easy", "bg-neon-1"],
              ] as [Grade, string, string][]
            ).map(([g, label, color]) => (
              <button
                key={g}
                type="button"
                onClick={() => grade(g)}
                className="bg-surface py-3 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2 flex flex-col items-center gap-2"
              >
                <span className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-3 font-mono">
            Keyboard: space flips · 1–4 grades
          </p>
          <Hotkeys onFlip={() => setFlipped((f) => !f)} onGrade={flipped ? grade : undefined} />
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[11px] uppercase tracking-[0.14em] border px-2.5 py-1 ${
        active ? "bg-ink text-surface border-ink" : "border-line-soft text-ink-2 hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}

function StateDot({ due, seen }: { due: boolean; seen: boolean }) {
  const cls = !seen ? "border-ink" : due ? "bg-neon-5 border-neon-5" : "bg-neon-3 border-neon-3";
  return <span className={`mt-[7px] inline-block w-2 h-2 shrink-0 rounded-full border ${cls}`} />;
}

/** Keyboard shortcuts for the trainer. */
function Hotkeys({ onFlip, onGrade }: { onFlip: () => void; onGrade?: (g: Grade) => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " ") {
        e.preventDefault();
        onFlip();
      } else if (onGrade && ["1", "2", "3", "4"].includes(e.key)) {
        onGrade((Number(e.key) - 1) as Grade);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onFlip, onGrade]);
  return null;
}

/** One review session: shuffle seed and per-card outcome. */
interface Session {
  seed: number;
  handled: Record<string, "done" | "again">;
  /** Ids of forgotten cards, in the order they should come back. */
  again: string[];
}

function newSession(): Session {
  return { seed: Math.floor(Math.random() * 2 ** 31), handled: {}, again: [] };
}

/** Small seeded PRNG (mulberry32) so a session's order is stable across renders. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle with a seed, returning a new array. */
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  const next = rng(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
