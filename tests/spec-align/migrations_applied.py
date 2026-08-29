#!/usr/bin/env python3
"""Verify Supabase migrations are actually applied to the Production database.

근거: [LF: Spec Drift 방어](../../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-spec-drift-defense).
코드/`.sql`은 main에 머지돼도 프로덕션 DB에 적용되지 않으면 런타임 400
(`column ... does not exist`)으로 조용히 실패한다 (2026-06-16 QA: 11/22/23 누락).

전략: docs/readinggo/supabase/*.sql (`*.dev.sql` 제외)에서 `add column if not exists` 와
`create table if not exists` 대상을 schema-qualified 객체로 파싱하고, Supabase Management
API로 Production 프로젝트의 expected schema만 조회해 **DB에 없는 마이그레이션 객체**를
보고한다.

Read-only — DDL 을 실행하지 않는다 (감지 전용). 적용은 사람이 확인 후 수동/승인.

Exit 0: 전부 적용됨 — 또는 API 일시 5xx·네트워크/타임아웃으로 검사 불가 시 skip(경고).
Exit 1: 미적용 객체 존재(punch list).
Exit 2: 설정 오류(토큰 미설정, 4xx 토큰/프로젝트).
Exit 3: SQL parser 오류. 이 경우 live DB drift로 보고하지 않는다.

Env:
  SUPABASE_ACCESS_TOKEN   Management API 토큰(sbp_...). 없으면 ROOT/.env 폴백.
  SUPABASE_PROJECT_REF    Production 프로젝트 ref (기본: cttllwwkaddghqttyhkg).
"""

from __future__ import annotations

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
_IDENT = r'(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)'
_QUALIFIED_IDENT = re.compile(rf"(?:(?P<schema>{_IDENT})\.)?(?P<table>{_IDENT})\Z")


class MigrationParseError(ValueError):
    """Raised when a tracked migration statement has an unsupported table target."""


def _strip_sql_comments(text: str) -> str:
    """Drop `-- ...` line comments so trailing column comments don't confuse parsing."""
    return re.sub(r"--[^\n]*", "", text)


def _normalize_identifier(identifier: str) -> str:
    """Match PostgreSQL identifier folding: unquoted lower-case, quoted exact-case."""
    if identifier.startswith('"') and identifier.endswith('"'):
        return identifier[1:-1].replace('""', '"')
    return identifier.lower()


def _parse_table_target(token: str, source: Path) -> tuple[str, str]:
    match = _QUALIFIED_IDENT.fullmatch(token)
    if not match:
        raise MigrationParseError(f"{source.name}: unsupported table target {token!r}")
    schema = _normalize_identifier(match.group("schema") or "public")
    table = _normalize_identifier(match.group("table"))
    return schema, table


def parse_expected(
    sql_dir: Path = SQL_DIR,
) -> tuple[set[tuple[str, str, str]], set[tuple[str, str]]]:
    """Return expected (schema, table, column) and (schema, table) objects."""
    cols: set[tuple[str, str, str]] = set()
    tables: set[tuple[str, str]] = set()
    for path in sorted(sql_dir.glob("*.sql")):
        # `*.dev.sql` is intentionally applied only to the isolated DEV project.
        # Production drift checks must not require those DEV-only tables.
        if path.name.endswith(".dev.sql"):
            continue
        raw = _strip_sql_comments(path.read_text(encoding="utf-8"))
        for statement in re.finditer(
            r"create\s+table\s+if\s+not\s+exists\s+(?P<target>[^\s(]+)",
            raw,
            re.I,
        ):
            tables.add(_parse_table_target(statement.group("target"), path))
        # `alter table [if exists] schema.X ... ;` block — apply add/drop columns in migration order.
        for block in re.finditer(
            r"alter\s+table\s+(?:if\s+exists\s+)?(?P<target>[^\s;]+)(?P<body>.*?);",
            raw,
            re.I | re.S,
        ):
            schema, table = _parse_table_target(block.group("target"), path)
            body = block.group("body")
            for column in re.finditer(
                rf"add\s+column\s+if\s+not\s+exists\s+(?P<column>{_IDENT})",
                body,
                re.I,
            ):
                cols.add(
                    (schema, table, _normalize_identifier(column.group("column")))
                )
            for column in re.finditer(
                rf"drop\s+column\s+(?:if\s+exists\s+)?(?P<column>{_IDENT})",
                body,
                re.I,
            ):
                cols.discard(
                    (schema, table, _normalize_identifier(column.group("column")))
                )
    return cols, tables


