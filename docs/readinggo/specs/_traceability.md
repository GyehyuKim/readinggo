# 스펙 ↔ 구현 추적 매트릭스

> **감사 기준**: `origin/main@d1c20b8` (2026-08-25)
> **목적**: 현재 구현 사실과 스펙의 정합 여부를 파일별로 검토한다. 제품의 미래 목표 계약은 `meta/decisions.md`와 각 기능 스펙에서 관리하며, 아직 구현되지 않은 결정은 구현 완료로 표시하지 않는다.

## 상태

- ✅ **정합**: 현재 구현·검증 증거와 스펙이 일치
- 🔧 **이번 정합**: 구현은 존재하지만 인덱스·추적 문서가 뒤처져 이번 spec PR에서 보정
- 📝 **목표 정합**: 현행 구현과 최신 목표 계약을 분리해 스펙에 반영했으며 구현은 아직 안 됨
- ⚠️ **레거시 현행**: 현재 구현돼 있으나 최신 제품 결정에 따라 후속 교체 예정
- ⏳ **의도된 미구현**: 스펙에 후속 범위로 명시됐고 현재 구현되지 않음
- 🚩 **출시 차단 갭**: 보안·개인정보·영속·검증 문제로 구현 또는 운영 증거 없이는 출시할 수 없음

## 검증 기준선

> 2026-08-25 v18 spec-only branch의 로컬 실행 보고다. Markdown·spec-align·dependency-free Node 테스트는 실행했고, full build·Playwright는 격리 worktree에 `vite`·`playwright`가 설치되지 않아 미실행이다. 영속 receipt는 이 branch의 PR CI run URL로 확정하며, 로컬 PASS를 DEV·Production 적용 증거로 사용하지 않는다.

| 검증 | 결과 | 해석 |
|---|---|---|
| `python3 tests/spec-align/align_v7.py` | `PASS` (99/99) | 과거 v7~v16 기능의 존재·부재 검사. 최신 제품 결정을 검증하지는 않음 |
| `python3 tests/spec-align/nest.py` | `PASS` (6/6) | 현재 `nest-grow` 책나무와 XP 제거 상태를 확인하는 as-built 기준선. v18 서재 구현 완료 증거는 아님 |
| `python3 tests/spec-align/architecture_current.py` | `PASS` (3/3) | Vite·Capacitor·Cloudflare·DataStore 현재 계약 확인 |
| `python3 tests/spec-align/drift.py` | `PASS` | spec-drift workflow 구조 확인 |
| `python3 tests/spec-align/design_lint.py` | `PASS` (0건) | 이모지·raw hex·ghost·radius·font 규칙 위반 없음 |
| `python3 tests/spec-align/migrations_applied.py` | `BLOCKED` | 기본 Python 3.9.6은 `str \| None`에서 실패. `uv` Python 3.11에서는 시작되나 worktree에 `SUPABASE_ACCESS_TOKEN`이 없어 원격 검증 보류 |
| `npm run build` (`docs/readinggo`) | `BLOCKED` | 격리 worktree에 `vite` package가 없어 config load 전 중단. PR CI로 재검증 |
| `node --test js/*.test.js` | `PASS` (4/4) | analytics·library dependency-free 테스트 통과. 현행 코드 계약의 증거일 뿐 v18 UI 구현 완료 증거는 아님 |
| Playwright 회귀 | `BLOCKED` | 격리 worktree에 `playwright` package가 없어 미실행. PR CI로 재검증 |

## 1. 34개 스펙 파일 전수 상태

