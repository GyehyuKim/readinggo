#!/usr/bin/env python3
"""DESIGN.md 준수 린트 — always-on UI 규칙 강제 (stdlib only).

스캔 대상: docs/readinggo/js/*.js + docs/readinggo/index.html.
DESIGN.md(2026-06-19 리프레시 / #1032 구현)의 UI 규칙을 코드에서 위반하는 곳을 탐지한다.

탐지 카테고리
  1. emoji   — JS 안의 기능 UI 이모지(📖📚📦📸🔍🔖✍️⚙️✕🗑 등). RG_ICONS/rgIcon 로 통일해야 함.
               주석(// · /* */) 안과 allowlist(둥지 5단계·컴패니언·★/☆ 글리프)는 제외.   → exit 영향 O
  2. hex     — 피처 JS의 오프팔레트 raw hex 스타일값(color:'#..'/background:'#..' 등).
               var(--token) 으로 바꿔야 함. #fff/#000/#FFFFFF·OAuth·데이터팔레트 파일 제외.   → exit 영향 O
  3. ghost   — 투명 배경(transparent/none) + solid 보더 조합 = 폐기된 ghost 버튼. 2차 tonal 로.  → exit 영향 O
  4. radius  — 비표준 borderRadius 정수 리터럴(∉ {12,16,18}). --r-sm/md/lg 로.                 → warning(exit 미반영)

위반(emoji+hex+ghost)이 하나라도 있으면 exit 1. radius 는 warning 으로 카운트만 한다.
근거: DESIGN.md '## UI 규칙', Decisions Log #1062.
"""

import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "docs" / "readinggo"
JS_DIR = DEMO / "js"

# ── allowlists / 상수 (탐지 정책 source of truth) ─────────────────────────────

# 게임 시그니처 이모지는 허용 — 둥지 5단계(🌿빈가지→🪹빈둥지→🪺알→🐣부화→🏰성)와
# 컴패니언 동물(🦊🦝🐰🐹🐱), 그리고 ★/☆ 평점 글리프(이모지 아님). 이들은 플래그하지 않는다.
EMOJI_ALLOWLIST = set("🌿🪹🪺🐣🏰🦊🦝🐰🐹🐱★☆")

# DESIGN #696 은 *기능 UI 아이콘* 이모지만 SVG 로 통일 대상이다(RG_ICONS 대응 존재).
# 감정·게이미피케이션·상태 이모지(🔥스트릭·🌱성장·✨보상·💭내생각·✅⚠🎉 등)는 의도된 콘텐츠
# 어휘라 플래그하지 않는다(DESIGN '의도적 장식' 허용). base codepoint 로 비교(✏️=270F+FE0F 의 FE0F 무시).
FUNCTIONAL_ICON_EMOJI = {
    0x1F4D6, 0x1F4DA,        # 📖📚 book → RG_ICONS.book
    0x1F4E6,                 # 📦 box
    0x1F4F8, 0x1F4F7,        # 📸📷 camera
    0x1F50D, 0x1F50E,        # 🔍🔎 search
    0x1F516,                 # 🔖 bookmark
    0x270F, 0x270D,          # ✏️✍️ edit → pen
    0x2699,                  # ⚙️ settings
    0x2715, 0x2716, 0x274C,  # ✕✖️❌ close
    0x1F5D1,                 # 🗑️ trash
    0x1F3E0,                 # 🏠 home
    0x1F464,                 # 👤 user
    0x2709, 0x1F4EC,         # ✉️📬 mail
    0x1F4CB, 0x1F4DD,        # 📋📝 note/clipboard
    0x2B50,                  # ⭐ → ★/☆ 글리프
    0x1F517,                 # 🔗 link → share
    0x2764,                  # ❤️ heart (좋아요)
    # 같이읽기(숲) 방 UI 기능 이모지 → RG_ICONS (#1062 잔여 청소). 모두 RG_ICONS 대응 존재.
    0x1F522,                 # 🔢 → hash (초대 코드 복사)
    0x1F6AA,                 # 🚪 → logout (나가기)
    0x1F465,                 # 👥 → users (멤버 진척 탭)
    0x1F5D3,                 # 🗓️ → calendar (일정 탭·빈 상태)
    0x1F310,                 # 🌐 → globe (공개·책으로 검색 탭)
    0x1F510,                 # 🔐 → lock (코드·링크 탭)
    # 🔒(0x1F512)는 의도적으로 제외: RoomPreviewSheet 비밀번호 input 의 placeholder 텍스트 장식이라
    # rgIcon(JSX SVG)을 placeholder 속성(문자열)에 끼울 수 없다 — §5.2 텍스트 장식은 KEEP(#1062).
    # 공개/비공개 버튼의 🔒 는 lock 아이콘으로 변환됨(placeholder 한 곳만 이모지 유지).
    # 🔔(0x1F514)은 의도적으로 제외: RG_ICONS 에 bell 대응이 없어 "통일"할 SVG 가 없다.
    # 이 린트의 계약은 'RG_ICONS 대응이 존재하는' 기능 아이콘만 플래그한다(위 주석). bell 아이콘이
    # icons.js 에 추가되면 그때 여기 0x1F514 를 되살린다. (#1062 후속, settings-modal 헤딩)
}

