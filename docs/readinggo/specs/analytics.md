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
rgTrack('ocr_extracted',       { source, chars, book_id | page_idx }) // 홈 사진 글귀 추출 성공 (OCR)
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
| `checkin_save_failed` | 체크인 시도 1건이 최종 실패로 확정된 뒤 1회 | `source`, `stage`, `code`, `correlation_id`, `retry_count`, `item_count`; 선택 `endpoint_or_rpc`, `status`, `app_version` | 저장 장애 운영 진단 |

`checkin_save_failed`의 `source`는 최소 `home | ocr_review`, `stage`는 `preflight | session | sentence | readback` allowlist를 쓴다. `code`는 자유형 예외 메시지가 아니라 `ugc_terms_required | invalid_sentence | missing_user_book | auth_expired | network | session_write_failed | sentence_write_failed | batch_partial_failure | readback_failed | unknown` 중 하나로 정규화한다. 한 저장 시도의 실패 이벤트는 가장 구체적인 최종 stage에서 1회만 발화하며, `correlation_id`는 클라이언트가 시도 시작 시 생성한 비식별 UUID다. 공통 `environment`·`release_sha`·`schema_version`·`platform`은 중앙 `rgTrack`이 붙인다.

- 재시도는 실제 저장 성공 건만 기록한다. 저장 실패·rollback은 성공 이벤트를 남기지 않는다.
- 이벤트 속성명은 `snake_case`로 통일한다. `bookId`, `from`, `to`, 의미 불명 `id`는 신규 발화에서 금지한다.
- `barcode_detected`는 한 번의 완결 이벤트 `{ matched }`만 사용하고 ISBN 원문은 보내지 않는다.

#### 개인정보 최소화

분석 이벤트·person property에 다음을 넣지 않는다.

- 이메일·이름·닉네임·OAuth 식별자
- 한 문장·감상·질문·답변 원문
- ISBN·초대 토큰·URL query/hash
- 자유형 예외 메시지와 provider 응답 본문

오류는 공통 allowlist `source`, `stage`, `code`, `endpoint_or_rpc`, `status`, `app_version`, `correlation_id`, `retry_count`, `item_count`만 전송한다. OCR 홈 앨범 실패에 한해 `page_idx`를 추가로 허용한다. 로그인 사용자의 PostHog distinct ID는 Supabase UUID만 쓰되 선택 동의자에 한하고, email person property는 전송하지 않는다.

### 3.1.1.1 OCR 이벤트 계약 (#1498)

OCR 분석은 원문을 수집하지 않고 성공·실패와 surface 수준의 비민감 메타데이터만 기록한다. `chars`는 Unicode 문자 수이며 `page_idx`는 사용자가 선택한 홈 앨범 안의 0-based 위치일 뿐 책의 실제 페이지 번호가 아니다.

| 상태 | 이벤트 | 발화 시점 | 필수 속성 | 선택 속성 |
|---|---|---|---|---|
| 활성 목표 계약 | `ocr_extracted` | 홈 단발 OCR이 비어 있지 않은 검토 초안을 연 뒤 | `source=home_single`, `book_id`, `chars` | 없음 |
| 활성 목표 계약 | `ocr_batch_started` | 홈 앨범에서 2장 이상 일반 OCR을 시작할 때 1회 | `source=home_album`, `count` | 없음 |
| 활성 목표 계약 | `ocr_extracted` | 홈 앨범의 한 이미지에서 비어 있지 않은 텍스트를 얻을 때 | `source=home_album`, `page_idx`, `chars` | 없음 |
| 활성 목표 계약 | `ocr_failed` | 홈 단발 또는 홈 앨범의 한 이미지가 최종 실패·빈 결과로 확정될 때 | `source`, `stage`, `code` | 홈 앨범의 `page_idx`, 실제 HTTP 응답이 있는 경우의 `status` |
| 미발화 계약 | `ocr_batch_started` | 책 상세 강조 문장 앨범 추출을 시작할 때 1회 | `source=book_highlights`, `count` | 없음 |
| 미발화 계약 | `highlights_extracted` | 책 상세 이미지 한 장의 강조 문장 추출이 끝날 때 | `source=book_highlights`, `page_idx`, `n` | 없음 |
| 미발화 계약 | `ocr_batch_saved` | 책 상세 강조 문장 검토 큐의 저장이 끝날 때 | `source=book_highlights`, `book_id`, `saved`, `skipped` | 없음 |

