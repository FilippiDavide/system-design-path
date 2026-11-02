/**
 * Minimal SM-2 style spaced repetition.
 *
 * Each card keeps an ease factor, an interval in days and the next
 * review timestamp. Grades: 0 = forgot, 1 = hard, 2 = good, 3 = easy.
 */
export interface CardState {
  ease: number;
  intervalDays: number;
  /** Epoch ms of the next due review. */
  due: number;
  reps: number;
  lapses: number;
}

export type Grade = 0 | 1 | 2 | 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fresh state for a never-reviewed card (due immediately). */
export function newCardState(now: number = Date.now()): CardState {
  return { ease: 2.5, intervalDays: 0, due: now, reps: 0, lapses: 0 };
}

/**
 * Apply a review grade and compute the next schedule.
 *
 * @param state Current state (or undefined for a new card).
 * @param grade 0..3 as described above.
 * @param now Epoch ms used as "today".
 * @returns The updated state.
 */
export function review(
  state: CardState | undefined,
  grade: Grade,
  now: number = Date.now(),
): CardState {
  const s = state ? { ...state } : newCardState(now);

  if (grade === 0) {
    // Lapse: back to the start, ease drops but never below 1.3.
    s.lapses += 1;
    s.reps = 0;
    s.intervalDays = 0;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.due = now + 10 * 60 * 1000; // ten minutes
    return s;
  }

  s.reps += 1;
  if (s.reps === 1) s.intervalDays = grade === 3 ? 4 : 1;
  else if (s.reps === 2) s.intervalDays = grade === 3 ? 10 : 6;
  else s.intervalDays = Math.round(s.intervalDays * s.ease * (grade === 1 ? 0.6 : grade === 3 ? 1.3 : 1));

  // SM-2 ease adjustment mapped from our 0..3 scale onto its 0..5 scale.
  const q = grade === 1 ? 3 : grade === 2 ? 4 : 5;
  s.ease = Math.max(1.3, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  s.due = now + s.intervalDays * DAY_MS;
  return s;
}

/**
 * Whether a card is due for review.
 *
 * @param state Card state, undefined means never seen (always due).
 * @param now Epoch ms.
 */
export function isDue(state: CardState | undefined, now: number = Date.now()): boolean {
  return !state || state.due <= now;
}
