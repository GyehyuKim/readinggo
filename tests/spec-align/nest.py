#!/usr/bin/env python3
"""Verify the active v17 book-tree route and Phase 4 legacy-absence contracts."""

import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
JS_DIR = ROOT / "docs" / "readinggo" / "js"


def read(rel: str) -> str:
    return (JS_DIR / rel).read_text(encoding="utf-8")


def check_present(section: str, desc: str, file: str, pattern: str):
    ok = re.search(pattern, read(file), re.DOTALL) is not None
    return ok, f"{'OK  ' if ok else 'FAIL'} [{section}] {desc} ({file})"


def check_absent(section: str, desc: str, files: list[str], pattern: str):
    existing = [name for name in files if (JS_DIR / name).exists()]
    corpus = "\n".join(read(name) for name in existing)
    ok = re.search(pattern, corpus, re.DOTALL) is None
    return ok, f"{'OK  ' if ok else 'FAIL'} [{section}] {desc}"


def main() -> int:
    results = [
        check_present("v17", "내부 nest-grow route는 BookTreeHomeView를 렌더", "app.js", r"activeTab === 'nest-grow'[\s\S]*BookTreeHomeView"),
        check_present("v17", "책나무 selector/UI 모듈 노출", "book-tree-home-ui.js", r"window\.BookTreeHomeView\s*="),
        check_present("v17", "홈 체크인·활성책 전환 유지", "nest.js", r"function\s+NestView\b[\s\S]*RG_activateBook"),
        check_absent("P4", "XP/둥지 진화 계산 제거", ["data.js", "nest.js", "app.js", "datastore.js", "datastore-supabase.js"], r"NEST_STAGES|NEST_CYCLE_XP|getNestStageByXp|nestXpProgress|nestCastleCount|XP_RULES|computeCheckinXp|grantXp"),
        check_absent("P4", "레거시 UI 모듈 제거", ["nest-theatre.js", "nest-grow.js", "streak-repair-copy.js"], r"."),
        check_absent("P4", "DataStore XP/성/만회 계약 제거", ["datastore.js", "datastore-supabase.js"], r"\bxp\s*:\s*\{|\bcastles\s*:\s*\{|repairStatus\s*\(|last_repair_date"),
    ]
    for ok, message in results:
        print(message, file=sys.stdout if ok else sys.stderr)
    passed = sum(ok for ok, _ in results)
    print(f"\n{passed}/{len(results)} invariants passed", file=sys.stderr)
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
