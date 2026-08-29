#!/usr/bin/env python3
"""Regression tests for the schema-aware migration drift checker."""

import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("migrations_applied.py")
SPEC = importlib.util.spec_from_file_location("migrations_applied", MODULE_PATH)
assert SPEC and SPEC.loader
MIGRATIONS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIGRATIONS)


class ParseExpectedTests(unittest.TestCase):
    def test_preserves_schema_for_create_and_alter(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sql_dir = Path(directory)
            (sql_dir / "01_schema.sql").write_text(
                """
                create table if not exists migration_backups.phase4_increment_xp (
                    id bigint primary key
                );
                alter table migration_backups.phase4_users_public_view
                    add column if not exists definition text;
                create table if not exists public.reading_sessions (id bigint);
                alter table books add column if not exists subtitle text;
                """,
                encoding="utf-8",
            )

            columns, tables = MIGRATIONS.parse_expected(sql_dir)

        self.assertIn(("migration_backups", "phase4_increment_xp"), tables)
        self.assertIn(("public", "reading_sessions"), tables)
        self.assertIn(
            ("migration_backups", "phase4_users_public_view", "definition"),
            columns,
        )
        self.assertIn(("public", "books", "subtitle"), columns)
        self.assertNotIn(("public", "migration_backups"), tables)

    def test_later_drop_column_removes_previous_expected_column(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sql_dir = Path(directory)
            (sql_dir / "01_add.sql").write_text(
                "alter table public.streak add column if not exists last_repair_date date;",
                encoding="utf-8",
            )
            (sql_dir / "02_drop.sql").write_text(
                "alter table if exists public.streak drop column if exists last_repair_date;",
                encoding="utf-8",
            )

            columns, _ = MIGRATIONS.parse_expected(sql_dir)

        self.assertNotIn(("public", "streak", "last_repair_date"), columns)

    def test_excludes_dev_only_sql(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sql_dir = Path(directory)
            (sql_dir / "01_prod.sql").write_text(
                "create table if not exists public.prod_table (id bigint);",
                encoding="utf-8",
            )
            (sql_dir / "02_fixture.dev.sql").write_text(
                "create table if not exists dev_private.fixture (id bigint);",
                encoding="utf-8",
            )

            _, tables = MIGRATIONS.parse_expected(sql_dir)

        self.assertEqual({("public", "prod_table")}, tables)

    def test_rejects_unsupported_three_part_target_as_parser_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sql_dir = Path(directory)
            (sql_dir / "01_invalid.sql").write_text(
                "create table if not exists db.public.books (id bigint);",
                encoding="utf-8",
            )

            with self.assertRaises(MIGRATIONS.MigrationParseError):
                MIGRATIONS.parse_expected(sql_dir)

    def test_current_phase4_backups_are_not_collapsed_to_schema_name(self) -> None:
        _, tables = MIGRATIONS.parse_expected(MIGRATIONS.SQL_DIR)

        self.assertIn(("migration_backups", "phase4_increment_xp"), tables)
        self.assertIn(("migration_backups", "phase4_users_public_view"), tables)
        self.assertNotIn(("public", "migration_backups"), tables)


class MissingObjectsTests(unittest.TestCase):
    def test_reports_fully_qualified_objects(self) -> None:
        expected_tables = {
            ("public", "books"),
            ("migration_backups", "phase4_increment_xp"),
        }
        expected_columns = {
            ("public", "books", "subtitle"),
            ("migration_backups", "phase4_increment_xp", "definition"),
        }
        live_tables = {("public", "books")}
        live_columns: set[tuple[str, str, str]] = set()

        missing = MIGRATIONS.find_missing(
            expected_columns,
            expected_tables,
            live_columns,
            live_tables,
        )

        self.assertEqual(
            [
                "table migration_backups.phase4_increment_xp",
                "column public.books.subtitle",
            ],
            missing,
        )


if __name__ == "__main__":
    unittest.main()