- `source` 허용값은 `home_single | home_album | book_highlights`다. 홈 이벤트 이름은 이미 발화 중이나 속성 shape는 본 계약에 맞추는 후속 code PR 전까지 drift 상태다. 현재 코드에서 책 상세 강조 이벤트 세 개는 발화하지 않으므로 실측 카탈로그·대시보드에서 활성 이벤트로 세지 않는다.
- 오류 HTTP 속성의 canonical 이름은 공통 계약과 같은 `status`다. `http_status` 신규 발화는 금지하고, HTTP 응답을 받지 못한 실패에 `0` 같은 가짜 상태를 만들지 않고 속성을 생략한다.
- `ocr_failed.code`는 클라이언트·Worker가 정규화한 안정된 오류 코드만 사용한다. 자유형 예외 메시지·provider 응답 문자열을 넣지 않는다.
- `ocr_failed`에는 `book_id`를 넣지 않는다. 실패 원인 진단에는 `source`·`stage`·`code`와 선택 `page_idx`·`status`면 충분하다.
- OCR 원문·이미지·파일명·MIME 원문·provider 응답·자유형 오류 메시지·실제 책 페이지 번호는 성공·실패 이벤트 모두 금지한다.

### 3.1.2 WAU·리텐션·주간 리포트

- **시간대/주 경계**: KST 월요일 00:00~일요일 23:59:59.
- **WAU**: production에서 `book_opened`, `reading_session_end`, `sentence_added`, `book_completed`, `answer_saved` 중 하나 이상을 수행한 고유 PostHog `distinct_id` 수. 계정과 익명 기기가 섞일 수 있으므로 UI에는 **활성 ID**라고 표시한다.
- **활성 코호트 시작**: 첫 성공 `reading_session_end`가 발생한 주.
- **W1 리텐션**: 시작 다음 주에 성공 `reading_session_end`가 1회 이상 있는 활성 ID / 시작 주 활성 ID.
- 아직 다음 주가 끝나지 않은 미성숙 코호트는 제외한다. 표본 10 미만은 참고치로 표시하고 50% 달성 판정에 사용하지 않는다.
- **런칭 기준**: 가장 최근 성숙 코호트(표본 10 이상)의 W1 리텐션이 50% 이상인지 주간으로 확인한다.
- 주간 자동 리포트는 production만 조회하고 WAU, 핵심 이벤트 사용자·건수, 4단계 퍼널, W1 리텐션, 누락 환경/SHA 데이터 품질 경고를 GitHub Actions summary와 artifact로 남긴다.
- 완료된 조회 구간의 핵심 이벤트가 0건이면 `dataQuality: ok`로 두지 않고 `collection_silence` critical anomaly로 판정한다. 이는 “사용자 행동 0”을 자동 확정하는 값이 아니라 수집 중단 가능성을 운영자가 확인해야 하는 fail-visible 신호다.
- PostHog Personal API key는 읽기 전용 GitHub Secret으로만 보관한다. 미설정이면 workflow는 명시적으로 실패하되 앱 배포를 막지 않는다.

### 3.1.3 서재·개인 활동 측정 계약 (v18, 후보)

책나무·친구 책나무 이벤트는 신규 활성 계약이 아니다. 서재 이벤트명·property·bucket·대시보드명도 구현 이슈에서 개인정보·표본·운영 필요를 다시 승인하기 전에는 **후보**다. 검색어·책 제목·문장 원문·개인 메모·정확한 활동 날짜를 분석에 보내지 않는다.

