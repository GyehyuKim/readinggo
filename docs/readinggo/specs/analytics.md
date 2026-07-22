# ReadingGo Analytics & Data Strategy

## 1. 목표

독서 행동 데이터 + LLM 대화 데이터를 수집해 제품 개선과 장기적 데이터 자산을 확보한다.

---

## 2. 레이어 구조

| 레이어 | 수단 | 수집 데이터 | 시점 |
|---|---|---|---|
| **행동 Analytics** | PostHog JS | 클릭·체류·퍼널·세션 리플레이 | Phase 0 ✅ 완료 |
| **커스텀 이벤트** | PostHog `posthog.capture()` | 앱 고유 행동 | Phase 1 ✅ 운영 중 |
| **대화 아카이브** | Supabase `companion_sessions` | LLM 독서 파트너 Q&A | Phase 1 |
| **동의 관리** | 온보딩 동의 플로우 | 수집·활용 동의 여부 | Phase 1 (공개 전 필수) |

---

## 3. PostHog 설정

- **프로젝트**: ReadingGo (ID: 458802, US Cloud)
- **자동 캡처**: 클릭·폼 제출·페이지뷰·heatmap·web vitals ON
- **Session Replay**: 기본 OFF, 선택 동의(`RG_consent=yes`) 후에만 ON
- **person_profiles**: `identified_only` — 로그인 유저만 프로필 생성

### 3.1 커스텀 이벤트 목록

`window.rgTrack(event, props)` 헬퍼(components.js)로 호출 — posthog 미로드/차단 시 안전 no-op.

> 아래 카탈로그는 구현 기준이다. 다만 #1306부터 런칭 지표에 쓰는 핵심 이벤트는 §3.4의 버전·속성·영속 성공 계약을 우선하며, 단순 클릭이나 요청 시작을 성공 전환으로 세지 않는다.

**✅ 발화 중 (실측):**

```js
rgTrack('sentence_added',      { book_id, kind })                // 한 문장 저장 (book-detail-modal.js · 드리프트 정정 2026-07-09)
rgTrack('sentence_deleted',    { book_id })                      // 한 문장 삭제 (companion.js · 드리프트 정정 2026-07-09)
rgTrack('sentence_shared',     { id, kind })                     // 외부 공유 카드 (share-card.js, #650)
rgTrack('answer_saved',        { book_id, lens, answer_length }) // 독서모임 답변 (companion.js · 드리프트 정정 2026-07-09)
rgTrack('companion_recap',     { bookId, n })                    // 완독 회고 받기 (book-detail-modal.js, #259 · 드리프트 정정 2026-07-09)
rgTrack('companion_q_rated',   { book_id, value })               // 참새 질문 평가 (nest.js, #371)
rgTrack('companion_q_regen',   { book_id })                      // 참새 질문 재생성 (nest.js, #372)
rgTrack('resurface_shown',     { sentence_id, days })            // 되감기 카드 노출 (nest.js, #346)
rgTrack('resurface_answered',  { sentence_id, days })            // 다시 대화하기 탭 (nest.js, #346)
rgTrack('resurface_skipped',   { sentence_id })                  // 나중에 탭 (nest.js, #346)
rgTrack('ocr_extracted',       { ... })                          // 사진 글귀 추출 (OCR)
rgTrack('related_book_wished', { from, to })                     // 추천책 찜 (book-detail-modal.js · 드리프트 정정 2026-07-09)
rgTrack('data_consent',        { value, source })                // 데이터 활용 동의 (app.js, #294)
rgTrack('app_error',           { message, tab })                 // 컴포넌트 크래시 (app.js, #310)
rgTrack('book_opened',         { book_id, entry_point })         // 책 읽기 시작 = 활성책 등록·전환 (app.js, #736)
rgTrack('reading_session_end', { book_id, pages_logged, is_complete }) // 체크인 = 인게이지먼트/리텐션 (nest.js handleCheckin, #736)
rgTrack('service_share_open',  { source })                       // 서비스 공유 진입 (share-card.js, #650 B/#729)
rgTrack('service_share_sent',  { source, method })               // 서비스 공유 완료 (share-card.js, #729)
```