| 파일 | 현재 구현 증거 | 상태 | 감사 메모 |
|---|---|---|---|
| `README.md` | `architecture_current.py`; 현재 Vite·Capacitor·Cloudflare 설명 | 🔧 | 실제 34개 중 다수 파일이 지도에서 누락됐고 v7을 최상위 기준으로 오해하게 하던 문구를 이번 PR에서 보정 |
| `SYNC-POLICY.md` | `.github/workflows/spec-drift.yml`, `tests/spec-align/drift.py` | ✅ | 정책과 CI 구조가 존재. 모든 조항의 의미 검증까지 자동화되지는 않음 |
| `_traceability.md` | 본 문서 | 🔧 | 부분 기능·과거 이슈 연대기 중심 문서를 34개 전수표로 교체 |
| `admin-dashboard.md` | `js/admin-dashboard.js`, `DataStore.admin.*`, admin RPC migrations | ✅ | 현행 운영 표면과 지표 계약 존재 |
| `activity-inbox.md` | `js/activity-inbox.js`, DataStore 양 어댑터, `57_activity_inbox.sql`, `activity-inbox.test.mjs`·SQL 역할 fixture | ✅ | #1260 계약대로 같이읽기 헤더 활동함, 현재 source 90일/100개 projection, moderation, bounded seen key, guest 무네트워크를 구현. 실제 DEV/Production migration 적용·역할 SQL 실행은 별도 운영 검증 필요 |
| `analytics.md` | `rgTrack`, PostHog 동의 게이트, 주간 리포트 workflow | 📝 | v18 서재·활동 후보 이벤트와 legacy 책나무/XP/스트릭 격리를 반영. 신규 이벤트는 구현 전 |
| `architecture-asbuilt.md` | `main.js`, `worker/index.mjs`, `wrangler.toml`, workflows, migrations | 🔧 | main→stable DEV 자동, Worker Production·OTA beta·OTA Production 수동 동일 SHA 승격이라는 현재 workflow trigger를 보정 |
| `backend.md` | `datastore.js`, `datastore-supabase.js`, `schema.sql`, migrations | 🚩 | v18 서재는 기존 책 데이터를 재사용. 현행 게스트 이관 누락 가능성과 `ub_sel`의 넓은 read 범위는 별도 데이터·보안 게이트 |
| `barcode-scan.md` | `barcode-scan.js`, Android native scanner bridge | ✅ | 웹 폴백과 Android 경계가 문서화됨 |
| `co-reading.md` | `co-reading.js`, `rooms.*`, villages/room migrations | 📝 | 현행 `함께/숲`을 이력으로 보존하고 목표 `같이읽기/읽기방`, 무랭킹·무XP·공개범위 계약 반영 |
| `companion.md` | `companion.js`, `/api/companion`, `companion_sessions` | 📝 | 대화 계약은 현행과 일치. 캐릭터 최종 이름 TBD·진화 없는 2D 참새·기존 재키 임시 유지 반영 |
| `design.md` | `index.html` tokens, `RG_ICONS`, `design_lint.py` | 📝 | 현행 토큰 린트 0건. v18 서재의 preload·bounded rendering·저모션·대체 조작 계약 반영 |
| `feed.md` | `social.js`, `SentenceCard`, moderation migrations/tests | 📝 | 현행 인기 Top5·친구 책나무 진입은 레거시. 같이읽기 내 피드·무랭킹·무XP·공개범위 계약 유지 |
| `flexible-import.md` | `data-import.js`, `/api/parse-books`, shelf-import core | ✅ | 구현·검수 경로 존재 |
| `inquiry-sync.md` | 직접 대응 정책, 자동화 제거 커밋 | ✅ | 현재 자동 issue 동기화가 아니라 관리자 확인·개별 회신 |
| `integrated-shelf.md` | `shelf-import.js`, `import_staging`, `/api/seed` | ✅ | 스크린샷 복원·검토함·시드 경로 구현 |
| `legal-copyright.md` | 문장 길이·공개범위 제약, seed provenance 검증 | 📝 | 활성 결정은 모든 공개범위·OCR·직접입력·배치/import 최대 1,000자, 글자 수에 따른 제외·절단·private 강제 없음, 누적 저작권 위험 수용/추후 검토. 현행 Worker·DataStore·DB CHECK·OCR·batch/import·테스트에 200자 경계가 남아 후속 구현 필요 |
| `meta/decisions.md` | v12~v17과 현재 코드 이력 | 📝 | v18 책나무 보류·서재 IA·4번째 탭 미결정·전달 게이트 추가. v14~v17은 감사 이력으로 보존 |
| `meta/journey.md` | 역사 문서 | ✅ | v5/v6 여정으로만 사용. 현재 계약으로 사용하지 않음 |
| `meta/open-issues.md` | GitHub #1452~#1515와 수동 대조 | 📝 | v18 서재 전환과 게스트 이관·carousel·라우팅·4번째 탭 결정, XP 삭제·재독·문장 1,000자 후속을 분리 추적 |
| `meta/rejected.md` | 역사 문서 | 📝 | XP 재상품화·다중 나무·손실형 스트릭·시듦·랭킹·대형 세리머니·별도 숲과 **사전 고지·opt-out 없는** 공개확대를 v17 기각안으로 추가 |
| `nest.md` | `nest.js`, `nest-grow.js`, `nest-theatre.js`, `ceremony.js` | ⚠️ | 홈 독서 루프는 유지하고 책나무 사용자 표면은 보류. 현재 `nest-grow` 구현은 후속 route 전환 대상 |
| `onboarding.md` | `onboarding.js`, `nest.js` empty state, local notifications | 📝 | 실제 책 검색·서재 축적·비손실 기록의 v18 목표 여정 반영. 책나무 약속은 보류 이력 |
| `ops.md` | dev/prod workflows, `wrangler.toml`, release scripts | 📝 | spec 승인→구현→DEV QA→동일 SHA PROD→Production QA→Play, 권한·XP 단계 증거와 rollback 계약 추가 |
| `ota.md` | Capacitor updater, Worker `/api/ota`, OTA KV, release workflows | 🔧 | 실제 `ota-release`·`ota-promote`는 모두 `workflow_dispatch`+production environment. stable DEV/main 동일 SHA로 beta 수동 발행 후 같은 manifest를 prod에 수동 승격 |
| `privacy-policy.md` | 공개 privacy URL, consent UI, account deletion | 📝 | 친구 책나무·자동 활성화 보류. 최소공개·fail-closed·제한 API·base RLS 안전 조건은 유지 |
| `profile.md` | `library.js`, `settings-view.js`, `user-profile-modal.js` | 🚩 | 3번째 탭 서재·4번째 활동 방향을 반영. 친구 책나무 UI는 보류하고 `followers` round-trip 갭은 별도 차단 이슈로 유지 |
| `prompt-lab.md` | DEV-only API/UI, promotion transaction | 📝 | 실험·승격 경계는 유지하고 최종 캐릭터 이름 TBD, 재키/jacky는 호환 식별자로 정리 |
| `refactor-modularize.md` | `main.js` import map, 분리된 `js/*.js` | ✅ | 현재 모듈 구조와 부팅 순서가 as-built에 기록됨 |
| `referral.md` | `shareService`, 외부 공유 동선 | ⏳ | 보상·귀속·랜딩은 초안/미구현으로 명시됨 |
| `resurface.md` | `resurfaceCandidate`, `markResurfaced`, UI 카드 | ✅ | 코어 되감기 구현, 확장 범위는 의도된 후속 |
| `seed-collector.md` | `collector/`, `seed_queue`, Worker seed endpoint | ✅ | fail-closed provenance와 재시도 경계 문서화 |
| `share.md` | `share-card.js`, `navigator.share`·clipboard fallback | ✅ | 1:1 카드 구현, 9:16은 의도된 후속 |
| `systems.md` | `DataStore.streak`, `DataStore.xp`, `increment_xp`, shield schema | 📝 | 최근 14일·누적 성장일과 XP 제품폐기→쓰기동결→참조격리→물리삭제 계약 추가. 기존 수치표는 레거시 |

