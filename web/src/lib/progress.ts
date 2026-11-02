"use client";

import { useCallback, useEffect, useState } from "react";
import type { CardState } from "./srs";

/**
 * All study progress lives in localStorage under one key. The site is
 * static, so there is no server to sync with; export/import is offered
 * from the settings menu.
 */
export interface Progress {
  /** Sections marked as read, keyed by `${slug}#${sectionId}`. */
  readSections: Record<string, true>;
  /** SRS state per card id. */
  cards: Record<string, CardState>;
  /** Quiz self-grades per question id: last result and attempt count. */
  quiz: Record<string, { correct: boolean; attempts: number; at: number }>;
  /** Labs that were completed, keyed by lab id. */
  labs: Record<string, true>;
}

const KEY = "ddia-study:v1";
const EVENT = "ddia-progress";

const EMPTY: Progress = { readSections: {}, cards: {}, quiz: {}, labs: {} };

/**
 * Read progress from localStorage, tolerating a missing or broken value.
 *
 * @returns The stored progress or an empty structure.
 */
export function loadProgress(): Progress {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return { ...EMPTY, ...parsed };
  } catch (err) {
    console.warn("progress: could not read localStorage", err);
    return EMPTY;
  }
}

/**
 * Persist progress and notify every mounted hook on the page.
 *
 * @param next The full progress object to store.
 */
export function saveProgress(next: Progress): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("progress: could not write localStorage", err);
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * React hook exposing the progress object and an updater. Every hook
 * instance re-renders when any of them saves.
 *
 * @returns `[progress, update]` where update receives a mutator.
 */
export function useProgress(): [Progress, (fn: (p: Progress) => Progress) => void] {
  const [progress, setProgress] = useState<Progress>(EMPTY);

  useEffect(() => {
    const sync = () => setProgress(loadProgress());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    saveProgress(fn(loadProgress()));
  }, []);

  return [progress, update];
}
