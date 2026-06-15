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
    "library.js", "search.js", "onboarding.js",
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
    ("S4", "present", "NEST_STAGES 5단계 + getNestStageByXp", ADAPTER_FILES,
        r"NEST_STAGES[\s\S]*getNestStageByXp|getNestStageByXp[\s\S]*NEST_STAGES"),
    # #522: 둥지 단계는 XP 단일 소스. NestTheatre 가 xp prop 으로 받아 getNestStageByXp 로 계산하고,
    # 프로필(LibraryView)은 state.xp 를 그대로 넘긴다 → 세리머니(newLv)와 항상 일치(책 진도% 재도입 금지).
    ("S4", "present", "NestTheatre 둥지 단계 = XP 단일 소스 (#522)",
        ["nest.js"], r"function NestTheatre\(\{\s*xp"),
    ("S4", "present", "프로필 NestTheatre 에 state.xp 전달 (#522 단일 소스)",
        ["library.js"], r"NestTheatre\s+xp=\{state\.xp\}"),
    ("S4", "present", "둥지 단계 안내 가이드 팝업 (#511)",
        ["nest.js"], r"둥지가 자라는 방법"),
    ("S4", "present", "세리머니 한 문장 카드 정직 표시 — bookQuoteCount (#549)",
        ["nest.js"], r"bookQuoteCount"),
    ("S4", "present", "빠른입력 페이지/한 문장 독립 제출 (#497)",
        ["nest.js"], r"submitPage[\s\S]*submitSentence|submitSentence[\s\S]*submitPage"),
    ("S4", "present", "이 책 한 문장 전체기간 + 좋아요·삭제 (#499)",
        ["nest.js"], r"bookQuotes[\s\S]*delHomeQuote|delHomeQuote[\s\S]*bookQuotes"),
    ("S4", "present", "5단계 이모지 시퀀스 🪵🪹🏠🏡🏰", ADAPTER_FILES,
        r"🪵[\s\S]*🪹[\s\S]*🏠[\s\S]*🏡[\s\S]*🏰"),
    ("S4", "present", "1,600 XP 주기 단계 임계값 (maxXp 99/399/899/1599)", ADAPTER_FILES,
        r"99[\s\S]{0,40}399[\s\S]{0,40}899[\s\S]{0,40}1599"),
    ("S4", "present", "진화 마이크로카피 4종", None,
        r"자리를 잡|살림을 차|다정한 이웃|성주"),

    # ── S5: 성(🏰) 컬렉션 (완독 파생) ─────────────────────────
    ("S5", "present", "성 컬렉션 — castles.list 사용 + 🏰 배지", FEATURE_FILES,
        r"castles\.list|🏰\s*[×xX]"),

    # ── S6: 완독 별점 + 소감 ──────────────────────────────────
    ("S6", "present", "완독 별점/소감 (rating + review_text)", FEATURE_FILES,
        r"rating[\s\S]*review_text|review_text[\s\S]*rating"),

    # ── S7: 페이지 기반 스포일러 블라인드 ─────────────────────
    ("S7", "present", "한 문장/감상 공개·비공개 토글 (QA #12)", FEATURE_FILES, r"setVisibility|note_private"),
    ("S7", "present", "페이지 블라인드 (spoiler.myCurrentPage + 카피)", FEATURE_FILES,
        r"myCurrentPage|아직 안 읽은|탭하면 보기|스포일러 그냥 보기"),

    # ── B: Phase 1 실데이터 배선 (클로즈베타, PR #162) ─────────
    ("B", "absent", "소셜 피드 데모 NPC_QUOTES 잔재 (실 피드 대체)",
        ["social.js"], r"NPC_QUOTES"),
    ("B", "present", "소셜 피드 실데이터 (feed/추천 탭)",
        ["social.js"], r"feedRecommended|\.feed\(|feedFollowing"),
    ("B", "present", "이번 주 신규 시작러 Top3 (social.md §5.7, startedThisWeek)",
        ["social.js"], r"startedThisWeek"),
    ("B", "absent", "서재 데모 상수 잔재 (INITIAL_BOOKSHELF/INITIAL_PROGRESS/RG_BOOKS/WISHLIST/getBook)",
        ["library.js"], r"INITIAL_BOOKSHELF|INITIAL_PROGRESS|RG_BOOKS|WISHLIST|getBook\("),
    ("B", "present", "서재 실 myBooks 배선 (myBooks.list)",
        ["library.js"], r"myBooks\.list"),
    ("B", "present", "알라딘 책 검색 (ALADIN_PROXY)",
        ["search.js"], r"ALADIN_PROXY"),
    ("B", "present", "타인 프로필 보기 (UserProfileModal)",
        ["components.js"], r"UserProfileModal"),
    ("B", "present", "DataStore→Supabase 스왑 (쓰기 경로 활성)",
        ["app.js"], r"window\.DataStore = window\.SupabaseDataStore"),
    ("B", "present", "sentences book_id 임베드 (무작위회상·사후감상 실모드)",
        ["datastore-supabase.js"], r"user_book:user_books\(book_id"),
    ("B", "present", "어댑터 대칭 — localStorage sentences.setNote/random",
        ["datastore.js"], r"setNote[\s\S]*random\(\)|random\(\)[\s\S]*setNote"),
    ("B", "present", "관련 도서 추천 — recommendRelated + books.related (#496)",
        ["data.js", "datastore.js"], r"recommendRelated"),
    ("B", "present", "관련 도서 ISBN 환각 필터 — filterRelatedCandidates (#496)",
        ["data.js"], r"filterRelatedCandidates"),
    ("B", "present", "책 상세 관련 도서 캐러셀 (#496)",
        ["library.js"], r"함께 읽으면 좋은 책"),
    ("B", "present", "책 상세 책 소개(description) 표시 — DB 우선·폴백 (#530)",
        ["library.js"], r"book\.description[\s\S]*fetchBookDesc|fetchBookDesc[\s\S]*book\.description"),
    ("B", "present", "저장(❤️) 스탯 → 저장 문장 모달 — bookmarks 임베드 머지 (#510)",
        ["components.js"], r"savedExtra"),
    ("B", "present", "한 줄 소개 인라인 편집 — 프로필 헤더 (#515)",
        ["library.js"], r"bioEditing[\s\S]*saveBio|saveBio[\s\S]*bioEditing"),
    ("B", "present", "프로필 헤더 → 둥지 순서 (#508)",
        ["library.js"], r"프로필 정보 \(#508\)[\s\S]*프로필 헤더 아래로 이동 \(#508"),

    # ── C: post-beta 기능 (스펙↔구현 동기화 강제, decisions §8.4/§8.5) ──
    # 읽기 모드(ReadingMode/타이머) invariant 폐기 (#505) — 홈 빠른입력으로 일원화, 독서시간 측정 폐기
    # 책정보 수정(BookEditModal) → 서재 갱신 신호 (#512). 신호 누락 시 LibraryView stale → 미반영 회귀.
    ("C", "present", "책정보 수정 후 서재 갱신 신호 (#512)",
        ["nest.js"], r"rg:wish-changed"),
    ("C", "present", "활성 책 캐러셀 전환 (nest.md §5.3, #185)",
        ["nest.js"], r"switchBook"),
    ("C", "present", "운영 대시보드 (profile.md §5.8.9, #161)",
        ["components.js"], r"AdminDashboardModal"),
    ("C", "present", "한 문장 틴더 카드 (social.md, #186)",
        ["components.js"], r"TinderCards"),
    ("C", "present", "운영자 문의 (profile.md 설정, #문의)",
        ["datastore-supabase.js"], r"inquiries"),
    # 온보딩 — 정의 없는 Sparrow 컴포넌트 참조 금지 (#527). 🐦 이모지로 통일, 재도입 시 렌더 크래시.
    ("C", "absent", "미정의 Sparrow 컴포넌트 참조 (#527)",
        ["onboarding.js"], r"<Sparrow"),
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
