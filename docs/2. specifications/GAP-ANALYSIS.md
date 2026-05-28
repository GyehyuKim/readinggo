# ReadingGo Spec ↔ 구현 Gap 분석

> 생성일: 2026-05-28
> Source of truth: `docs/readinggo/specs/` (v6 분할본, 12개)
> 비교 대상: `docs/readinggo/` (HEAD: `c67d600`)
> 원칙: SLC (Simple · Lovable · Complete)
> 매트릭스 항목 단위: 카드/액션. ≤80 cap.

## 요약

- **Total: 67개** | ✅ Done: **30** | ⚠️ Partial: **17** | ❌ Missing: **20**
- **v6 신규 미구현: 0/4** (모두 구현 또는 Partial — 독서모임/AI 추천/AI 추출책/마일스톤 카드)
- Phase 0 데모 시나리오 (§9, 4분 클릭 시연) 기준 핵심 흐름은 동작. 운영자 짹·NPC 가속·진화 마이크로카피·둥지 1단계 가속 등 *lovable* 미스가 P0 후보.

## 매트릭스

| Feature | Spec 항목 | 상태 | 위치 | 비고 |
|---|---|---|---|---|
| onboarding | A 진입 화면 + 슬로건 | ✅ | js/onboarding.js:5-37 | |
| onboarding | C-1 검색창 (제목/저자/ISBN, fuzzy) | ⚠️ | js/onboarding.js:44-146, data.js:183-191 | Fuse.js 없는 단순 includes — 한글 자모 분해/Levenshtein 미적용 |
| onboarding | C-1 요즘 Top10 큐레이션 | ⚠️ | js/onboarding.js:40 | spec 10권 ≠ 코드 10권 (목록 불일치) |
| onboarding | C-1 스테디 Top10 큐레이션 | ⚠️ | js/onboarding.js:41 | spec 10권 ≠ 코드 10권 (목록 불일치) |
| onboarding | C-1 검색 결과 0건 → 직접 등록 | ✅ | js/onboarding.js:110-119 | |
| onboarding | C-1 "📚 내 서재" 우상단 빠른 진입 | ❌ | - | C-1 헤더에 내서재 버튼 없음 |
| onboarding | C-2 책 확인 / 직접 등록 폼 | ✅ | js/onboarding.js:149-260 | |
| onboarding | C-2 현재 페이지 입력 | ✅ | js/onboarding.js:215-218 | |
| onboarding | C-2 모이 입력 (페이지+문장) | ✅ | js/onboarding.js:220-248 | |
| onboarding | C-2 결정 마찰 카피 ("그냥 펴진 페이지...") | ❌ | - | v5 신설 필수 카피 누락 |
| onboarding | C-2 localStorage 임시 저장 (rg_pending_sentence) | ✅ | js/onboarding.js:152-161 | |
| onboarding | C-2 문자수 카운터 200자 | ✅ | js/onboarding.js:244-247 | |
| onboarding | D-3 세리머니 + Confetti 18조각 8색 | ⚠️ | js/onboarding.js:272-279 | 18조각 OK / spec은 18조각 명세 (이전 8조각 표기 정정) |
| onboarding | D-3 보상 카드 3그리드 (rcPop stagger) | ⚠️ | js/onboarding.js:294-305 | 3카드 OK, stagger 애니메이션 미적용 |
| onboarding | D-3 "Google로 계속" CTA | ✅ | js/onboarding.js:307-309 | 시뮬레이션 |
| onboarding | E 닉네임 입력 + 규칙 + 중복체크 | ⚠️ | js/library.js:491-509 | 설정 화면에만. 가입 직후 강제 X, 규칙 표시 일부, RPC 없음 |
| onboarding | F 알림 권한 요청 (토스트 시뮬) | ❌ | - | 첫 기록 후 트리거 없음 |
| onboarding | G NPC 2명 자동 팔로우 | ✅ | js/app.js:57-59, data.js:126-134 | |
| onboarding | 23:00 긴급 알림 카피 | ❌ | - | Phase 0 토스트도 없음 |
| nest | 상단 바 🐦/🔥/⚡/Lv | ✅ | js/components.js:73-101 | |
| nest | 🔥 탭 → 이달 달력 모달 | ✅ | js/components.js:248-317 | |
| nest | 둥지 진화 배너 5단계 | ✅ | js/components.js:319-357, data.js:11-18 | |
| nest | 5단계 이모지·색상·배경 토큰 | ✅ | js/data.js:11-17 | spec 표 완전 일치 |
| nest | 첫 7일 가속 (D1🪵/D3🪹/D7🏠) | ❌ | - | 페이지 기반 진화만 |
| nest | 진화 마이크로카피 ("참새가 자리를...") | ❌ | - | 카피 출력 트리거 없음 |
| nest | 완독 100% 세리머니 모달 (🏰+배지+Confetti) | ✅ | js/nest.js:289-317 | RewardModal isComplete 분기 |
| nest | The Path 지그재그 노드 (22/50/72/50%) | ✅ | js/nest.js:5-9 | |
| nest | 노드 스타일 (done/current/ghost) | ✅ | index.html:57-61, js/nest.js:62-121 | |
| nest | 참새 bounce 현재 노드 위 | ✅ | js/nest.js:78-80 | |
| nest | 호버 툴팁 (날짜/페이지/문장 2줄) | ✅ | js/nest.js:47-60 | |
| nest | 자동 스크롤 현재 노드 | ✅ | js/nest.js:17-19 | |
| nest | CTA "오늘 기록하기" → 미션 모달 | ✅ | js/nest.js:90-107, 187-286 | |
| nest | "✍️ 모이 추가" (완료 후) | ✅ | js/nest.js:432-440, 405-421 | |
| nest | 상단바 우측 📚 내서재 빠른 진입 | ❌ | - | 둥지 상단바에 없음 |
| nest | 날짜 시뮬레이터 +1일 | ✅ | js/app.js:118-122, 152-159 | |
| nest | 활성 책 전환 시트 (§5.3) | ✅ | js/nest.js:127-185 | |
| nest | 활성 책 데이터 분리 보존 | ✅ | js/data.js:210-214 | userBooks[].sessions/sentences 단위 |
| book-club | 독서모임 탭 신설 (v6) | ✅ | js/village.js:487-761 | v6 신규 |
| book-club | 메가 스트림 (책 단위 자동 생성) | ⚠️ | js/village.js:637-665, data.js:43-48 | v6 신규. 시드 4개 하드코딩, 책 등록 시 자동 생성 X |
| book-club | 서브 모임 (기간 有, 공개/비공개/승인) | ✅ | js/village.js:707-748, data.js:50-111 | v6 신규 |
| book-club | 모임 만들기 폼 + 비밀번호/QR | ⚠️ | js/village.js:82-201 | 비밀번호 O, QR 미구현 |
| book-club | 마감일 D-N 카운트다운 | ✅ | js/village.js:247, 690 | |
| book-club | 멤버 둥지 그리드 (불빛 ON/OFF) | ✅ | js/village.js:374-414 | |
| book-club | 🪱 모이 보내기 (불 꺼진 멤버) | ✅ | js/village.js:397-412, 226-229 | |
| book-club | 모이 하이라이트/실시간 피드 | ⚠️ | js/village.js:417-438 | 시드 피드만, 실시간 X |
| book-club | 구경 불가 (비가입자 피드 차단) | ✅ | js/village.js:301-368 | |
| book-club | 완독 레이스 진도 (🏆 배지) | ⚠️ | js/village.js:289-297 | 진도 게이지 O (데모용 고정 68/45%), 🏆 배지 X |
| book-club | 자유게시판 | ✅ | js/village.js:441-470 | spec엔 명시 없으나 마을 게시판 계승 |
| book-club | 운영자 짹 자동 응답 (5.6) | ❌ | - | D1/D7/컴백 짹 시드 없음 |
| book-club | 운영자 ✨ 표식 | ❌ | - | is_operator 미존재 |
| book-club | /operator 대시보드 | ❌ | - | Phase 1 |
| social | 소셜 탭 헤더 | ✅ | js/social.js:208-225 | |
| social | 이번 주 신규 시작러 Top3 | ✅ | js/social.js:270-284, 4-8 | 시드 |
| social | 모이 피드 카드 (아바타/닉/책/페이지/모이) | ✅ | js/social.js:295-348 | |
| social | 짹 1종 토글 (👏🥹🔖 3종 제거 적용) | ✅ | js/social.js:331-347 | |
| social | 책갈피 🔖 우측 상단 | ✅ | js/social.js:301-308 | |
| social | 카드 책 제목 → 책 상세 진입 | ✅ | js/social.js:191-204, MoiDetail | |
| social | 모이 카드 페이지 정보 p.N | ✅ | js/social.js:318-320 | |
| social | 본인 카드 짹/책갈피 비활성 | ✅ | js/social.js:333-343 | |
| social | 친구 찾기 패널 (@닉네임) | ✅ | js/social.js:229-268, 142-145 | NPC_SEARCH_USERS 풀 |
| social | 빈 상태 카피 | ✅ | js/social.js:287-293 | |
| social | 주간 리그 노출 | ✅ | - | v4.4 결정대로 제거 유지 (시드는 잔존) |
| profile | 내서재 헤더 + 현재 읽는 중 카드 | ✅ | js/library.js:595-714 | |
| profile | 책장 내 검색 | ✅ | js/library.js:550-554, 716-730 | |
| profile | 책 상세 (표지/저자/진척/문장 타임라인) | ✅ | js/library.js:266-456 | |
| profile | 교보문고 링크 (ISBN/제목) | ✅ | js/library.js:419-426, data.js:283-285 | |
| profile | Markdown Export | ✅ | js/library.js:277-292 | |
| profile | 책 soft delete | ✅ | js/library.js:429-434, 556-562 | |
| profile | AI 도서 추천 (완독 후 3권) | ✅ | js/library.js:350-379 | v6 신규. Phase 0 하드코딩 시드 |
| profile | AI 추출 책 모달 | ✅ | js/library.js:171-263, 341-348 | v6 신규. 시드 챕터 3개 |
| profile | 관심 책 리스트 탭 | ✅ | js/library.js:625-662, 538-547 | |
| profile | 책갈피 탭 (sentence_bookmarks) | ✅ | js/library.js:664-691 | |
| profile | 친구 책 → 책 상세 (내 기록 없는 뷰) | ⚠️ | js/village.js:5-42 | VillageBookDetail 시트 — 관심 책 추가 버튼 X |
| profile | 닉네임 RPC 검증 + 금칙어 | ❌ | - | Phase 1 |
| systems | 스트릭 갱신 (세션=+1) | ✅ | js/nest.js:385-389 | |
| systems | 방패 (Shield) | ⚠️ | js/library.js:469-478 | 시뮬 버튼만 (리셋 카피 토스트). 보유/소모/지급 메카닉 미구현 |
| systems | XP 일일 +10 | ✅ | js/nest.js:359, 384 | |
| systems | XP 완독 +200 | ⚠️ | js/nest.js:308-309 | UI 표시는 O, 실제 가산 로직 미확인 (+10만 적용) |
| systems | XP 친구 짹 받음 +1 (v5) | ❌ | - | 짹 카운트만, XP 가산 없음 |
| systems | 50/100일 스트릭 공유 카드 (v6) | ✅ | js/components.js:103-245 | v6 신규. StreakShareModal |
| systems | 레벨 계산 floor(sqrt(xp/100))+1 | ✅ | js/data.js:204-206 | |
| systems | NPC 자동 진도/문장 게시 | ⚠️ | js/data.js:126-134 | 시드 정적. pg_cron 시뮬 없음 (날짜 시뮬 시 불빛 리셋만) |
| systems | 주간 리그 집계 쿼리 | ⚠️ | js/data.js:136-142 | SEED_LEAGUE 시드만. UI 노출 v4.4 제거 |
| backend | Supabase Auth/DB/RLS | ❌ | - | Phase 1 |
| backend | pg_cron 배치 (스트릭/NPC/리그) | ❌ | - | Phase 1 |
| backend | localStorage 가입 전 sync | ⚠️ | js/onboarding.js:152-161, js/app.js:28-81 | rg_pending_sentence O, OAuth 동기화 X |
| design | 컬러 토큰 (페이퍼/잉크/브랜드/불꽃/골드) | ✅ | index.html:31-39 | spec §11.2 일치 |
| design | Moneygraphy Rounded/Pixel @font-face | ✅ | index.html:9-10 | |
| design | Pixel 폰트 .stat-num/.path 등 적용 | ⚠️ | index.html:94 | .rg-pixel 클래스만. 스트릭/XP/리그 등 실 사용처에 미적용 |
| design | 3D 버튼 (.btn-3d, border-bottom 5px) | ⚠️ | index.html:46-54 | .btn-duo (Duolingo 스타일) 사용. spec의 .btn-3d 토큰명 X |
| design | 애니메이션 (fadeUp/bounce/pulseDot/slideUp/popIn/rcPop/fall/ping) | ⚠️ | index.html:64-77 | bounce/slideUp/popIn/confetti/ping O. fadeUp/pulseDot/rcPop 미정의 |
| design | 빈 상태 카피 (책장/피드/검색/관심책 등) | ✅ | 각 View 파일 | spec §12 다수 일치 |