| 상태 | 이벤트 후보 | 발화 시점 | 허용 속성 | 금지 속성 |
|---|---|---|---|---|
| 후보 | `library_viewed` | 3번째 서재 목적지 데이터 렌더 성공 후 1회 | `book_count_bucket`, `status_coverage`, `entry_point` | 사용자 ID·핸들, 정확한 책 수, 책 ID·제목, 문장 원문 |
| 후보 | `library_carousel_navigated` | 한 번의 확정된 이전/다음 이동 뒤 | `direction`, `input=touch\|pointer\|button\|keyboard`, `cover_cache=hit\|miss\|unknown` | 책 ID·제목, swipe 좌표·속도 원문, 장치 식별자 |
| 후보 | `library_filter_changed` | 포함/제외·정렬 결과가 적용될 때 | `included_statuses`, `excluded_statuses`, `sort_key`, `sort_direction`, `result_count_bucket` | 검색어 원문, 정확한 결과 수 |
| 후보 | `library_search_completed` | 검색 결과가 렌더될 때 | `source`, `result_count_bucket`, `latency_bucket`, `outcome` | 검색어 원문, 책 제목·저자·ISBN 원문 |
| 후보 | `library_book_action` | 상세 열기 또는 명시적 홈 active book 변경 성공 뒤 | `action=open_detail\|set_home_active`, `book_status`, `entry_point` | 책 제목, 문장·감상 원문 |
| 후보 | `reading_rhythm_viewed` | 승인된 개인 활동 화면이 렌더될 때 | `active_day_count_bucket`, `cumulative_growth_days_bucket` | 정확한 날짜별 기록, 그날 읽은 책 제목 |
| 현행 유지 | `reading_session_end` | 실제 독서 세션 저장 성공 뒤 | 기존 승인 속성 | 문장·감상 원문 |
| 현행 유지 | `sentence_added` | 문장 영속 성공 뒤 | 기존 승인 속성 | 문장 원문·개인 메모 |

- `library_carousel_navigated`는 성능 telemetry가 아니라 사용자 상호작용 후보 이벤트다. frame drop·decode·메모리는 실기기 성능 프로파일과 집계 가능한 기술 지표로 별도 검증하며 원시 pointer/touch 로그를 수집하지 않는다.
- `xp_earned`, `streak_broken`, `streak_repair_shown`, `streak_repaired`, `streak_repair_skipped`, `nest_tab_viewed`, `nest_growth_guide_opened`, `nest_completion_viewed`, `book_tree_*`, `friend_book_tree_*`는 과거 데이터에서만 legacy로 취급한다. 새 번들의 이벤트 상수·호출·속성 정의와 WAU·리텐션·v18 퍼널에서 제외한다.
- 기존 저장 이벤트 이름을 소급 변경하지 않는다. 과거 리포트는 `release_sha`·`schema_version`·컷오버 시각으로 재현한다.
- XP 물리 삭제는 구 APK 버전 분포나 legacy 호출 소멸 telemetry를 기다리지 않는다. Production module graph·운영 쿼리에서 참조 0, DEV 백업·drop migration·schema readback 성공을 증거로 삼는다.
- 성장일은 분석 이벤트 합계가 아니라 권위 DB의 distinct local date에서 계산한다. 4번째 탭 명칭·달력 셀·대표 책·스트릭 규칙이 승인되기 전에는 새 활동 KPI를 확정하지 않는다.
- Production 적용은 검증된 동일 SHA와 migration digest를 제시한 뒤 Hyu 승인을 받는다.

#### v17 친구 책나무 이벤트 — 보류 이력

아래 이름은 이미 구현된 DEV 이벤트와 과거 분석 재현을 위해 문서에 남긴다. v18 신규 KPI·퍼널에는 포함하지 않고, 친구 책나무 UI가 보류된 동안 새 호출을 추가하지 않는다.

- `friend_book_tree_viewed`: 제한 RPC 성공 후 렌더 1회. 과거 허용 속성은 `branch_count_bucket`, `visible_leaf_count_bucket`, `entry_point`였다.
- `friend_book_tree_branch_opened`: 가지 열기. 과거 허용 속성은 `book_status`, `leaf_count_bucket`, `entry_point`였다.
- 두 이벤트 모두 사용자 ID·핸들·정확한 개수·책 제목·문장 원문·비공개 문장 존재·공개범위 판정 이유를 보내지 않는다.

### 3.1.4 과거 둥지 측정 이력 (#1308, superseded)

`nest_tab_viewed`, `nest_growth_guide_opened`, `nest_completion_viewed`와 XP 기반 단계 속성은 v17이 대체한다. 아직 구현되지 않은 과거 제안이므로 신규 구현하지 않는다. 기존 코드나 저장된 분석 데이터가 발견되면 legacy로만 보존한다.

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

## 5. 사용자 동의 설계 — 현행 모델과 v17 보강 게이트