# 데이터/콘텐츠 문자열의 이모지 면제 — rgIcon(JSX)을 끼워넣을 수 없는 자리(주석 사유 필수).
# 키 = 파일명, 값 = (codepoint, 사유) 집합. 시각 UI 버튼/헤딩 이모지는 절대 여기 넣지 않는다 —
# 어디까지나 ①데이터 모델 필드 ②토스트/공유 등 '콘텐츠 텍스트'(JSX 불가) 만 면제한다.
DATA_ICON_ALLOW = {
    # ceremony.js 의 보상 카드는 parts[].ico 문자열(데이터)을 <span>{p.ico}</span> 로 렌더한다.
    # 미션 아이콘 셋(📖 일일·🏰 완독·🔥 스트릭)은 데이터 모델 값이며 🏰🔥 는 이미 비-기능 이모지로
    # 통과한다. 📖 만 기능셋에 걸리므로 데이터 일관성(같은 카드 한 줄)을 위해 면제. UI 헤딩 아님.
    "data.js": {0x1F4D6},        # 📖 computeCheckinXp parts[].ico (미션 데이터 필드)
    # share-card.js 는 본 작업 할당 파일이 아니다(수정 불가). 아래 3건은 모두 *콘텐츠 텍스트* —
    # 네이티브 공유/클립보드로 나가는 문자열이라 SVG 아이콘(rgIcon=JSX)을 넣을 수 없다.
    "share-card.js": {0x1F4D6, 0x1F4CB},  # 📖 공유 텍스트 머리말 · 📋 복사 완료 토스트 메시지
}

# 내부 관리 툴 — 제품 UI 아님(제품 DESIGN.md 적용 대상 아님). 이모지·hex 검사 제외.
INTERNAL_SKIP_FILES = {"admin-dashboard.js"}

# 고-평면 픽토그래픽 이모지 블록(BMP 밖) — 거의 모든 멀티바이트 이모지.
# 0x1F300–0x1FAFF: Misc Symbols·Emoticons·Transport·Supplemental·Extended-A.
HIGH_EMOJI_RANGES = ((0x1F000, 0x1FAFF),)

# BMP(0x2300–0x2BFF) 영역에서 *이모지 표현* 픽토그래프만 명시 포함.
# 기하 도형(●○■ 25CF/25CB/25A0)·원문자(①② 2460+)·체크마크(✓ 2713)·빈 체크박스(☐ 2610)·
# 인용 장식(❝ 275D)·화살표·대시는 이모지가 아니므로 제외(미포함).
# ✕(2715)는 Unicode emoji=No 지만 DESIGN.md 가 닫기 버튼 기능 이모지로 지목 → 포함.
BMP_EMOJI = {
    0x2B50,  # ⭐
    0x2705,  # ✅
    0x2714,  # ✔️
    0x2716,  # ✖️
    0x2715,  # ✕  (닫기 — DESIGN.md 기능 이모지)
    0x274C,  # ❌
    0x274E,  # ❎
    0x2728,  # ✨
    0x2699,  # ⚙️
    0x26A0,  # ⚠️
    0x26A1,  # ⚡
    0x2764,  # ❤️
    0x270D,  # ✍️
    0x270F,  # ✏️
    0x2709,  # ✉️
    0x2611,  # ☑️
    0x23F8,  # ⏸️
    0x23F1,  # ⏱️
    0x23F3,  # ⏳
    0x231A,  # ⌚
    0x231B,  # ⌛
    0x2B55,  # ⭕
    0x2753,  # ❓
    0x2757,  # ❗
}

