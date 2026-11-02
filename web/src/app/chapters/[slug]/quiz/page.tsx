import fs from "node:fs";
import { notFound } from "next/navigation";
import { getChapter } from "@/lib/chapters";
import { parseSummary } from "@/lib/markdown";
import { loadQuiz } from "@/lib/quiz";
import { Quiz } from "@/components/study/Quiz";

/** Quiz mode: the chapter's self-check questions with model answers. */
export default async function QuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter?.docPath) notFound();

  const summary = parseSummary(fs.readFileSync(chapter.docPath, "utf8"));
  const items = loadQuiz(slug, summary.questions);

  return (
    <div className="pt-8">
      <Quiz slug={slug} items={items} />
    </div>
  );
}