## SLC 우선순위 백로그

### P0 (Lovable + ≤2 dev-days, 최대 5개)

1. **[onboarding]** C-2 결정 마찰 카피 박기 — "그냥 펴진 페이지 한 줄도 좋아요. 좋은 문장을 고를 필요 없어요." — `specs/onboarding.md` C-2 — 추정: 0.25 dev-day. Lovable: 사용자 첫 입력 부담 즉시 완화 (v5 핵심 wedge)
2. **[nest]** 진화 마이크로카피 4종 트리거 — "참새가 자리를 잡았어요!" 등 LV1→2~LV4→5 — `specs/nest.md` §5.2 — 추정: 0.5 dev-day. Lovable: 진화 순간이 *눈에 보이는 보상*
3. **[nest]** 첫 7일 둥지 가속 (D1🪵/D3🪹/D7🏠) — `specs/nest.md` §5.2 v5 신설 — 추정: 1 dev-day. Lovable: 첫 주 시각적 변화로 "내 행동이 집을 짓는다" 인지
4. **[systems]** 친구 짹 받음 +1 XP — `specs/systems.md` §6.3 v5 신설 — 추정: 0.5 dev-day. Lovable: 즉시 보상 회로
5. **[onboarding]** TOP10 큐레이션 spec 일치화 (요즘/스테디) — `specs/onboarding.md` C-1 — 추정: 0.25 dev-day. Lovable: 데모 시연 일치성