# hex 탐지에서 제외할 색(중립·OAuth 브랜드).
HEX_ALLOWLIST = {"#fff", "#000", "#ffffff", "#fee500", "#191919"}
# hex 탐지에서 제외할 파일(데이터/팔레트 정의 — raw hex 가 정당).
HEX_SKIP_FILES = {"data.js", "icons.js"}  # + datastore*.js (접두 매칭)

# raw hex 가 들어갈 수 있는 스타일 속성(JSX 인라인 스타일).
HEX_PROPS = (
    "color|background|backgroundColor|borderColor|fill|stroke|boxShadow|"
    "outline|outlineColor|borderTopColor|borderBottomColor|border"
)
HEX_RE = re.compile(r"(?:%s)\s*:\s*'(#[0-9A-Fa-f]{3,8})'" % HEX_PROPS)

# ghost 버튼: 투명/none 배경 + solid 보더.
GHOST_BG_RE = re.compile(r"background(?:Color)?\s*:\s*'(?:transparent|none)'")
GHOST_BORDER_RE = re.compile(r"border\s*:\s*'[^']*\bsolid\b[^']*'")

# 비표준 라운딩: borderRadius 정수 리터럴 N. 허용·제외값.
RADIUS_OK = {12, 16, 18}            # DESIGN.md --r-sm/md/lg
RADIUS_EXCLUDE = {50, 999, 9999}   # pill/원형 (+ '50%' 는 정수 아님이라 자동 제외)
RADIUS_RE = re.compile(r"borderRadius\s*:\s*([0-9]+)\b")


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def is_emoji(ch: str) -> bool:
    cp = ord(ch)
    if any(a <= cp <= b for a, b in HIGH_EMOJI_RANGES):
        return True
    return cp in BMP_EMOJI


def strip_comments(src: str) -> str:
    """주석(// , /* */)을 공백으로 치환하되 문자열 리터럴과 줄바꿈은 보존한다.

    문자열 안의 이모지(기능 UI 라벨)는 살리고, 주석 안의 이모지(설명문)는 지운다.
    줄 수를 보존해 file:line 보고가 정확하도록 \n 은 유지한다.
    """
    out = []
    i, n = 0, len(src)
    state = "code"  # code | line | block | sq | dq | tick
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if state == "code":
            if c == "/" and nxt == "/":
                state = "line"; out.append("  "); i += 2; continue
            if c == "/" and nxt == "*":
                state = "block"; out.append("  "); i += 2; continue
            if c == "'":
                state = "sq"
            elif c == '"':
                state = "dq"
            elif c == "`":
                state = "tick"
            out.append(c); i += 1; continue
        if state == "line":
            if c == "\n":
                state = "code"; out.append("\n")
            else:
                out.append(" ")
            i += 1; continue
        if state == "block":
            if c == "*" and nxt == "/":
                state = "code"; out.append("  "); i += 2; continue
            out.append("\n" if c == "\n" else " "); i += 1; continue
        # 문자열 상태(sq/dq/tick)
        quote = {"sq": "'", "dq": '"', "tick": "`"}[state]
        if c == "\\":
            out.append(c)
            if nxt:
                out.append(nxt)
            i += 2; continue
        if c == quote:
            state = "code"
        out.append(c); i += 1; continue
    return "".join(out)


def scan_files():
    # 테스트 파일(*.test.js)은 제품 UI 아님 — 제외.
    files = sorted(f for f in JS_DIR.glob("*.js") if not f.name.endswith(".test.js"))
    index = DEMO / "index.html"
    if index.exists():
        files.append(index)
    return files


# ── 탐지기 ───────────────────────────────────────────────────────────────────

def find_emoji(path: Path):
    """JS 안의 *기능 UI 아이콘* 이모지(DESIGN #696). 주석·내부툴 제외. → [(rel, line, char)]
    감정/게이미피케이션/상태 이모지는 FUNCTIONAL_ICON_EMOJI 에 없으므로 자연히 제외된다."""
    hits = []
    if path.suffix != ".js" or path.name in INTERNAL_SKIP_FILES:
        return hits  # 이모지 규칙은 JS 한정(DESIGN '## UI 규칙') · 내부툴 제외
    allow = DATA_ICON_ALLOW.get(path.name, set())  # 데이터/콘텐츠 문자열 면제(주석 사유)
    code = strip_comments(path.read_text(encoding="utf-8"))
    for ln, line in enumerate(code.split("\n"), 1):
        for ch in line:
            cp = ord(ch)
            if cp in (0xFE0F, 0x200D):      # variation selector / ZWJ 무시
                continue
            if cp in FUNCTIONAL_ICON_EMOJI and cp not in allow:
                hits.append((path.name, ln, ch))
    return hits


