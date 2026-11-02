import { notFound } from "next/navigation";
import { getChapter } from "@/lib/chapters";
import { LABS } from "@/components/registry";
import { LabFrame } from "@/components/study/LabFrame";

/** Labs mode: every interactive lab of the chapter, one after another. */
export default async function LabsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter?.docPath) notFound();
  const labs = LABS[slug] ?? [];

  return (
    <div className="pt-8 max-w-3xl">
      <p className="text-ink-2 leading-relaxed max-w-xl">
        Each lab is a mechanism from the chapter you can drive by hand.
        Change the inputs, watch what breaks.
      </p>
      {labs.length === 0 ? (
        <p className="mt-10 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-3">
          No labs for this chapter yet.
        </p>
      ) : (
        <ol className="mt-6 mb-10 border border-line divide-y divide-line">
          {labs.map((l, i) => (
            <li key={l.id}>
              <a href={`#lab-${l.id}`} className="flex gap-4 p-4 hover:bg-surface-2">
                <span className="font-dot text-2xl font-bold leading-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block font-medium">{l.title}</span>
                  <span className="block text-sm text-ink-2 mt-1">{l.blurb}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
      {labs.map((l) => (
        <LabFrame key={l.id} lab={l} />
      ))}
    </div>
  );
}
