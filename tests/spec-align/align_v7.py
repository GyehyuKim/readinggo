#!/usr/bin/env python3
"""ReadingGo v7 spec-alignment gate for docs/readinggo/js/  (issue #124, S1-S7).

Two invariant kinds:
  - absent  : v6 residue that v7 removes — match count MUST be 0
  - present : v7 feature that MUST exist (>=1 match)

Each invariant is tagged with the story (S1-S7) it gates, so an executor can
flip one story green at a time. Model-external (Ralph cannot self-grade — LF:
Goodhart). Presence = grep-level only; behavior is covered by E2E.

Usage:
  python tests/spec-align/align_v7.py            # all stories
  python tests/spec-align/align_v7.py S2 S3      # only listed stories
Exit 0 if every checked invariant passes, 1 otherwise.
"""

import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
JS_DIR = ROOT / "docs" / "readinggo" / "js"

# Feature files: v6 residue and direct localStorage are forbidden here.
FEATURE_FILES = [
    "app.js", "components.js", "nest.js", "social.js",
    "library.js", "village.js", "town.js", "search.js", "onboarding.js",
]
# Adapter layer: exempt from the "no direct localStorage" rule (S1).
ADAPTER_FILES = ["data.js", "datastore.js"]


def load(names):
    """Return {filename: text} for existing js files in `names` (None = all)."""
    out = {}
    for p in sorted(JS_DIR.glob("*.js")):
        if names is None or p.name in names:
            try:
                out[p.name] = p.read_text(encoding="utf-8")
            except OSError:
                pass
    return out


def count(pattern, text):
    return len(re.findall(pattern, text))


# (story, kind, description, scope, pattern)
#   kind  : "absent" | "present"
#   scope : list of filenames, or None for all js files
INVARIANTS = [
    # ── S1: DataStore 계약 추출 ────────────────────────────────
    ("S1", "present", "DataStore 모듈 노출 (window.DataStore)",
        ADAPTER_FILES, r"window\.DataStore\s*="),
    ("S1", "present", "DataStore 계약 메서드 표면 (addToday/bumpOnCheckIn/myCurrentPage)",
        ADAPTER_FILES, r"addToday"),
    ("S1", "present", "DataStore 계약 — 완독/성/짹 (books.complete·castles·claps)",
        ADAPTER_FILES, r"complete\b[\s\S]*castles[\s\S]*claps|claps[\s\S]*castles"),
    ("S1", "absent", "피처 파일 localStorage 직접 호출 (어댑터만 허용)",
        FEATURE_FILES, r"localStorage\.(get|set)Item"),

    # ── S2: 용어 (모이→한 문장, 짹 1종) ────────────────────────
    ("S2", "absent", "'모이' UI 카피 잔재", None, r"모이"),
    ("S2", "absent", "👏/🥹 3종 리액션 이모지 잔재", None, r"👏|🥹"),
    ("S2", "absent", "claps/tears/marks 3종 리액션 필드 잔재", None, r"\btears\b|clapActive|tearActive|markActive"),
    ("S2", "present", "짹 단일 리액션 (좋아요 토글)", FEATURE_FILES, r"짹"),

    # ── S3: 구조 제거 (The Path, 주간 리그) ────────────────────
    ("S3", "absent", "The Path / 세션 노드 지그재그 잔재", None,
        r"The Path|path-wrap|pathNodes|DynamicPath|ZIGZAG"),
    ("S3", "absent", "주간 리그 잔재 (league/리그)", None, r"league|리그"),

    # ── S4: 둥지가 자란다 (진척률 5단계) ──────────────────────
    ("S4", "absent", "구 8단계 health-decay 둥지 잔재", None,
        r"nestHealth|twigCount|NEST_LADDER|daysSinceRead"),
    ("S4", "present", "NEST_STAGES 5단계 + getNestStage", ADAPTER_FILES,
        r"NEST_STAGES[\s\S]*getNestStage|getNestStage[\s\S]*NEST_STAGES"),
    ("S4", "present", "5단계 이모지 시퀀스 🪵🪹🏠🏡🏰", ADAPTER_FILES,
        r"🪵[\s\S]*🪹[\s\S]*🏠[\s\S]*🏡[\s\S]*🏰"),
    ("S4", "present", "진척률 임계값 20/50/80/99/100", ADAPTER_FILES,
        r"20[\s\S]{0,40}50[\s\S]{0,40}80[\s\S]{0,40}99[\s\S]{0,40}100"),
    ("S4", "present", "진화 마이크로카피 4종", None,
        r"자리를 잡|살림을 차|다정한 이웃|성주"),

    # ── S5: 성(🏰) 컬렉션 (완독 파생) ─────────────────────────
    ("S5", "present", "성 컬렉션 — castles.list 사용 + 🏰 배지", FEATURE_FILES,
        r"castles\.list|🏰\s*[×xX]"),

    # ── S6: 완독 별점 + 소감 ──────────────────────────────────
    ("S6", "present", "완독 별점/소감 (rating + review_text)", FEATURE_FILES,
        r"rating[\s\S]*review_text|review_text[\s\S]*rating"),

    # ── S7: 페이지 기반 스포일러 블라인드 ─────────────────────
    ("S7", "absent", "is_private 수동 비공개 잔재", None, r"is_private|isSpoiler"),
    ("S7", "present", "페이지 블라인드 (spoiler.myCurrentPage + 카피)", FEATURE_FILES,
        r"myCurrentPage|아직 안 읽은|탭하면 보기|스포일러 그냥 보기"),
]


def run(stories):
    selected = [iv for iv in INVARIANTS if stories is None or iv[0] in stories]
    results = []
    for story, kind, desc, scope, pattern in selected:
        texts = load(scope)
        hits = {f: count(pattern, t) for f, t in texts.items()}
        total = sum(hits.values())
        if kind == "absent":
            ok = total == 0
            where = ", ".join(f"{f}:{n}" for f, n in hits.items() if n) or "—"
            detail = f"잔재 {total}건 ({where})" if not ok else "0건"
        else:  # present
            ok = total > 0
            where = ", ".join(f for f, n in hits.items() if n) or "없음"
            detail = f"발견 ({where})" if ok else "미발견"
        results.append((story, kind, ok, desc, detail))
    return results


def main():
    args = [a.upper() for a in sys.argv[1:]]
    stories = set(args) if args else None
    results = run(stories)

    passed = sum(1 for r in results if r[2])
    total = len(results)

    cur = None
    for story, kind, ok, desc, detail in results:
        if story != cur:
            print(f"\n[{story}]")
            cur = story
        tag = "OK  " if ok else "FAIL"
        print(f"  {tag} ({kind:7}) {desc} — {detail}")

    scope_note = f" (stories: {', '.join(sorted(stories))})" if stories else ""
    print(f"\n{passed}/{total} v7 invariants passed{scope_note}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
