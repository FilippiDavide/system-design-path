# System Design Path

Study companion for *Designing Data-Intensive Applications, 2nd edition*
(Kleppmann & Riccomini): per-chapter summaries, hand-drawn interactive
diagrams, labs, spaced-repetition flashcards and self-check quizzes.

| Path | What |
|---|---|
| `docs/` | English chapter summaries (single source of truth); Italian originals in `docs/it/` |
| `data/flashcards/` | Flashcard decks per chapter (YAML) |
| `source/chapters.json` | Chapter list with page ranges |
| `tools/` | Scripts used to extract chapters and normalise YAML |
| `web/` | The Next.js static site (see `web/README.md`) |

## Run the app

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm run build      # static export in web/out
```

The book PDF is not part of the repository. To enable the "open in book"
links, copy your own copy to `web/public/book.pdf` (ignored by git).
