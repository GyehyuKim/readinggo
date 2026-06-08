#!/usr/bin/env python3
"""ReadingGo village spec-alignment gate — §5.5 (village.md v7.3).

Checks presence of key features in village.js and town.js.
Exit 0 if all pass, 1 on any failure.
"""

import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
JS_DIR = ROOT / "docs" / "readinggo" / "js"


def read(name: str) -> str:
    return (JS_DIR / name).read_text(encoding="utf-8")


def find(pattern: str, text: str) -> bool:
    return re.search(pattern, text) is not None


VILLAGE = read("village.js")
TOWN = read("town.js")

# (description, file_label, text, pattern)
INVARIANTS = [
    # §5.5.1 마을 목록 화면
    ("마을 목록: 참여 중인 마을 섹션",       "village.js", VILLAGE, r"참여 중인 마을"),
    ("마을 목록: 지난 마을 접기",             "village.js", VILLAGE, r"지난 마을"),
    ("마을 목록: 추천 공개 마을",             "village.js", VILLAGE, r"추천 공개 마을"),
    ("마을 찾기: 코드 입력 탭",               "village.js", VILLAGE, r"코드 입력|코드로 참여"),
    ("마을 찾기: 책으로 검색 탭",             "village.js", VILLAGE, r"책으로 검색"),
    ("마을 미리보기: 취소/참여하기 버튼",      "village.js", VILLAGE, r"참여하기"),
    ("마을 미리보기: 정원 마감 엣지케이스",    "village.js", VILLAGE, r"정원 마감"),
    ("마을 미리보기: 완료된 마을 엣지케이스",  "village.js", VILLAGE, r"완료된 마을"),

    # §5.5.2 마을 개설 플로우
    ("마을 개설: 공개/비공개 설정",           "village.js", VILLAGE, r"createVisibility|공개 설정"),
    ("마을 개설: 정원 설정",                  "village.js", VILLAGE, r"정원"),
    ("마을 개설: 마일스톤 파트 수 입력",       "village.js", VILLAGE, r"파트\s*수|createPartCount"),
    ("마을 개설: 파트별 마감일 날짜 입력",     "village.js", VILLAGE, r"createPartDueDates|type=['\"]date['\"]"),
    ("마을 개설: 균등 자동 분할 버튼",         "village.js", VILLAGE, r"균등 자동 분할"),

    # §5.5.4 마을 내부 화면 — 3탭 구조
    ("마을 내부: 멤버 탭",                    "town.js", TOWN, r"멤버"),
    ("마을 내부: 한 문장 탭",                 "town.js", TOWN, r"한 문장"),
    ("마을 내부: 게시판 탭",                  "town.js", TOWN, r"게시판"),
    ("마을 내부: 헤더 D-day 표시",            "town.js", TOWN, r"ddayLabel|D-\d|D\+"),
    ("마을 내부: 진행 바",                    "town.js", TOWN, r"partProgress|진행.*바|height:8"),
    ("마을 내부: 재치 문구 함수",             "town.js", TOWN, r"_getVillageMottoLine"),

    # §5.5.4 멤버 탭 (랭킹 그리드)
    ("멤버 탭: 진척률 계산",                  "town.js", TOWN, r"getProgress|cumulativePage"),
    ("멤버 탭: 불빛 ●/○",                     "town.js", TOWN, r"todayRecorded"),
    ("멤버 탭: 콕찌르기 버튼",               "town.js", TOWN, r"콕찌르기|handlePoke"),
    ("멤버 탭: 비공개 마을 전용 콕찌르기",    "town.js", TOWN, r"isPrivate.*canPoke|canPoke.*isPrivate|visibility.*private"),
    ("멤버 탭: 15명 이하 그리드",             "town.js", TOWN, r"gridMembers|slice\(0,\s*15\)"),
    ("멤버 탭: 16위+ 한 줄 목록",             "town.js", TOWN, r"listMembers"),

    # §5.5.4 한 문장 탭
    ("한 문장 탭: 오늘 기록 카운터",          "town.js", TOWN, r"오늘.*기록|todayCount"),
    ("한 문장 탭: 짹 좋아요 버튼",           "town.js", TOWN, r"짹.*sentLike|sentLike.*짹|toggleSentLike"),
    ("한 문장 탭: 어제 기록 접힘",           "town.js", TOWN, r"YesterdaySentenceSection|어제 기록"),

    # §5.5.4 게시판 탭
    ("게시판 탭: 관리자만 주제 등록",         "town.js", TOWN, r"isAdmin.*주제 등록|주제 등록.*isAdmin"),
    ("게시판 탭: 의견 쓰기 입력",            "town.js", TOWN, r"의견 쓰기"),
    ("게시판 탭: TopicEditor 시트",          "town.js", TOWN, r"TopicEditor"),

    # §5.5.5 나가기
    ("나가기: leaveVillage 함수",            "town.js", TOWN, r"leaveVillage"),
    ("나가기: 확인 confirm",                 "town.js", TOWN, r"confirm.*나갈까요|leaveVillage[\s\S]*confirm"),

    # §5.5.6 설정 (신규 구현)
    ("설정: 알림 — 파트 마감 D-3·D-1",       "town.js", TOWN, r"파트 마감.*D-3|D-3.*D-1"),
    ("설정: 알림 — 멤버 완독",               "town.js", TOWN, r"멤버 완독"),
    ("설정: 관리자 — 마을 정보 수정",         "town.js", TOWN, r"마을 정보 수정|openEditInfo|saveEditInfo"),
    ("설정: 관리자 — 마을 삭제",             "town.js", TOWN, r"deleteVillage|마을 삭제"),
    ("설정: 관리자 — 삭제 confirm",          "town.js", TOWN, r"deleteVillage[\s\S]{0,200}confirm|confirm[\s\S]{0,200}삭제"),
    ("설정: 관리자 전용 섹션 노출 조건",      "town.js", TOWN, r"myRole.*admin|isAdmin"),

    # claude-20260607 자동구현: 4개 신규 기능 (spec §5.5.4 §5.5.1 §5.5.6)
    ("헤더 2줄: 평균 진척률 표시",            "town.js", TOWN, r"avgProgress|평균.*%|평균\s+\{"),
    ("헤더 2줄: 평균 계산 (cumulativePage)",  "town.js", TOWN, r"avgProgress.*cumulativePage|cumulativePage.*avgProgress|reduce.*cumulativePage"),
    ("미리보기: 관리자 👑 항상 표시",         "village.js", VILLAGE, r"관리자.*👑"),
    ("지난 마을: 완료 날짜 자동 계산",        "village.js", VILLAGE, r"completedLabel|_completedLabel"),
    ("지난 마을: statusLabel 자동 설정",      "village.js", VILLAGE, r"statusLabel.*완료|완료.*statusLabel"),
    ("설정: 초대 코드 복사 버튼",             "town.js", TOWN, r"코드 복사|clipboard.*inviteCode|inviteCode.*clipboard"),
]


def main():
    passed = 0
    failed = []

    for desc, label, text, pattern in INVARIANTS:
        if find(pattern, text):
            passed += 1
        else:
            failed.append((desc, label, pattern))

    total = len(INVARIANTS)
    print(f"{passed}/{total} village invariants passed")
    if failed:
        print()
        for desc, label, pat in failed:
            print(f"  FAIL [{label}] {desc}")
            print(f"       pattern: {pat}")
        sys.exit(1)
    else:
        print("All village spec invariants OK ✓")


if __name__ == "__main__":
    main()