> **상태:** 아래 2단 동의·`RG_consent`·정확한 카피·PostHog 호출은 현행/이전 구현이다. 이를 법적 적정성이나 Production 동작 완료로 간주하지 않는다. v17에서는 동의 버전·시각·효력일·철회·기기 복원과 철회 후 외부 데이터 처리를 검증한 뒤 재승인한다.
> **현행 2단 동의 (#752·#1409)**: 서비스 필수 추론과 비필수 보관·2차 활용을 분리한다.
>
> - **서비스 필수 처리(고지)**: 인증·내 기록 저장·보안·오류, 익명 행동 통계와 사용자가 요청한 재키 질문 생성을 위한 최소 현재 문장·책·해당 대화 history 처리. 질문 입력은 선택 동의와 무관하며 선택적 아카이브·분석·학습에 전용하지 않는다.
> - **선택 (opt-in, `RG_consent='yes'`)**: **세션 리플레이** + 로그인 유저 **식별 분석** + **대화 서버 아카이브·개인화·제품 분석/학습 활용**(`companion_sessions`). 거부해도 10턴 재키 대화를 포함한 핵심 서비스는 동일하다.
>
> 과거 근거는 익명 통계를 필수/고지로 처리할 수 있다고 보았으나, PostHog `distinct_id`·autocapture·보존 설정을 확인하지 않은 채 일률적으로 익명이라고 단정하지 않는다. 필수/선택 구분과 카피는 개인정보 검토 대상이다.

### 5.1 동의 시점

**구현(#331/#1409)**: 진입 시 **비차단 하단 동의 배너** — 필수 처리 고지 + 선택(세션 리플레이·식별·대화 보관/2차 활용) opt-in. "필수만"은 질문 생성에 필요한 최소 추론은 허용하되 리플레이·식별·대화 아카이브·개인화·분석/학습을 제외한다.

### 5.2 레거시 동의 문구 — 재사용 금지

> 아래는 현행/이전 카피이며 새 동의 UI에 복사하지 않는다. 정확한 문구는 실제 수집·보존·삭제 처리와 맞춰 별도 승인한다.
> **ReadingGo가 더 좋아질 수 있도록**
>
> **필수(고지)**: 서비스 운영과 **익명 사용 통계**(어떤 화면을 쓰는지, 식별 정보 없음)를 위해 쿠키를 사용해요.
> **선택**: 동의하면 ① 세션 리플레이, ② 로그인 계정과 연결한 분석, ③ 독서 대화의 서버 보관·개인화·제품 분석/학습 활용을 허용해요. 동의하지 않아도 질문 생성에 필요한 최소 기록만 일시 처리해 같은 재키 대화를 이용할 수 있고, 대화는 선택 아카이브·2차 활용에 쓰지 않아요.
>
> ✅ 전체 동의 (선택까지)  ·  ☐ 필수만 (익명 통계만)

- 목표 계약상 동의는 설정에서 철회 가능해야 한다. 철회 시 향후 리플레이·식별 전송 중단, PostHog identity reset, 기존 데이터 삭제 또는 비식별 여부를 처리·검증한다. 현재 end-to-end 범위는 미검증이다.
- "필수만"의 행동 분석 범위와 식별 가능성은 실제 SDK 구성·법무 검토 전까지 확정하지 않는다. 요청한 AI 추론과 선택 아카이브·개인화·분석/학습을 분리한다.
- 동의 상태는 버전·동의 시각·효력일·철회 시각·기기 간 복원을 판정할 수 있어야 한다. `consented` 같은 정확한 컬럼·키는 후보일 뿐 승인된 저장 스키마가 아니다.

### 5.3 동의 상태 저장

```js
// Phase 0 구현(#294): localStorage 'rg_data_consent' = 'yes' | 'no' | null(미질문)
window.RG_consent.get() / .set('yes'|'no')   // components.js

// 과거 Phase 1 후보 — 실행 계약 아님
// 실제 스키마는 version·accepted_at·effective_at·revoked_at·device restore를 표현해야 하며 별도 승인
```

### 5.4 PostHog 게이팅·리플레이·쿠키 (#752)

- **init(index.html)**: `disable_session_recording: true`(리플레이 **기본 off**) + `session_recording: { maskAllInputs: true }`. 익명 이벤트·퍼널은 상시(고지). `person_profiles: 'identified_only'` 유지(비로그인 익명).
- **선택 동의 'yes'** → `posthog.startSessionRecording()` + (로그인 시) `posthog.identify(...)`.
- **'no'/철회 현행** → `posthog.stopSessionRecording()`, `identify` 생략 또는 `reset`, LLM backfill 스킵. `reset`의 일관 실행, 기존 이벤트 처리, 다른 기기 복원은 미검증이며 v17 출시 게이트다.
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
