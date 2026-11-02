"use client";

import { useState } from "react";
import type { QuizItem } from "@/lib/quiz";
import { pdfHref } from "@/lib/pdf";
import { useProgress } from "@/lib/progress";

/**
 * Self-check: the learner answers in their head (or in the notes box),
 * reveals the model answer, then self-grades. Results are persisted so
 * the chapter card on the home page reflects them.
 */
export function Quiz({ slug, items }: { slug: string; items: QuizItem[] }) {
  const [progress, update] = useProgress();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const answered = items.filter((i) => progress.quiz[i.id]).length;
  const correct = items.filter((i) => progress.quiz[i.id]?.correct).length;

  const grade = (id: string, ok: boolean) =>
    update((p) => ({
      ...p,
      quiz: {
        ...p.quiz,
        [id]: { correct: ok, attempts: (p.quiz[id]?.attempts ?? 0) + 1, at: Date.now() },
      },
    }));

  const reset = () =>
    update((p) => {
      const q = { ...p.quiz };
      for (const i of items) delete q[i.id];
      return { ...p, quiz: q };
    });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-[0.16em] text-ink-2">
        <span>
          <span className="font-dot text-xl text-ink">{correct}</span> / {items.length} right ·{" "}
          {answered} answered
        </span>
        {answered > 0 && (
          <button type="button" onClick={reset} className="underline underline-offset-4 hover:text-ink">
            reset
          </button>
        )}
      </div>

      <ol className="mt-6 space-y-6">
        {items.map((item, i) => {
          const state = progress.quiz[item.id];
          const open = revealed[item.id];
          return (
            <li key={item.id} className="border border-line">
              <div className="p-5 flex gap-4">
                <span className="font-dot text-3xl font-bold leading-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed">{item.question}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[0.14em]">
                    <button
                      type="button"
                      onClick={() => setRevealed((r) => ({ ...r, [item.id]: !open }))}
                      className="border border-ink px-3 py-1.5 hover:bg-ink hover:text-surface"
                    >
                      {open ? "Hide answer" : "Show answer"}
                    </button>
                    {item.pdfPage && (
                      <a
                        href={pdfHref(item.pdfPage)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4 text-ink-2 hover:text-ink"
                      >
                        book p. {item.pdfPage} ↗
                      </a>
                    )}
                    {item.section && (
                      <a href={`/chapters/${slug}/#${item.section}`} className="underline underline-offset-4 text-ink-2 hover:text-ink">
                        re-read section
                      </a>
                    )}
                    {state && (
                      <span className="flex items-center gap-2 text-ink-2">
                        <span className={`w-2 h-2 rounded-full ${state.correct ? "bg-neon-3" : "bg-bad"}`} />
                        {state.correct ? "got it" : "missed"} · {state.attempts}×
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {open && (
                <div className="border-t border-line-soft bg-surface-2 p-5 pl-5 sm:pl-[4.5rem]">
                  {item.answer ? (
                    <div className="text-sm leading-relaxed space-y-2">
                      {item.answer.split(/\n{2,}/).map((para, k) => (
                        <p key={k}>{para}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-3 font-mono">Model answer not written yet.</p>
                  )}
                  <div className="mt-4 flex gap-px bg-line border border-line w-fit">
                    <button
                      type="button"
                      onClick={() => grade(item.id, false)}
                      className="bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2"
                    >
                      I missed it
                    </button>
                    <button
                      type="button"
                      onClick={() => grade(item.id, true)}
                      className="bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-surface-2"
                    >
                      I had it
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
