#!/usr/bin/env python3
"""Validate docs/readinggo/public/data/books.tsv against expected schema.

Exit 0 on success, 1 on any violation. Prints human-readable report.
Empty author/cover_url emit WARN (not fail) so partial data can land.

Schema: book_id<TAB>isbn<TAB>title<TAB>author<TAB>publisher<TAB>total_pages<TAB>cover_url

Run: python tests/data/validate-books.py
"""

import csv
import re
import sys
from pathlib import Path

TSV = Path(__file__).resolve().parents[2] / "docs" / "readinggo" / "public" / "data" / "books.tsv"
EXPECTED_HEADER = ["book_id", "isbn", "title", "author", "publisher", "total_pages", "cover_url"]
ID_PATTERN = re.compile(r"^b\d{3,}$")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)


def warn(msg: str) -> None:
    print(f"WARN: {msg}", file=sys.stderr)


def main() -> int:
    if not TSV.exists():
        fail(f"missing file: {TSV}")
        return 1

    errors: list[str] = []
    warnings: list[str] = []
    with TSV.open(encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t")
        rows = list(reader)

    if not rows:
        fail("empty file")
        return 1

    header = rows[0]
    if header != EXPECTED_HEADER:
        fail(f"header mismatch.\n  expected: {EXPECTED_HEADER}\n  got:      {header}")
        return 1

    seen_ids: set[str] = set()
    for line_no, row in enumerate(rows[1:], start=2):
        if len(row) != len(EXPECTED_HEADER):
            errors.append(f"line {line_no}: expected {len(EXPECTED_HEADER)} cols, got {len(row)}")
            continue
        book_id, isbn, title, author, publisher, total_pages, cover_url = row
        if not ID_PATTERN.match(book_id):
            errors.append(f"line {line_no}: bad book_id '{book_id}' (expected b\d{{3,}})")
        if book_id in seen_ids:
            errors.append(f"line {line_no}: duplicate book_id '{book_id}'")
        seen_ids.add(book_id)
        if not title.strip():
            errors.append(f"line {line_no}: empty title for {book_id}")
        if not total_pages.isdigit() or int(total_pages) <= 0:
            errors.append(f"line {line_no}: bad total_pages '{total_pages}' for {book_id}")
        if not author.strip():
            warnings.append(f"line {line_no}: empty author for {book_id} ({title})")
        if cover_url and not cover_url.startswith(("http://", "https://")):
            warnings.append(f"line {line_no}: bad cover_url '{cover_url}' for {book_id}")

    for w in warnings[:50]:
        warn(w)
    if len(warnings) > 50:
        warn(f"... ({len(warnings) - 50} more warnings)")

    if errors:
        for e in errors[:50]:
            fail(e)
        if len(errors) > 50:
            fail(f"... ({len(errors) - 50} more errors)")
        return 1

    suffix = f" ({len(warnings)} warnings)" if warnings else ""
    print(f"OK: {len(rows) - 1} books validated, schema clean{suffix}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