## 2. 현재 구현의 핵심 증거

| 영역 | 구현 위치 | 현재 사실 |
|---|---|---|
| 홈 상단 | `js/app.js` `topbar-stats` | 책나무 projection의 책·문장 수를 중립 용어로 노출 |
| 전용 3번째 탭 | `js/app.js`, `book-tree-home-ui.js` | 내부키 `nest-grow`, 라벨 `책나무`, `BookTreeHomeView` 렌더. v18 후속에서 `서재`로 전환 대상 |
| XP·둥지 표면 | 앱·DataStore·migration 참조 감사 | 신규 XP 쓰기와 둥지/성/만회 계약은 제거됐으며 레거시 SQL 이력은 별도 보존 |
| 스트릭 | `js/datastore.js`, `js/nest.js` | 현재 연속일 계산·7/30일 세리머니가 일부 남아 있다. v18 4번째 탭 결정 전 새 스트릭 상품 계약으로 해석하지 않음 |
| 책 상태 | `user_books.status`, `wish_books`, `myBooks.abort/resume/complete` | reading/completed/aborted와 wish가 별도 구조로 존재 |
| 공개 문장 | `sentences.visibility`, `sentences_public`, moderation policies | public/followers/private와 신고·차단 필터 구현 |
| 타인 서재 UI | `users.publicShelf`, `users.publicWishlist`, `user-profile-modal.js` | 읽는 중·완독만 렌더하고 위시리스트는 `wishlist_public` 토글에 의존 |
| 타인 책 base 권한 | `49_ugc_moderation.sql` `ub_sel` | 차단되지 않은 인증 사용자에게 `user_books` 전체 행 read 허용. UI 필터는 권한 경계가 아님 |
| 문장 기본 공개 설정 | `settings-view.js`, adapters | UI의 `친구 공개(followers)`와 영속 허용/복원 값이 불일치하는 드리프트 존재 |
| 같이읽기 | `js/co-reading.js`, `rooms.*` | 표면 용어 `함께`, 개별 공간 `숲`/방이 혼재 |
| AI 동반자 | `js/companion.js`, Worker companion route | 사용자 표시명은 Jacky/재키, 이름 교체 미결정 |

## 3. 감사 한계

- 정적 grep 검증은 코드 존재를 확인할 뿐 실제 UX·RLS·Production 적용을 보증하지 않는다.
- `docs/readinggo/supabase/*.sql` 존재와 Production 적용 여부는 다르다. `migrations_applied.py`도 table 33개·column 40개 존재만 확인하고 policy·view·RPC body·grant·trigger·RLS·backfill을 보증하지 않는다. 원격 ledger와 역할별 직접 API 검증 없이 적용 완료로 단정하지 않는다.
- 정적 감사에서 `user_books` 인증 사용자 read 범위를 확인했으나 Production의 실제 적용 정책·데이터 영향 건수는 아직 검증하지 않았다.
- 현재 spec-align·Node 회귀 통과는 현행 as-built 계약의 증거다. v18 서재·라우팅·carousel·게스트 전체 이관·개인 활동을 검증하는 invariant는 아직 없다.
- #1260 활동함은 `57_activity_inbox.sql`, DataStore 양 어댑터, 같이읽기 헤더 UI와 정적/SQL 회귀 fixture로 구현됐다. 저장소 로컬 검증은 RPC/RLS 계약을 확인하지만 실제 DEV/Production migration 적용과 역할 SQL 실행을 대신하지 않는다.
- 이번 구현 작업에서는 원격 DB·DEV·Production·Play Store를 변경하지 않는다.
- 최신 제품 결정은 구현 사실과 분리해 각 기능 스펙에 `목표 계약 / 현재 갭 / 전환 게이트`로 기록한다.