def find_missing(
    expected_cols: set[tuple[str, str, str]],
    expected_tables: set[tuple[str, str]],
    live_cols: set[tuple[str, str, str]],
    live_tables: set[tuple[str, str]],
) -> list[str]:
    """Return fully-qualified missing objects without duplicating missing-table columns."""
    missing: list[str] = []
    for schema, table in sorted(expected_tables):
        if (schema, table) not in live_tables:
            missing.append(f"table {schema}.{table}")
    for schema, table, column in sorted(expected_cols):
        if (schema, table) in live_tables and (schema, table, column) not in live_cols:
            missing.append(f"column {schema}.{table}.{column}")
    return missing


def _token() -> str | None:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if token:
        return token.strip()
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("SUPABASE_ACCESS_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _query(ref: str, token: str, sql: str) -> list[dict]:
    url = f"https://api.supabase.com/v1/projects/{ref}/database/query"
    request = urllib.request.Request(
        url,
        method="POST",
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "readinggo-migration-check/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310
        return json.loads(response.read().decode("utf-8"))


def _sql_string(value: str) -> str:
    """Quote a parsed SQL identifier as an information_schema string literal."""
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    try:
        expected_cols, expected_tables = parse_expected()
    except (MigrationParseError, OSError, UnicodeError) as error:
        print(f"FAIL: migration SQL parser error: {error}", file=sys.stderr)
        return 3

    token = _token()
    if not token:
        print(
            "FAIL: SUPABASE_ACCESS_TOKEN not set (env or .env). "
            "CI: add it as a repo secret. Local: it's in .env.",
            file=sys.stderr,
        )
        return 2

    ref = os.environ.get("SUPABASE_PROJECT_REF", DEFAULT_REF)
    schemas = sorted(
        {schema for schema, _ in expected_tables}
        | {schema for schema, _, _ in expected_cols}
    )
    schema_literals = ", ".join(_sql_string(schema) for schema in schemas)
    print(
        f"Target: Production Supabase project {ref} (read-only); "
        f"schemas={','.join(schemas)}"
    )
    try:
        column_rows = _query(
            ref,
            token,
            "select table_schema, table_name, column_name "
            "from information_schema.columns "
            f"where table_schema in ({schema_literals});",
        )
        table_rows = _query(
            ref,
            token,
            "select table_schema, table_name from information_schema.tables "
            f"where table_schema in ({schema_literals});",
        )
    except urllib.error.HTTPError as error:
        # 5xx = Supabase 일시 장애 ≠ drift. 4xx = 토큰/프로젝트 설정 오류.
        if error.code >= 500:
            print(
                f"::warning::migrations 검사 skip — Management API 일시 오류 "
                f"(HTTP {error.code}). 마이그레이션 드리프트 아님(서버 측). (#699)",
                file=sys.stderr,
            )
            return 0
        print(
            f"FAIL: Management API 설정 오류: HTTP {error.code} {error.reason}",
            file=sys.stderr,
        )
        return 2
    except (urllib.error.URLError, TimeoutError) as error:
        print(
            f"::warning::migrations 검사 skip — Management API 통신 실패 ({error}). "
            f"네트워크/타임아웃. (#699)",
            file=sys.stderr,
        )
        return 0

    live_cols = {
        (
            row["table_schema"],
            row["table_name"],
            row["column_name"],
        )
        for row in column_rows
    }
    live_tables = {
        (row["table_schema"], row["table_name"]) for row in table_rows
    }
    missing = find_missing(expected_cols, expected_tables, live_cols, live_tables)

    if missing:
        print(
            "FAIL: migration objects missing from Production live DB "
            "(unapplied .sql in docs/readinggo/supabase/):",
            file=sys.stderr,
        )
        for item in missing:
            print(f"  - {item}", file=sys.stderr)
        print(f"\n{len(missing)} object(s) missing", file=sys.stderr)
        return 1

    print(
        f"OK: all {len(expected_tables)} tables + {len(expected_cols)} "
        "migration columns present in Production live DB"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