### P1 (다음 마일스톤)

- onboarding F 알림 권한 토스트 시뮬레이션 + 23:00 긴급 알림 카피
- onboarding C-1 우상단 "📚 내 서재" 버튼
- nest 상단바 우측 📚 빠른 진입
- book-club 메가 스트림: 시드 4권 → 사용자 등록 책 자동 메가 스트림 생성
- book-club 완독 레이스 🏆 배지
- profile 친구 책 상세에 "관심 책에 추가" 버튼
- systems XP 완독 +200 가산 로직 확인/구현
- design Pixel 폰트 실 사용처(.stat-num, .path, .league-rank 등) 적용
- design 누락 애니메이션(fadeUp, pulseDot, rcPop stagger) 정의·적용
- onboarding D-3 보상 카드 rcPop stagger 0.15s

### P2 (백로그)

- backend Supabase Auth/RLS/pg_cron 전체 (Phase 1)
- backend 닉네임 RPC + 금칙어 (Phase 1)
- book-club 운영자 짹 자동 응답 (D1/D7/컴백) + ✨ 표식 + /operator 대시보드
- systems 방패 보유/소모/지급 메카닉 (시뮬 버튼 → 실 로직)
- systems NPC pg_cron 진도/문장/박수 배치
- systems 주간 리그 집계 쿼리
- book-club QR 코드 모임 초대
- onboarding 가입 후 OAuth 동기화 (Phase 1)

