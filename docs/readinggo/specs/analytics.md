# ReadingGo Analytics & Data Strategy

## 1. 목표

독서 행동 데이터 + LLM 대화 데이터를 수집해 제품 개선과 장기적 데이터 자산을 확보한다.

---

## 2. 레이어 구조

| 레이어 | 수단 | 수집 데이터 | 시점 |
|---|---|---|---|
| **행동 Analytics** | PostHog JS | 클릭·체류·퍼널·세션 리플레이 | Phase 0 ✅ 완료 |
| **커스텀 이벤트** | PostHog `posthog.capture()` | 앱 고유 행동 | Phase 1 |
| **대화 아카이브** | Supabase `companion_sessions` | LLM 독서 파트너 Q&A | Phase 1 |
| **동의 관리** | 온보딩 동의 플로우 | 수집·활용 동의 여부 | Phase 1 (공개 전 필수) |

---

## 3. PostHog 설정

- **프로젝트**: ReadingGo (ID: 458802, US Cloud)
- **자동 캡처**: 클릭·폼 제출·페이지뷰·heatmap·web vitals ON
- **Session Replay**: ON
- **person_profiles**: `identified_only` — 로그인 유저만 프로필 생성

### 3.1 커스텀 이벤트 목록

`window.rgTrack(event, props)` 헬퍼(components.js)로 호출 — posthog 미로드/차단 시 안전 no-op.

