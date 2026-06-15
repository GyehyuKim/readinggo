#!/usr/bin/env python3
"""Verify Supabase migrations are actually applied to the live database.

근거: [LF: Spec Drift 방어](../../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-spec-drift-defense).
코드/`.sql`은 main에 머지돼도 프로덕션 DB에 적용되지 않으면 런타임 400
(`column ... does not exist`)으로 조용히 실패한다 (2026-06-16 QA: 11/22/23 누락).

전략: docs/readinggo/supabase/*.sql 에서 `add column if not exists` 와
`create table if not exists` 대상을 파싱하고, Supabase Management API 로
라이브 프로젝트의 information_schema 를 조회해 **DB 에 없는 마이그레이션 객체**를
보고한다.

Read-only — DDL 을 실행하지 않는다 (감지 전용). 적용은 사람이 확인 후 수동/승인.

Exit 0: 전부 적용됨.  Exit 1: 미적용 객체 존재(punch list).  Exit 2: 설정/통신 오류.

Env:
  SUPABASE_ACCESS_TOKEN   Management API 토큰(sbp_...). 없으면 ROOT/.env 폴백.
  SUPABASE_PROJECT_REF    프로젝트 ref (기본: cttllwwkaddghqttyhkg).
"""

import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
SQL_DIR = ROOT / "docs" / "readinggo" / "supabase"
DEFAULT_REF = "cttllwwkaddghqttyhkg"


def _strip_sql_comments(text: str) -> str:
    """Drop `-- ...` line comments so trailing column comments don't confuse parsing."""
    return re.sub(r"--[^\n]*", "", text)


def parse_expected() -> tuple[set[tuple[str, str]], set[str]]:
    """Return (expected (table, column) pairs, expected table names) from all *.sql."""
    cols: set[tuple[str, str]] = set()
    tables: set[str] = set()
    for f in sorted(SQL_DIR.glob("*.sql")):
        raw = _strip_sql_comments(f.read_text(encoding="utf-8"))
        for m in re.finditer(
            r"create\s+table\s+if\s+not\s+exists\s+(?:public\.)?(\w+)", raw, re.I
        ):
            tables.add(m.group(1).lower())
        # `alter table public.X ... ;` block — collect every add-column inside it.
        for blk in re.finditer(
            r"alter\s+table\s+(?:public\.)?(\w+)(.*?);", raw, re.I | re.S
        ):
            tbl = blk.group(1).lower()
            for cm in re.finditer(
                r"add\s+column\s+if\s+not\s+exists\s+(\w+)", blk.group(2), re.I
            ):
                cols.add((tbl, cm.group(1).lower()))
    return cols, tables


def _token() -> str | None:
    t = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if t:
        return t.strip()
    envf = ROOT / ".env"
    if envf.exists():
        for line in envf.read_text(encoding="utf-8").splitlines():
            if line.startswith("SUPABASE_ACCESS_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _query(ref: str, token: str, sql: str) -> list[dict]:
    url = f"https://api.supabase.com/v1/projects/{ref}/database/query"
    req = urllib.request.Request(
        url,
        method="POST",
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "readinggo-migration-check/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 (trusted host)
        return json.loads(r.read().decode("utf-8"))


def main() -> int:
    exp_cols, exp_tables = parse_expected()
    token = _token()
    if not token:
        print(
            "FAIL: SUPABASE_ACCESS_TOKEN not set (env or .env). "
            "CI: add it as a repo secret. Local: it's in .env.",
            file=sys.stderr,
        )
        return 2
    ref = os.environ.get("SUPABASE_PROJECT_REF", DEFAULT_REF)
    try:
        col_rows = _query(
            ref,
            token,
            "select table_name, column_name from information_schema.columns "
            "where table_schema='public';",
        )
        tbl_rows = _query(
            ref,
            token,
            "select table_name from information_schema.tables "
            "where table_schema='public';",
        )
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        print(f"FAIL: Management API error: {e}", file=sys.stderr)
        return 2

    live_cols = {(r["table_name"].lower(), r["column_name"].lower()) for r in col_rows}
    live_tables = {r["table_name"].lower() for r in tbl_rows}

    missing: list[str] = []
    for t in sorted(exp_tables):
        if t not in live_tables:
            missing.append(f"table {t}")
    for t, c in sorted(exp_cols):
        # Only flag a column when its table exists; a missing table is reported above.
        if t in live_tables and (t, c) not in live_cols:
            missing.append(f"column {t}.{c}")

    if missing:
        print(
            "FAIL: migration objects missing from live DB "
            "(unapplied .sql in docs/readinggo/supabase/):",
            file=sys.stderr,
        )
        for m in missing:
            print(f"  - {m}", file=sys.stderr)
        print(f"\n{len(missing)} object(s) missing", file=sys.stderr)
        return 1

    print(
        f"OK: all {len(exp_tables)} tables + {len(exp_cols)} "
        "migration columns present in live DB"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
