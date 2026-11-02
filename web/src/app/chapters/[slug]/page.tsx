import fs from "node:fs";
import { notFound } from "next/navigation";
import { getChapter } from "@/lib/chapters";
import { pdfHref } from "@/lib/pdf";
import { parseSummary } from "@/lib/markdown";
import { DIAGRAMS, LABS } from "@/components/registry";
import { Mermaid } from "@/components/study/Mermaid";
import { Figure } from "@/components/study/Figure";
import { SectionHeading } from "@/components/study/SectionHeading";
import { Toc } from "@/components/study/Toc";
import { LabFrame } from "@/components/study/LabFrame";

/**
 * Read mode: the chapter summary with custom diagrams and labs spliced
 * in at the positions the markdown dictates.
 */
export default async function ReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter?.docPath) notFound();

  const summary = parseSummary(fs.readFileSync(chapter.docPath, "utf8"));
  const diagrams = DIAGRAMS[slug] ?? {};
  const labs = LABS[slug] ?? [];

  // Walk the segments and emit JSX. A lab anchored to a section is
  // emitted right before the next heading (i.e. at the end of its section).
  const out: React.ReactNode[] = [];
  let pendingLab: (typeof labs)[number] | null = null;
  const flushLab = () => {
    if (pendingLab) {
      out.push(
        <LabFrame key={`lab-${pendingLab.id}`} lab={pendingLab} />,
      );
      pendingLab = null;
    }
  };

  summary.segments.forEach((seg, i) => {
    if (seg.kind === "heading") {
      if (seg.depth === 2 || pendingLab) flushLab();
      out.push(
        <SectionHeading
          key={`h-${i}`}
          slug={slug}
          id={seg.id}
          depth={seg.depth}
          text={seg.text}
          pdfPage={seg.pdfPage}
        />,
      );
      const lab = labs.find((l) => l.afterSection === seg.id);
      if (lab) pendingLab = lab;
      return;
    }
    if (seg.kind === "html") {
      out.push(
        <div key={`p-${i}`} className="prose" dangerouslySetInnerHTML={{ __html: seg.html }} />,
      );
      return;
    }
    const Custom = diagrams[seg.index];
    if (Custom) {
      out.push(<Custom key={`d-${i}`} />);
    } else {
      out.push(
        <Figure key={`d-${i}`} label={`FIG ${String(seg.index + 1).padStart(2, "0")}`} title="draft diagram">
          <Mermaid code={seg.code} />
        </Figure>,
      );
    }
  });
  flushLab();

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-12">
      <aside className="hidden lg:block">
        <div className="sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto pt-8 pr-2">
          <Toc slug={slug} entries={summary.toc} />
        </div>
      </aside>

      <article className="min-w-0 pt-8">
        <section className="mb-10">
          {summary.meta.oneSentence && (
            <p className="text-lg sm:text-xl leading-relaxed max-w-2xl">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2 block mb-2">
                In one sentence
              </span>
              {summary.meta.oneSentence}
            </p>
          )}
          {summary.meta.epigraph && (
            <blockquote className="mt-6 border-l-2 border-ink pl-4 text-ink-2 italic max-w-2xl text-sm leading-relaxed">
              {summary.meta.epigraph}
            </blockquote>
          )}
          {summary.meta.density && (
            <p className="mt-6 font-mono text-[12px] leading-relaxed text-ink-2 max-w-2xl">
              <span className="uppercase tracking-[0.18em]">Density · </span>
              {summary.meta.density}{" "}
              <a
                href={pdfHref(chapter.firstPage)}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                Book pp. {chapter.firstPage}–{chapter.lastPage}
              </a>
            </p>
          )}
        </section>

        <div className="lg:hidden mb-8">
          <Toc slug={slug} entries={summary.toc} collapsible />
        </div>

        {out}
      </article>
    </div>
  );
}