def find_hex(path: Path):
    """피처 JS 의 오프팔레트 raw hex 스타일값. → [(rel, line, hex)]"""
    hits = []
    if path.suffix != ".js":
        return hits
    name = path.name
    if name in HEX_SKIP_FILES or name.startswith("datastore") or name in INTERNAL_SKIP_FILES:
        return hits
    code = strip_comments(path.read_text(encoding="utf-8"))
    for ln, line in enumerate(code.split("\n"), 1):
        for m in HEX_RE.finditer(line):
            hx = m.group(1)
            if hx.lower() in HEX_ALLOWLIST:
                continue
            hits.append((name, ln, hx))
    return hits


def find_ghost(path: Path):
    """투명 배경 + solid 보더 = ghost 버튼. → [(rel, line)]"""
    hits = []
    text = path.read_text(encoding="utf-8")
    for ln, line in enumerate(text.split("\n"), 1):
        if GHOST_BG_RE.search(line) and GHOST_BORDER_RE.search(line):
            hits.append((path.name, ln))
    return hits


def find_radius(path: Path):
    """비표준 borderRadius 정수 리터럴. → [(rel, line, value)]  (warning)"""
    hits = []
    if path.suffix != ".js":
        return hits
    text = path.read_text(encoding="utf-8")
    for ln, line in enumerate(text.split("\n"), 1):
        for m in RADIUS_RE.finditer(line):
            v = int(m.group(1))
            if v in RADIUS_OK or v in RADIUS_EXCLUDE:
                continue
            hits.append((path.name, ln, v))
    return hits


# ── 리포트 ───────────────────────────────────────────────────────────────────

def _examples(hits, fmt, limit=12):
    for h in hits[:limit]:
        print("    " + fmt(h))
    if len(hits) > limit:
        print(f"    … (+{len(hits) - limit} more)")


def main() -> int:
    files = scan_files()
    emoji, hexes, ghosts, radii = [], [], [], []
    for f in files:
        emoji += find_emoji(f)
        hexes += find_hex(f)
        ghosts += find_ghost(f)
        radii += find_radius(f)

    print("=" * 60)
    print("DESIGN.md 준수 린트 (design_lint.py)")
    print(f"스캔: {len(files)} files  ({JS_DIR.relative_to(ROOT)}/*.js + index.html)")
    print("=" * 60)

    # 1) emoji
    print(f"\n[1] 기능 이모지 (RG_ICONS/rgIcon 로 통일):  {len(emoji)} 건")
    by_char = {}
    for _, _, ch in emoji:
        by_char[ch] = by_char.get(ch, 0) + 1
    top = sorted(by_char.items(), key=lambda kv: -kv[1])[:10]
    if top:
        print("    자주 쓰인 이모지:  " + "  ".join(f"{c}×{n}" for c, n in top))
    _examples(emoji, lambda h: f"{h[0]}:{h[1]}:{h[2]}")

    # 2) hex
    print(f"\n[2] 오프팔레트 raw hex (var(--token) 로):  {len(hexes)} 건")
    _examples(hexes, lambda h: f"{h[0]}:{h[1]}:{h[2]}")

    # 3) ghost
    print(f"\n[3] ghost 버튼 (투명+보더 → 2차 tonal):  {len(ghosts)} 건")
    _examples(ghosts, lambda h: f"{h[0]}:{h[1]}")

    # 4) radius (warning)
    print(f"\n[4] 비표준 라운딩 (warning, --r-sm/md/lg):  {len(radii)} 건")
    rad_by_val = {}
    for _, _, v in radii:
        rad_by_val[v] = rad_by_val.get(v, 0) + 1
    if rad_by_val:
        print("    값 분포:  " + "  ".join(f"{v}px×{n}" for v, n in sorted(rad_by_val.items())))
    _examples(radii, lambda h: f"{h[0]}:{h[1]}:{h[2]}")

    blocking = len(emoji) + len(hexes) + len(ghosts)
    print("\n" + "-" * 60)
    print(f"위반(exit 영향): emoji {len(emoji)} + hex {len(hexes)} + ghost {len(ghosts)} = {blocking}")
    print(f"warning(미반영): radius {len(radii)}")
    print("-" * 60)
    if blocking:
        print("FAIL — DESIGN.md UI 규칙 위반. 위 항목을 RG_ICONS·토큰·tonal 로 교체.", file=sys.stderr)
        return 1
    print("OK — DESIGN.md UI 규칙 위반 없음.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
