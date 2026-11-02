# DDIA Study Companion

Static Next.js + Tailwind site that turns the chapter summaries in `../docs`
and the flashcard decks in `../data/flashcards` into an interactive study
app: read mode with hand-drawn diagrams and labs, spaced-repetition cards,
self-check quiz, deep links into the book PDF.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static export into out/
```

Serve `out/` with any static file server (e.g. `python -m http.server --directory out`).

## Where things live

| Path | What |
|---|---|
| `../docs/chNN-*.md` | English chapter summaries (single source of truth). `<!-- pdf: N -->` after a heading is the PDF page used for the deep link. |
| `../data/flashcards/chNN.yaml` | Flashcard decks. |
| `content/quiz/chNN.yaml` | Model answers for the self-check questions, matched by index. |
| `public/book.pdf` | The book; links open `/book.pdf#page=N`. |
| `src/lib/markdown.ts` | Splits a summary into prose / heading / mermaid segments. |
| `src/components/registry.ts` | Maps chapter → custom diagrams (by mermaid block index) and labs (by section id). Anything not listed falls back to a Mermaid render. |
| `src/components/diagrams/chNN/` | Hand-drawn SVG diagrams built on `diagrams/primitives.tsx`. |
| `src/components/labs/chNN/` | Interactive labs. |
| `src/lib/srs.ts`, `src/lib/progress.ts` | SM-2 scheduling and localStorage progress. |

## Status

All 14 chapters have hand-drawn diagrams for every mermaid block, 2–4
interactive labs each and model answers for the self-check questions.
Each chapter module (`diagrams/chNN/index.tsx`) is registered in
`registry.ts`; an unregistered block would fall back to a Mermaid render
labelled "draft diagram".

## Adding or changing a chapter's visuals

1. Count the mermaid blocks in the summary (0-based) and write one component per block in `diagrams/chNN/`.
2. Write labs in `labs/chNN/` and anchor each to a section id (slugified heading text).
3. Export `chNNDiagrams` / `chNNLabs` from `diagrams/chNN/index.tsx` and register them in `registry.ts`.
4. Author `content/quiz/chNN.yaml`.

## Style tokens

White surface, black ink, dot-matrix display face (Doto) for numerals and headings, Inter for text, JetBrains Mono for labels. Neon palette (validated for contrast and colour-vision separation on white, fixed order): blue `#0062ff`, magenta `#ff1fcf`, green `#009e4b`, violet `#6a2cff`, orange `#ff7a00`. Status: green ok, orange warn, red `#e5002b` bad.
