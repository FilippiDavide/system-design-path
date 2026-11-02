import fs from "node:fs";
import path from "node:path";
import { load as yamlLoad } from "js-yaml";

/** A self-check question with its model answer. */
export interface QuizItem {
  /** Stable id: `${slug}:${index}`. */
  id: string;
  question: string;
  /** Model answer in markdown-ish plain text (may be empty if not written yet). */
  answer: string;
  /** Section id the question refers to, for a "re-read" link. */
  section: string | null;
  /** PDF page for the deep link. */
  pdfPage: number | null;
}

interface RawAnswers {
  answers: { question?: string; answer: string; section?: string; pdf?: number }[];
}

/**
 * Join the questions parsed from the summary with the model answers
 * stored in `content/quiz/<slug>.yaml` (answers are matched by index).
 *
 * @param slug Chapter slug.
 * @param questions Questions parsed from the summary, in order.
 * @returns Quiz items; answers are empty strings when not authored yet.
 */
export function loadQuiz(slug: string, questions: string[]): QuizItem[] {
  const file = path.join(process.cwd(), "content", "quiz", `${slug}.yaml`);
  let raw: RawAnswers | null = null;
  if (fs.existsSync(file)) {
    raw = yamlLoad(fs.readFileSync(file, "utf8")) as RawAnswers;
  }
  return questions.map((q, i) => {
    const a = raw?.answers?.[i];
    return {
      id: `${slug}:${i}`,
      question: q,
      answer: a?.answer?.trim() ?? "",
      section: a?.section ?? null,
      pdfPage: a?.pdf ?? null,
    };
  });
}