**➕ 추가 발화 이벤트 (실측 · 카탈로그 보강 · 드리프트 정정 2026-07-09):** 위 목록이 누락하고 있었으나 코드가 실제 발화 중인 이벤트들. props 상세는 코드 grep 참조.

```js
rgTrack('text_import_saved',      { book_id, saved })            // 붙여넣기 텍스트 임포트 저장 (book-detail-modal.js)
rgTrack('wiki_ask',               { n, q_len })                  // 문장 모음 위키 질문 (sentence-collection-modal.js)
rgTrack('companion_preset_set',   { preset, where })             // 재키 프리셋 선택 (companion.js)
rgTrack('reflection_note_saved',  { book_id, chars })            // 자유 감상 메모 저장 (companion.js)
rgTrack('shelf_import_started',   {})                            // 서재 스캔 임포트 시작 (shelf-import.js)
rgTrack('shelf_import_extracted', { count })                     // 서재 스캔 추출 (shelf-import.js)
rgTrack('shelf_import_staged',    { count, status })             // 서재 스캔 스테이징 (shelf-import.js)
rgTrack('flexible_import_started',{})                            // 유연 임포트 시작 (shelf-import.js)
rgTrack('flexible_import_parsed', { count })                     // 유연 임포트 파싱 (shelf-import.js)
rgTrack('flexible_import_staged', { count, status })             // 유연 임포트 스테이징 (shelf-import.js)
rgTrack('streak_repair_shown',    { lost, broken_days })         // 스트릭 복구 카드 노출 (nest.js)
rgTrack('streak_repaired',        { restored })                  // 스트릭 복구 실행 (nest.js)
rgTrack('streak_repair_skipped',  { lost })                      // 스트릭 복구 건너뜀 (nest.js)
rgTrack('milestone_recap_shown',  { type, value })              // 마일스톤 회고 노출 (nest.js)
rgTrack('barcode_scan_opened',    {})                            // 바코드 스캔 진입 (barcode-scan.js)
rgTrack('barcode_detected',       { isbn | matched })            // 바코드 인식 (barcode-scan.js)
```

_참고(드리프트 정정 2026-07-09): `companion_q_rated`·`companion_q_regen`도 현재 **companion.js**에서 발화(위 ✅ 목록은 nest.js로 표기 — 추가 드리프트, 코드 정합 확인 필요)._