> ⚠️ **드리프트 정리 (#725, 2026-06-17)**: 이전 카탈로그가 `book_opened`·`highlight_selected`·`reading_session_end` 를 "✅ 구현"으로 표기했으나 **실제 미발화**였다. `highlight_selected` → `sentence_added` 로 대체됨. 아래는 코드 grep 실측 기준.

**✅ 발화 중 (실측):**

```js
rgTrack('sentence_added',      { book_id, kind })                // 한 문장 저장 (library.js)
rgTrack('sentence_deleted',    { book_id })                      // 한 문장 삭제 (nest.js)
rgTrack('sentence_shared',     { id, kind })                     // 외부 공유 카드 (share-card.js, #650)
rgTrack('answer_saved',        { book_id, lens, answer_length }) // 독서모임 답변 (nest.js)
rgTrack('companion_recap',     { bookId, n })                    // 완독 회고 받기 (library.js, #259)
rgTrack('companion_q_rated',   { book_id, value })               // 참새 질문 평가 (nest.js, #371)
rgTrack('companion_q_regen',   { book_id })                      // 참새 질문 재생성 (nest.js, #372)
rgTrack('resurface_shown',     { sentence_id, days })            // 되감기 카드 노출 (nest.js, #346)
rgTrack('resurface_answered',  { sentence_id, days })            // 다시 대화하기 탭 (nest.js, #346)
rgTrack('resurface_skipped',   { sentence_id })                  // 나중에 탭 (nest.js, #346)
rgTrack('ocr_extracted',       { ... })                          // 사진 글귀 추출 (OCR)
rgTrack('related_book_wished', { from, to })                     // 추천책 찜 (library.js)
rgTrack('data_consent',        { value, source })                // 데이터 활용 동의 (app.js, #294)
rgTrack('app_error',           { message, tab })                 // 컴포넌트 크래시 (app.js, #310)
```

**⬜ 미구현 — 퍼널 완성 위해 추가 (후속 코드 PR ①):**

```js
rgTrack('book_opened',         { book_id, entry_point })  // 책 읽기 시작 = 활성 책 설정·등록(RG_registerBook/activeBook.set). 퍼널 시작점
rgTrack('reading_session_end', { book_id, pages_logged })  // 체크인(쪽수 기록, handleCheckin) = 인게이지먼트/리텐션
```

> ⚠️ **읽기모드(타이머) 폐기(#505) 반영**: 과거 카탈로그의 `book_opened`='읽기 모드 진입'은 더 이상 유효하지 않다(몰입 읽기모드·타이머 없음). 현재 핵심 루프는 **활성 책 설정 → 홈 체크인**이므로 `book_opened`=읽기 시작, `reading_session_end`=체크인으로 재정의. `duration_sec`는 타이머 폐기로 보류(체크인엔 신뢰 가능한 체류시간 없음).

이 둘이 없으면 **"책 시작 → 체크인 → 한 문장 → 완독" 퍼널을 끝까지 못 그린다**(시작·세션 누락).

**⏳ 후속 (해당 기능 도입 시):**

```js
rgTrack('lens_switched',       { book_id, from_lens, to_lens })   // 렌즈 도입 후 (companion.md §6)
rgTrack('import_completed',    { source, count })                 // 외부 임포트 (#288)
```

### 3.2 유저 식별 (✅ 구현 #293 — app.js 로그인 effect)

Supabase 로그인 후:

```js
posthog.identify(supabase_user_id, {
  email,          // 선택적
  joined_at,
  books_count,
})
```

### 3.3 Admin 대시보드 — 데이터 소스 (하이브리드, #725)

인앱 `AdminDashboardModal` 은 현재 **Supabase 집계만**(`DS.admin.stats/inquiries/popularBooks/activeUsers`) 표시하고, 행동 퍼널·세션 리플레이는 PostHog 콘솔(외부)에만 있다. 고도화는 **(C) 하이브리드**로 간다.

| 용도 | 소스 | 비고 |
|---|---|---|
| 운영 카운트 (유저·세션·완독·인기책·활성유저·문의) | **Supabase** (`DS.admin.*`) | 통제·프라이버시 우위. 현행 유지·확장 |
| 행동 퍼널·리텐션·세션 리플레이 | **PostHog** | 외부 콘솔 강점. 대시보드에서 **링크아웃**(딥링크) |

- 고도화 1차 범위(후속 코드 PR ③): ① Supabase 카운트 지표 보강(예: 일자별 활성·완독 추세), ② 대시보드에 **PostHog 퍼널/리플레이 바로가기 링크** 추가.
- A(PostHog Insight 임베드)·B(Supabase 자체 퍼널 집계)는 후속 검토 — 외부 의존·구현량 트레이드오프.
- 전제: 퍼널을 그리려면 `book_opened`·`reading_session_end`(§3.1 미구현) 먼저 채워야 한다(코드 PR ①).

---

## 4. 대화 아카이브 스키마 (Supabase Phase 1)

```sql
CREATE TABLE companion_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id),
  book_id       text NOT NULL,
  sentence      text NOT NULL,
  comment       text,
  lens          text,              -- 감정 | 연결 | 반론 | 투사
  question      text,
  answer        text,
  is_resurface  boolean DEFAULT false,
  consented     boolean NOT NULL,  -- 동의 여부 스냅샷
  created_at    timestamptz DEFAULT now()
);

-- 익명 집계용 뷰 (user_id 제외)
CREATE VIEW companion_sessions_agg AS
SELECT book_id, sentence, lens, question, answer, created_at
FROM companion_sessions
WHERE consented = true;
```

---

## 5. 사용자 동의 설계 (✅ 구현 #294)

> 단일 동의(데모): companion **첫 사용 시 1회** 묻고 설정에서 토글. 거부 시 companion은 **로컬 목 질문만**(외부 전송·수집 없음) — 기능은 유지(이탈 방지·리텐션). 거부권 필수(PIPA). AI 처리/익명 수집 분리는 후속.

### 5.1 동의 시점

**구현(#331)**: 진입 시 **비차단 하단 동의 배너** — 필수(서비스 운영) + 선택(AI·분석), 버튼 [전체 동의] [필수만] [상세 설정]. opt-in 허들↓. 설정 토글로 변경. (companion 첫 사용 prompt는 폴백)

### 5.2 동의 문구

> **ReadingGo가 더 좋아질 수 있도록**
>
> 계휴 님의 독서 대화(한 문장·코멘트·질문·답변)를 익명으로 수집해,
> 어떤 책의 어떤 문장이 사람들에게 공명하는지 분석합니다.
> 개인 식별 정보는 포함되지 않으며, 외부에 판매하지 않습니다.
>
> ✅ 동의합니다 (더 나은 ReadingGo를 함께 만들게요)
> ☐ 이번엔 괜찮아요

- 동의는 언제든 설정에서 변경 가능
- 미동의 유저는 로컬 기능은 그대로 사용, 서버 아카이브만 제외
- `consented` 플래그를 `companion_sessions`에 함께 저장

### 5.3 동의 상태 저장

```js
// Phase 0 구현(#294): localStorage 'rg_data_consent' = 'yes' | 'no' | null(미질문)
window.RG_consent.get() / .set('yes'|'no')   // components.js

// Phase 1: Supabase users 테이블
ALTER TABLE profiles ADD COLUMN data_consent boolean;
ALTER TABLE profiles ADD COLUMN data_consent_at timestamptz;
```

---

## 6. 데이터 활용 로드맵

| 단계 | 활용 |
|---|---|
| Phase 1 | PostHog 퍼널 — 온보딩 이탈 지점 파악 |
| Phase 1 | 어떤 렌즈를 가장 많이 쓰는가 |
| Phase 2 | 어떤 책·문장이 대화를 가장 많이 유발하는가 |
| Phase 2 | 공명 패턴 기반 추천 (동일 문장에 반응한 유저 매칭) |
| Phase 3 | 출판사 B2B — "이 챕터가 독자 반응을 가장 많이 끌어냄" |

---

## 7. 제약

- 클라이언트에 raw 대화 데이터 노출 금지 (집계만 공개)
- 동의 없는 유저 데이터는 `companion_sessions_agg` 뷰에 포함 안 됨
- PostHog 키는 공개 write-only 키 — 읽기 권한 없음, 코드에 노출 허용
