"""Extract each chapter of a PDF book into its own plain-text file.

Chapter boundaries come from the PDF outline (bookmarks): every
top-level entry whose title starts with ``Chapter N.`` opens a chapter,
and the chapter runs until the next top-level entry. A small JSON
manifest with the page ranges is written next to the text files so
figures can later be pulled from the right pages.

Usage:
    python extract_chapters.py <book.pdf> <output_dir>
"""

import json
import logging
import re
import sys
from pathlib import Path
from typing import List, Tuple

from pypdf import PdfReader

logger = logging.getLogger(__name__)

CHAPTER_RE = re.compile(r"^Chapter (\d+)\.\s*(.+)$")


def slugify(title: str) -> str:
    """Turn a chapter title into a filesystem-safe lowercase slug.

    Args:
        title: Human-readable chapter title.

    Returns:
        Slug made of lowercase words joined by hyphens.
    """
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def top_level_entries(reader: PdfReader) -> List[Tuple[str, int]]:
    """Return the top-level outline entries as (title, zero-based page).

    Nested entries (sections inside a chapter) are skipped: only the
    chapter-level bookmarks define boundaries.

    Args:
        reader: Open PDF reader.

    Returns:
        List of (title, page_index) in document order.

    Raises:
        ValueError: If the PDF carries no outline at all.
    """
    entries: List[Tuple[str, int]] = []
    for item in reader.outline:
        if isinstance(item, list):
            continue  # children of the previous entry
        page = reader.get_destination_page_number(item)
        entries.append((item.title, page))
    if not entries:
        raise ValueError("PDF has no outline; cannot locate chapters")
    return entries


def chapter_ranges(
    entries: List[Tuple[str, int]], page_count: int
) -> List[Tuple[int, str, int, int]]:
    """Derive (number, title, first_page, last_page) for each chapter.

    ``last_page`` is exclusive and zero-based, i.e. the first page of
    the following top-level entry.

    Args:
        entries: Top-level outline entries in document order.
        page_count: Total pages, used as the end of the last entry.

    Returns:
        One tuple per chapter, in reading order.
    """
    ranges: List[Tuple[int, str, int, int]] = []
    for idx, (title, start) in enumerate(entries):
        match = CHAPTER_RE.match(title)
        if not match:
            continue
        end = entries[idx + 1][1] if idx + 1 < len(entries) else page_count
        ranges.append((int(match.group(1)), match.group(2), start, end))
    return ranges


def extract(pdf_path: Path, out_dir: Path) -> None:
    """Write one text file per chapter plus a ``chapters.json`` manifest.

    Args:
        pdf_path: Source PDF.
        out_dir: Destination directory, created if missing.

    Raises:
        FileNotFoundError: If ``pdf_path`` does not exist.
    """
    if not pdf_path.is_file():
        raise FileNotFoundError(pdf_path)
    out_dir.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(pdf_path))
    ranges = chapter_ranges(top_level_entries(reader), len(reader.pages))
    manifest = []

    for number, title, start, end in ranges:
        name = f"ch{number:02d}-{slugify(title)}"
        pages = []
        for i in range(start, end):
            text = reader.pages[i].extract_text() or ""
            # Page marker keeps a way back to the PDF for figures.
            pages.append(f"\n\n<!-- page {i + 1} -->\n{text}")
        body = f"# Chapter {number}. {title}\n" + "".join(pages)
        target = out_dir / f"{name}.txt"
        target.write_text(body, encoding="utf-8")
        words = len(body.split())
        manifest.append(
            {
                "number": number,
                "title": title,
                "file": target.name,
                "first_page": start + 1,
                "last_page": end,
                "pages": end - start,
                "words": words,
            }
        )
        logger.info("%-45s pages %3d-%3d  %6d words", name, start + 1, end, words)

    (out_dir / "chapters.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    logger.info("Wrote %d chapters to %s", len(manifest), out_dir)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    if len(sys.argv) != 3:
        sys.exit("usage: extract_chapters.py <book.pdf> <output_dir>")
    extract(Path(sys.argv[1]), Path(sys.argv[2]))
