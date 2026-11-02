import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import type { Root, RootContent, Heading, Code, Html } from "mdast";
import { toString as mdToString } from "mdast-util-to-string";

/**
 * A summary is split into a flat list of segments so the page can
 * interleave rendered prose with React diagrams and labs while the
 * markdown file stays the single source of truth.
 */
export type Segment =
  | { kind: "html"; html: string }
  | {
      kind: "heading";
      depth: 2 | 3;
      text: string;
      id: string;
      /** PDF page from the `<!-- pdf: N -->` anchor, if present. */
      pdfPage: number | null;
    }
  | {
      kind: "mermaid";
      /** 0-based index of this diagram inside the chapter. */
      index: number;
      code: string;
    };

/** Chapter metadata pulled from the top of the summary. */
export interface SummaryMeta {
  title: string;
  epigraph: string | null;
  oneSentence: string | null;
  density: string | null;
}

/** Section entry for the in-page table of contents. */
export interface TocEntry {
  depth: 2 | 3;
  text: string;
  id: string;
  pdfPage: number | null;
}

export interface ParsedSummary {
  meta: SummaryMeta;
  segments: Segment[];
  toc: TocEntry[];
  /** Self-check questions, in order. */
  questions: string[];
  /** Number of mermaid diagrams found. */
  diagramCount: number;
}

const PDF_RE = /<!--\s*pdf:\s*(\d+)\s*-->/;

/** Sections rendered by dedicated components instead of as prose. */
const HIDDEN_SECTIONS = new Set(["Self-check questions"]);

/**
 * Make a URL-safe id from heading text (close enough to rehype-slug
 * for in-page links).
 *
 * @param text Heading text.
 * @returns Lower-case dashed id.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Render a list of mdast block nodes to an HTML string.
 *
 * @param nodes Block nodes to render.
 * @returns HTML, with tables wrapped for horizontal scrolling.
 */
function renderNodes(nodes: RootContent[]): string {
  const root: Root = { type: "root", children: nodes };
  const processor = unified().use(remarkRehype).use(rehypeSlug).use(rehypeStringify);
  const hast = processor.runSync(root);
  const html = processor.stringify(hast);
  return html
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");
}

/**
 * Strip the intro block (title, epigraph, one-sentence, pages) and
 * return both the metadata and the remaining body nodes.
 *
 * @param children Top-level nodes of the document.
 * @returns Metadata plus the body nodes that follow the intro.
 */
function extractMeta(children: RootContent[]): {
  meta: SummaryMeta;
  body: RootContent[];
} {
  const meta: SummaryMeta = {
    title: "",
    epigraph: null,
    oneSentence: null,
    density: null,
  };
  let i = 0;
  for (; i < children.length; i++) {
    const n = children[i];
    if (n.type === "heading" && n.depth === 1) {
      meta.title = mdToString(n).replace(/^Chapter \d+\s*[·.:-]\s*/, "");
      continue;
    }
    if (n.type === "blockquote") {
      meta.epigraph = mdToString(n).replace(/\s+/g, " ").trim();
      continue;
    }
    if (n.type === "paragraph") {
      const text = mdToString(n).replace(/\s+/g, " ");
      if (text.startsWith("In one sentence:")) {
        meta.oneSentence = text.replace(/^In one sentence:\s*/, "").trim();
        continue;
      }
      if (text.startsWith("PDF pages:")) {
        const m = text.match(/Density:\s*([\s\S]*)$/);
        meta.density = m ? m[1].trim() : null;
        continue;
      }
    }
    if (n.type === "thematicBreak") continue;
    break;
  }
  return { meta, body: children.slice(i) };
}

/**
 * Parse one English summary into segments, TOC and questions.
 *
 * @param markdown Raw markdown source of the chapter summary.
 * @returns Structured summary ready for rendering.
 */
export function parseSummary(markdown: string): ParsedSummary {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
  const { meta, body } = extractMeta(tree.children);

  const segments: Segment[] = [];
  const toc: TocEntry[] = [];
  const questions: string[] = [];
  let buffer: RootContent[] = [];
  let diagramIndex = 0;
  let hiddenDepth: number | null = null;

  const flush = (): void => {
    if (buffer.length) {
      segments.push({ kind: "html", html: renderNodes(buffer) });
      buffer = [];
    }
  };

  for (let i = 0; i < body.length; i++) {
    const node = body[i];

    if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
      const h = node as Heading;
      const text = mdToString(h);

      // A hidden section ends at the next heading of equal or higher level.
      if (hiddenDepth !== null && h.depth <= hiddenDepth) hiddenDepth = null;
      if (HIDDEN_SECTIONS.has(text)) {
        hiddenDepth = h.depth;
        continue;
      }
      if (hiddenDepth !== null) continue;

      flush();
      // Look ahead for a pdf anchor comment directly after the heading.
      let pdfPage: number | null = null;
      const next = body[i + 1];
      if (next && next.type === "html") {
        const m = (next as Html).value.match(PDF_RE);
        if (m) {
          pdfPage = Number(m[1]);
          i++;
        }
      }
      const entry: TocEntry = { depth: h.depth as 2 | 3, text, id: slugify(text), pdfPage };
      toc.push(entry);
      segments.push({ kind: "heading", ...entry });
      continue;
    }

    if (hiddenDepth !== null) {
      // Collect the self-check questions from the hidden section.
      if (node.type === "list") {
        for (const item of node.children) {
          questions.push(mdToString(item).replace(/\s+/g, " ").trim());
        }
      }
      continue;
    }

    if (node.type === "code" && (node as Code).lang === "mermaid") {
      flush();
      segments.push({
        kind: "mermaid",
        index: diagramIndex++,
        code: (node as Code).value,
      });
      continue;
    }

    if (node.type === "html" && PDF_RE.test((node as Html).value)) continue;
    if (node.type === "thematicBreak") continue;

    buffer.push(node);
  }
  flush();

  return { meta, segments, toc, questions, diagramCount: diagramIndex };
}