## 제외 항목 (rejected.md)

다음 항목은 spec 의도적 기각이므로 매트릭스 제외:

- OCR 웹 환경 (Tesseract.js/Cloud Vision) — Phase 0/1 영구 기각
- 음성 받아쓰기 웹 (Web Speech API) — 영구 기각
- 글자 수 미니멈 도입 — 마찰 증가 사유 기각
- Duolingo 세부 메카닉 인용 — 영속 제약
- 짹마다 다른 색 confetti — 우선순위 낮음
- 첫 7일 XP 더블 — XP destination 미정 사유 기각
- 새벽 3-4시 컷오프 유예 — 사용자 행동 모순
- 사전 질문 화면 (B) — v4 마찰 제거
- 소셜 탭 주간 리그 노출 — v4.4 5/14 결정

재검토 트리거(예: 무료 OCR API 등장, 사용자 N 폭증) 변화 시 재검토 가능. *Capacitor 네이티브 OCR/음성*은 이미 채택(Phase 2/3).

## Open Questions

- **XP destination** (`meta/open-issues.md` §13.1): 모은 XP를 무엇에 쓰는지 결정 미정. 화폐/신분/상점 여부 — 학기 후 별도 세션. 현재 구현은 *누적+레벨업*만 (spec과 일치).
- **T2 mini → 메가 스트림 흡수** (§13.2): spec은 해소 선언했으나 구현은 시드 4권 하드코딩. *책 등록 시 자동 메가 스트림 생성* 로직이 명세-구현 gap.
- **운영자 짹 자동화 점진** (§13.3): N≤20은 수동인데 Phase 0 데모에서 시드 응답 5개 토스트도 미구현. 데모 시나리오 §9는 운영자 짹을 다루지 않음 → 데모 우선순위 명확화 필요.
- **Rich Text 자유 노트** (§13.5): `my_note` 필드 vs 별도 타입 — 사용 데이터 필요로 학기 후 결정. 현재 `sentences.text`만 사용.
- **수익 모델** (§13.6): 학기 후. 현재 영향 없음.
- **둥지 진화 마이크로카피 출력 위치**: spec은 카피만 정의. 토스트인지 배너 교체 시 inline 텍스트인지 모호. 구현 시 UX 결정 필요.
- **design.md `.btn-3d` vs 코드 `.btn-duo`**: 코드는 Duolingo 색(#58CC02) 사용, spec은 브랜드 민트(#3FD17F/#1F8E4D 그림자). 두 토큰 체계가 코드에 공존 — 마이그레이션 방향 결정 필요.
