#!/usr/bin/env python3
"""Verify nest spec (docs/readinggo/specs/nest.md) invariants exist in code.

Strategy: presence checks (regex over JS source). Behavior correctness is
covered by E2E scenarios under tests/e2e/.

Exit 0 if all invariants pass. Exit 1 on any failure with a punch list.
"""

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


def find(pattern: str, text: str, flags: int = 0) -> bool:
    return re.search(pattern, text, flags) is not None


# spec section -> (description, file, regex pattern)
# v7 (2026-06-01): The Path(DynamicPath/ZIGZAG)·첫 7일 가속 invariant 제거 —
# v7은 The Path와 가속을 폐기하고 "둥지가 자란다"(진척률 5단계)로 대체. 부재 검증은
# align_v7.py(S3/S4)가 담당. 이 파일은 v7 둥지 *존재* invariant만 남긴다.
INVARIANTS = [
    (
        "§5.2",
        "NEST_STAGES 정의 (5단계 진화)",
        "data.js",
        r"const\s+NEST_STAGES\s*=",
    ),
    (
        "§5.2",
        "5단계 이모지 (나뭇가지 → 빈둥지 → 따뜻 → 다정 → 성) — #756 둥지·새 테마",
        "data.js",
        r"🌿.*🪹.*🪺.*🐣.*🏰",
    ),
    (
        "§5.2",
        "1,600 XP 주기 단계 임계값 (maxXp 99/399/899/1599)",
        "data.js",
        r"maxXp:\s*99\b.*maxXp:\s*399\b.*maxXp:\s*899\b.*maxXp:\s*1599\b",
    ),
    (
        "§5.2",
        "getNestStageByXp 함수 (XP 주기 단계)",
        "data.js",
        r"function\s+getNestStageByXp\b",
    ),
    (
        "§5.2",
        "진화 마이크로카피 (참새 자리잡기 등)",
        "nest.js|data.js|components.js",
        r"(자리를 잡|살림을 차|다정한 이웃|성주)",
    ),
    (
        # v7.2(#185): 활성 책 전환 = 좌우 리볼빙 캐러셀(시트 폐기). 구 ActiveBookSheet 대체.
        "§5.3",
        "활성 책 전환 — 좌우 캐러셀 (RG_activateBook, #185)",
        "nest.js",
        r"RG_activateBook",
    ),
    (
        # v7.2: 일일 미션(오늘 기록하기) = CheckinModal. 구 MissionModal 명칭 대체.
        "§5.4",
        "CheckinModal 컴포넌트 (오늘 기록하기 — 체크인)",
        "nest.js",
        r"function\s+CheckinModal\b",
    ),
    (
        "§5.2",
        "완독 세리머니 (🏰 표시)",
        "nest.js",
        r"🏰",
    ),
    (
        "§5.1",
        "NestView 최상위 컴포넌트",
        "nest.js",
        r"function\s+NestView\b",
    ),
    (
        "§5.1",
        "window.NestView 노출 (다른 파일에서 사용)",
        "nest.js",
        r"window\.NestView\s*=",
    ),
]


def check(section: str, desc: str, file_spec: str, pattern: str) -> tuple[bool, str]:
    files = file_spec.split("|")
    for f in files:
        try:
            text = read(f.strip())
        except FileNotFoundError:
            continue
        if find(pattern, text, re.DOTALL):
            return True, f"OK  [{section}] {desc} ({f.strip()})"
    return False, f"FAIL [{section}] {desc} — not found in {file_spec}"


def main() -> int:
    results = [check(s, d, f, p) for s, d, f, p in INVARIANTS]
    passed = sum(1 for ok, _ in results if ok)
    total = len(results)

    for ok, msg in results:
        print(msg, file=sys.stderr if not ok else sys.stdout)

    print(f"\n{passed}/{total} invariants passed", file=sys.stderr)
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
