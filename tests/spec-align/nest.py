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
INVARIANTS = [
    (
        "§5.1",
        "DynamicPath 컴포넌트",
        "nest.js",
        r"const\s+DynamicPath\s*=",
    ),
    (
        "§5.1",
        "ZIGZAG 지그재그 레이아웃 상수",
        "nest.js",
        r"const\s+ZIGZAG\s*=\s*\[",
    ),
    (
        "§5.2",
        "NEST_STAGES 정의 (5단계 진화)",
        "data.js",
        r"const\s+NEST_STAGES\s*=",
    ),
    (
        "§5.2",
        "5단계 이모지 (나뭇가지 → 빈둥지 → 따뜻 → 다정 → 성)",
        "data.js",
        r"🪵.*🪹.*🏠.*🏡.*🏰",
    ),
    (
        "§5.2",
        "진척률 임계값 20/50/80/99/100",
        "data.js",
        r"max:\s*20.*max:\s*50.*max:\s*80.*max:\s*99.*max:\s*100",
    ),
    (
        "§5.2",
        "getNestStage 함수",
        "data.js",
        r"const\s+getNestStage\s*=",
    ),
    (
        "§5.2 v5",
        "첫 7일 가속 모드 (D3/D7 트리거)",
        # accept presence in nest.js or data.js
        "nest.js|data.js",
        r"(가속|D3|D7|일자 기반|first.{0,10}week|accelerat)",
    ),
    (
        "§5.2",
        "진화 마이크로카피 (참새 자리잡기 등)",
        "nest.js|data.js|components.js",
        r"(자리를 잡|살림을 차|다정한 이웃|성주)",
    ),
    (
        "§5.3",
        "ActiveBookSheet 컴포넌트 (활성책 전환)",
        "nest.js",
        r"const\s+ActiveBookSheet\s*=",
    ),
    (
        "§5.4",
        "MissionModal 컴포넌트 (일일 미션)",
        "nest.js",
        r"const\s+MissionModal\s*=",
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
        r"const\s+NestView\s*=",
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
