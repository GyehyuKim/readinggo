# 스펙 ↔ 구현 추적 매트릭스 (line-by-line)

> **목적**: 각 SSOT 스펙 조항이 코드의 어디에 구현됐는지 1:1 매칭. `loop/spec-align-full/PROMPT.md` 산출물.
> **상태 범례**: ✅ 구현됨 · 🔧 이번 루프에서 코드 정합 · ❌ 구현 누락(이슈) · 🚩 스펙 수정 필요([BLOCKED](../../../loop/spec-align-full/BLOCKED.md)) · ⏳ Phase 미도래(의도된 미구현)
> **owner 경계**: nest/systems/design=승원, village=윤지 → 코드 정합이 경계를 넘으면 BLOCKED.md 플래그만(직접 수정 X).
> **진행**: 1/9 (nest.md 완료)

---

## nest.md (둥지 탭) — owner: 승원

| 조항 | 규범 요지 | 구현 위치 | 상태 |
|---|---|---|---|
| §5.1 상단바 | 🐦로고·🔥스트릭·⚡XP·Lv·🏰×N·📚 | `app.js:397-448` topbar(brand-mark·stat fire/gold/lv·🏰×castleCount) | ✅ (📚 대신 하단탭/🏰배지로 내서재 진입; 코드엔 🪶방패·🔍검색 추가) |
| §5.1 🔥 탭→달력 | 스트릭 캘린더 모달 | `components.js:554` StreakCalendarModal · `app.js:563` portal · `sessions.calendar(35)` | ✅ |
| §5.1 🏰 배지 탭→프로필 | 성 컬렉션 이동 | `app.js:418` `switchTab('profile')` | ✅ |
| §5.1 둥지 진화 배너 | 진척%+5단계+미니바+표지 | `nest.js:200-256` NestTheatre | ✅ |
| §5.1 둥지 비주얼(자람) | 🪵→🏰 점진 일러스트 | `nest.js:214` twigsForProgress · `data.js` NEST_STAGES | ✅ |
| §5.1 CTA(미완료) "오늘 기록하기"→미션모달 | CheckinModal 진입 | **진입점 없음** — 짹 CTA 제거(QA6 #217)로 `setModalOpen(true)` 호출 삭제, CheckinModal=dead code. 읽기모드가 체크인 대체 | 🚩 (decisions §8.8) |
| §5.1 CTA(완료후) "✍️ 한 문장 추가" | 추가 한 문장 | 읽기모드 상시 입력으로 대체 | 🚩 (decisions §8.8) |
| §5.1 내 한 문장 목록 | 활성책 한 문장 최신순 | `nest.js:617` myQuotes.slice(0,10) | ✅ |
| §5.1 하루 여러 문장 | 첫 기록=세션+XP+스트릭 / 이후=sentences만 | `datastore-supabase.js` sessions.addToday(idempotent)·sentences.add | ✅ |
| §5.1 날짜 시뮬레이터(Phase0) | 🗓 +1일 플로팅 | `nest.js:364/495` onSimSkip·handleSimSkip 배선됨 (🗓 플로팅 버튼 UI는 확인 필요) | ✅ (refer) |
| §5.2 둥지 5단계 | 진척률 0/20/50/80/100 이모지·색 | `data.js` NEST_STAGES · `nest.js` twigsForProgress | ✅ |
| §5.2 진화 마이크로카피 4종 | LV1→2…4→5 카피 | `data.js:51-54` (정확 일치) | ✅ |
| §5.2.1 성 컬렉션 파생 | 완독=🏰, status='completed' 파생 | `datastore-supabase.js:294` castles.list(status='completed') | ✅ |
| §5.3 활성 책 전환 시트 | 읽는 중 목록 → 전환 | `app.js` activeBook.set · 시트 | ✅ |
| §5.3 좌우 캐러셀(#185) | ‹›화살표·점 인디케이터·즉시전환 | `nest.js:409` switchBook · `:541-547` 화살표/인디케이터 · RG_activateBook | ✅ |
| §5.4 일일 미션 흐름 | 현재페이지+한문장 입력 모달 | CheckinModal 존재하나 진입점 없음(위 §5.1) — 읽기모드로 대체 | 🚩 (decisions §8.8) |
| §5.4 별점 0.5(#153) | 좌반=0.5·우반=정수 | `nest.js:158-168` Ceremony fillPct·n-0.5 | ✅ |
| §5.4 완독 세리머니 | 🏰+Confetti+별점·소감 | `nest.js:154` Ceremony isComplete | ✅ |
| §5.4 미기록=스트릭만 위기 | XP/둥지/성 존속 | `systems.md` SSOT · XP 차감 없음(nest.js:457) | ✅ |
| §5.5 읽기 모드(#184) | 타이머·상시입력·문장별페이지·종료·짹대체 | `nest.js:259-360` ReadingMode(visibilitychange·addToday·onChecked·독서 종료) | ✅ |