> 📌 **퍼널 계약 (#1306)**: `book_opened → reading_session_end → sentence_added → book_completed`. 체크인·문장·완독은 각각 DB/local adapter 영속 성공 뒤에만 발화한다. 홈 단일/배치 문장도 `sentence_added`에 포함하며, 부팅 복원은 사용자 행동이 아니므로 제외한다.

### 3.1.1 런칭 측정 계약 (#1306)

#### 공통 속성

중앙 `rgTrack` 계층은 모든 커스텀 이벤트에 아래 값을 강제로 붙인다. 호출자가 같은 이름을 보내도 빌드 메타데이터가 우선한다.

| 속성 | 타입·허용값 | 목적 |
|---|---|---|
| `environment` | `development` \| `production` | dev/preview와 운영 데이터 분리 |
| `release_sha` | 배포 commit SHA, 로컬은 `local` | 어떤 배포에서 발생했는지 추적 |
| `schema_version` | 정수, 초기값 `1` | 이벤트 계약 변경 구분 |
| `platform` | `web` \| `ios` \| `android` | Capacitor/웹 비교 |

- `VITE_READINGGO_ENV`가 명시되지 않은 로컬·테스트 빌드는 **수집하지 않는다**. 조용히 production으로 귀속시키지 않는다.
- dev·PR preview는 `development`, 운영 Worker·승격된 OTA·스토어 앱은 `production`으로 빌드한다.
- 자동 `$pageview`·autocapture에도 PostHog super properties로 같은 환경·SHA를 등록한다.

#### 핵심 이벤트 스키마

| 이벤트 | 발화 시점 | 필수 속성 | 목적 |
|---|---|---|---|
| `book_opened` | 사용자가 책을 `reading`으로 등록하거나 활성책으로 전환한 뒤 | `book_id`, `entry_point` | 핵심 루프 시작 |
| `reading_session_end` | 체크인 세션과 진도 저장 성공 뒤 | `book_id`, `pages_logged`, `is_complete` | 활성·리텐션 행동 |
| `sentence_added` | 한 문장 1건 저장 성공 뒤. 배치는 성공 건마다 1회 | `book_id`, `kind`, `source` | 핵심 자산 생성 |
| `book_completed` | `books.complete()` 성공 뒤 | `book_id`, `rating_present`, `review_present` | 완독 전환 |
| `answer_saved` | 독서 대화 답변 저장 성공 뒤 | `book_id`, `lens`, `answer_length` | AI 대화 가치 |

- 재시도는 실제 저장 성공 건만 기록한다. 저장 실패·rollback은 성공 이벤트를 남기지 않는다.
- 이벤트 속성명은 `snake_case`로 통일한다. `bookId`, `from`, `to`, 의미 불명 `id`는 신규 발화에서 금지한다.
- `barcode_detected`는 한 번의 완결 이벤트 `{ matched }`만 사용하고 ISBN 원문은 보내지 않는다.

#### 개인정보 최소화

분석 이벤트·person property에 다음을 넣지 않는다.

- 이메일·이름·닉네임·OAuth 식별자
- 한 문장·감상·질문·답변 원문
- ISBN·초대 토큰·URL query/hash
- 자유형 예외 메시지와 provider 응답 본문

오류는 allowlist `code`, `stage`, `status`만 전송한다. 로그인 사용자의 PostHog distinct ID는 Supabase UUID만 쓰되 선택 동의자에 한하고, email person property는 전송하지 않는다.

### 3.1.2 WAU·리텐션·주간 리포트

- **시간대/주 경계**: KST 월요일 00:00~일요일 23:59:59.
- **WAU**: production에서 `book_opened`, `reading_session_end`, `sentence_added`, `book_completed`, `answer_saved` 중 하나 이상을 수행한 고유 PostHog `distinct_id` 수. 계정과 익명 기기가 섞일 수 있으므로 UI에는 **활성 ID**라고 표시한다.
- **활성 코호트 시작**: 첫 성공 `reading_session_end`가 발생한 주.
- **W1 리텐션**: 시작 다음 주에 성공 `reading_session_end`가 1회 이상 있는 활성 ID / 시작 주 활성 ID.
- 아직 다음 주가 끝나지 않은 미성숙 코호트는 제외한다. 표본 10 미만은 참고치로 표시하고 50% 달성 판정에 사용하지 않는다.
- **런칭 기준**: 가장 최근 성숙 코호트(표본 10 이상)의 W1 리텐션이 50% 이상인지 주간으로 확인한다.
- 주간 자동 리포트는 production만 조회하고 WAU, 핵심 이벤트 사용자·건수, 4단계 퍼널, W1 리텐션, 누락 환경/SHA 데이터 품질 경고를 GitHub Actions summary와 artifact로 남긴다.
- PostHog Personal API key는 읽기 전용 GitHub Secret으로만 보관한다. 미설정이면 workflow는 명시적으로 실패하되 앱 배포를 막지 않는다.

**⏳ 후속 (해당 기능 도입 시):**

```js
rgTrack('lens_switched',       { book_id, from_lens, to_lens })   // 렌즈 도입 후 (companion.md §6)
rgTrack('import_completed',    { source, count })                 // 외부 임포트 (#288)
```

### 3.2 유저 식별 (✅ 구현 #293 — app.js 로그인 effect)

Supabase 로그인 후:

```js
posthog.identify(supabase_user_id, {
  joined_at,
  books_count,
})
```

### 3.3 Admin 대시보드 — 데이터 소스 (하이브리드, #725)

인앱 `AdminDashboardModal` 은 현재 **Supabase 집계만**(`DS.admin.stats/inquiries/popularBooks/activeUsers`) 표시하고, 행동 퍼널·세션 리플레이는 PostHog 콘솔(외부)에만 있다. 고도화는 **(C) 하이브리드**로 간다.

> 📎 **RPC 소스 파일 (드리프트 정정 2026-07-09)**: `admin.stats` RPC 정의는 **`13_admin_stats.sql`**(`admin_stats()`)에 있다. `12_admin_insights.sql`은 `popularBooks`/`activeUsers`(`admin_popular_books`/`admin_active_users`)만 정의 — admin.stats를 `12_...`로 가리키던 참조(admin-dashboard.md §제목·profile.md 등)는 stale.

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

## 5. 사용자 동의 설계 (2단 모델, #752)

> **2단 동의 (PIPA·오픈베타)**: 비필수(세션 리플레이·식별·LLM)를 필수에 끼우면 위반이라 분리한다.
>
> - **필수 (동의불요·고지)**: 서비스 운영(인증·내 기록 저장·보안·오류) + **익명 행동 분석**(PostHog 이벤트·퍼널·페이지뷰, 식별자 없음 — `person_profiles: identified_only`라 비로그인 익명). first-party 분석 쿠키 고지.
> - **선택 (opt-in, `RG_consent='yes'`)**: **세션 리플레이** + 로그인 유저 **식별 분석**(`posthog.identify`+email) + **LLM 대화 수집**(`companion_sessions`). 거부해도 서비스 동일(익명 분석·로컬 기능 유지).
>
> 근거: 익명 통계는 필수/고지로 방어 가능, 민감한 리플레이·식별은 명시 동의자만 → 수집 최대화 + 법적 안전. 거부권 필수(PIPA).

### 5.1 동의 시점

**구현(#331)**: 진입 시 **비차단 하단 동의 배너** — 필수(서비스 운영·익명 분석 **고지**) + 선택(세션 리플레이·식별·LLM **opt-in**), 버튼 [전체 동의] [필수만] [상세 설정]. "필수만" = 선택 거부(`RG_consent='no'`) → 익명 분석은 유지, 리플레이·식별·LLM만 제외. 설정 토글로 변경.

### 5.2 동의 문구

> **ReadingGo가 더 좋아질 수 있도록**
>
> **필수(고지)**: 서비스 운영과 **익명 사용 통계**(어떤 화면을 쓰는지, 식별 정보 없음)를 위해 쿠키를 사용해요.
> **선택**: 동의하면 ① **세션 리플레이**(화면 사용 녹화 — 마찰 개선용), ② 로그인 계정과 연결한 분석, ③ 독서 대화(한 문장·질문·답변)의 익명 수집으로 더 나은 질문을 만들어요. 개인 식별 정보는 분석에 포함·판매하지 않아요.
>
> ✅ 전체 동의 (선택까지)  ·  ☐ 필수만 (익명 통계만)

- 동의는 언제든 설정에서 변경 가능. 철회 시 리플레이·식별 즉시 중단.
- "필수만"이어도 익명 행동 분석은 유지(서비스 통계), 리플레이·식별·LLM 수집만 제외.
- `consented` 플래그를 `companion_sessions`에 함께 저장. 쿠키는 first-party 분석용(PostHog).

### 5.3 동의 상태 저장

```js
// Phase 0 구현(#294): localStorage 'rg_data_consent' = 'yes' | 'no' | null(미질문)
window.RG_consent.get() / .set('yes'|'no')   // components.js

// Phase 1: Supabase users 테이블
ALTER TABLE profiles ADD COLUMN data_consent boolean;
ALTER TABLE profiles ADD COLUMN data_consent_at timestamptz;
```

### 5.4 PostHog 게이팅·리플레이·쿠키 (#752)

- **init(index.html)**: `disable_session_recording: true`(리플레이 **기본 off**) + `session_recording: { maskAllInputs: true }`. 익명 이벤트·퍼널은 상시(고지). `person_profiles: 'identified_only'` 유지(비로그인 익명).
- **선택 동의 'yes'** → `posthog.startSessionRecording()` + (로그인 시) `posthog.identify(...)`.
- **'no'/철회** → `posthog.stopSessionRecording()`, `identify` 안 함(또는 `reset`), LLM backfill 스킵(현행 `app.js`).
- **리플레이 PII 마스킹**: 입력값 `maskAllInputs`, 민감 표시 요소(이메일 등)에 `.ph-no-capture` 클래스. admin 대시보드(타 유저 이메일·문장 노출)는 운영자 리플레이에서도 마스킹 권장.
- **쿠키**: first-party 분석 쿠키(distinct_id). 배너 고지로 충족(별도 동의 차단 쿠키 없음).

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
