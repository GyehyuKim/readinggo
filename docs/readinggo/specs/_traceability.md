# 스펙 ↔ 구현 추적 매트릭스

> **감사 기준**: `origin/main@39248ef` (2026-08-19)
> **목적**: 현재 구현 사실과 스펙의 정합 여부를 파일별로 검토한다. 제품의 미래 목표 계약은 `meta/decisions.md`와 각 기능 스펙에서 관리하며, 아직 구현되지 않은 결정은 구현 완료로 표시하지 않는다.

## 상태

- ✅ **정합**: 현재 구현·검증 증거와 스펙이 일치
- 🔧 **이번 정합**: 구현은 존재하지만 인덱스·추적 문서가 뒤처져 이번 spec PR에서 보정
- 📝 **목표 정합**: 현행 구현과 최신 목표 계약을 분리해 스펙에 반영했으며 구현은 아직 안 됨
- ⚠️ **레거시 현행**: 현재 구현돼 있으나 최신 제품 결정에 따라 후속 교체 예정
- ⏳ **의도된 미구현**: 스펙에 후속 범위로 명시됐고 현재 구현되지 않음
- 🚩 **출시 차단 갭**: 보안·개인정보·영속·검증 문제로 구현 또는 운영 증거 없이는 출시할 수 없음

## 검증 기준선

> 2026-08-19 로컬 실행 보고다. 아래 full build·Node·Playwright는 반대감사 전 head에서 통과했고 이후 변경은 Markdown뿐이며, 정적 스펙·markdownlint·diff check는 최종 문서 수정 뒤 다시 실행했다. 영속 receipt는 이 branch의 PR CI run URL로 확정하며, 로컬 PASS를 DEV·Production 적용 증거로 사용하지 않는다.

| 검증 | 결과 | 해석 |
|---|---|---|
| `python3 tests/spec-align/align_v7.py` | `PASS` (99/99) | 과거 v7~v16 기능의 존재·부재 검사. 최신 제품 결정을 검증하지는 않음 |
| `python3 tests/spec-align/nest.py` | `PASS` (9/9) | 현재 XP·둥지 구현이 존재함을 확인하는 레거시 기준선 |
| `python3 tests/spec-align/architecture_current.py` | `PASS` (3/3) | Vite·Capacitor·Cloudflare·DataStore 현재 계약 확인 |
| `python3 tests/spec-align/drift.py` | `PASS` | spec-drift workflow 구조 확인 |
| `python3 tests/spec-align/design_lint.py` | `PASS` (0건) | 이모지·raw hex·ghost·radius·font 규칙 위반 없음 |
| `python3 tests/spec-align/migrations_applied.py` | `BLOCKED` | 기본 Python 3.9.6은 `str \| None`에서 실패. `uv` Python 3.11에서는 시작되나 worktree에 `SUPABASE_ACCESS_TOKEN`이 없어 원격 검증 보류 |
| `npm run build` (`docs/readinggo`) | `PASS` (로컬) | production·합성 DEV build 모두 성공. 폰트 runtime resolution·대형 chunk 경고는 기존 상태 |
| Node·Worker·Playwright 회귀 묶음 | `PASS` (로컬) | `.github/workflows/test.yml`의 계약·회귀·Production build/boot·합성 DEV isolation·Playwright render smoke를 실행. 파일 수나 assertion 수를 고정 계약으로 삼지 않는다. 현행 OCR 테스트가 `201~1000자→private`를 요구하므로 v17 1,000자 공개 계약의 구현 완료 증거는 아님 |

## 1. 33개 스펙 파일 전수 상태

| 파일 | 현재 구현 증거 | 상태 | 감사 메모 |
|---|---|---|---|
| `README.md` | `architecture_current.py`; 현재 Vite·Capacitor·Cloudflare 설명 | 🔧 | 실제 33개 중 다수 파일이 지도에서 누락됐고 v7을 최상위 기준으로 오해하게 하던 문구를 이번 PR에서 보정 |
| `SYNC-POLICY.md` | `.github/workflows/spec-drift.yml`, `tests/spec-align/drift.py` | ✅ | 정책과 CI 구조가 존재. 모든 조항의 의미 검증까지 자동화되지는 않음 |
| `_traceability.md` | 본 문서 | 🔧 | 부분 기능·과거 이슈 연대기 중심 문서를 33개 전수표로 교체 |
| `admin-dashboard.md` | `js/admin-dashboard.js`, `DataStore.admin.*`, admin RPC migrations | ✅ | 현행 운영 표면과 지표 계약 존재 |
| `analytics.md` | `rgTrack`, PostHog 동의 게이트, 주간 리포트 workflow | 📝 | 책나무·성장 리듬 이벤트와 legacy XP/스트릭 격리를 추가. 신규 이벤트는 구현 전 |
| `architecture-asbuilt.md` | `main.js`, `worker/index.mjs`, `wrangler.toml`, workflows, migrations | 🔧 | main→stable DEV 자동, Worker Production·OTA beta·OTA Production 수동 동일 SHA 승격이라는 현재 workflow trigger를 보정 |
| `backend.md` | `datastore.js`, `datastore-supabase.js`, `schema.sql`, migrations | 🚩 | 목표 투영·RLS·XP 호환 계약을 추가. 현행 `ub_sel`이 차단 외 인증 사용자에게 타인 `user_books` 전체 컬럼 read를 허용해 권한 수정 전 친구 책나무 활성화 금지 |
| `barcode-scan.md` | `barcode-scan.js`, Android native scanner bridge | ✅ | 웹 폴백과 Android 경계가 문서화됨 |
| `co-reading.md` | `co-reading.js`, `rooms.*`, villages/room migrations | 📝 | 현행 `함께/숲`을 이력으로 보존하고 목표 `같이읽기/읽기방`, 무랭킹·무XP·공개범위 계약 반영 |
| `companion.md` | `companion.js`, `/api/companion`, `companion_sessions` | 📝 | 대화 계약은 현행과 일치. 캐릭터 최종 이름 TBD·진화 없는 2D 참새·기존 재키 임시 유지 반영 |
| `design.md` | `index.html` tokens, `RG_ICONS`, `design_lint.py` | 📝 | 현행 토큰 린트 0건. 대규모 책나무 IA·저모션·상태 표현·20/24px 아이콘 결정 게이트 추가 |
| `feed.md` | `social.js`, `SentenceCard`, moderation migrations/tests | 📝 | 현행 인기 Top5는 레거시. 목표 같이읽기 내 피드·무랭킹·무XP·친구 책나무 공개 계약 반영 |
| `flexible-import.md` | `data-import.js`, `/api/parse-books`, shelf-import core | ✅ | 구현·검수 경로 존재 |
| `inquiry-sync.md` | 직접 대응 정책, 자동화 제거 커밋 | ✅ | 현재 자동 issue 동기화가 아니라 관리자 확인·개별 회신 |
| `integrated-shelf.md` | `shelf-import.js`, `import_staging`, `/api/seed` | ✅ | 스크린샷 복원·검토함·시드 경로 구현 |
| `legal-copyright.md` | 문장 길이·공개범위 제약, seed provenance 검증 | 📝 | 활성 결정은 모든 공개범위·OCR·직접입력·배치/import 최대 1,000자, 글자 수에 따른 제외·절단·private 강제 없음, 누적 저작권 위험 수용/추후 검토. 현행 Worker·DataStore·DB CHECK·OCR·batch/import·테스트에 200자 경계가 남아 후속 구현 필요 |
| `meta/decisions.md` | v12~v16과 현재 코드 이력 | 📝 | v17 책나무·XP 폐기·리듬·책 상태·공개범위·명칭·미결정·전달 게이트 추가. v14~v16은 감사 이력으로 보존 |
| `meta/journey.md` | 역사 문서 | ✅ | v5/v6 여정으로만 사용. 현재 계약으로 사용하지 않음 |
| `meta/open-issues.md` | GitHub #1452~#1457과 수동 대조 | 📝 | 아이콘·이름·공개 migration·구 APK·XP 삭제·재독 스키마와 문장 1,000자 구현 #1457을 추적. 누적 저작권 재검토만 비차단 후속으로 분리 |
| `meta/rejected.md` | 역사 문서 | 📝 | XP 재상품화·다중 나무·손실형 스트릭·시듦·랭킹·대형 세리머니·별도 숲과 **사전 고지·opt-out 없는** 공개확대를 v17 기각안으로 추가 |
| `nest.md` | `nest.js`, `nest-grow.js`, `nest-theatre.js`, `ceremony.js` | 📝 | v17 한 그루·책=가지·문장=잎·검색 목록·상태·세리머니 수용기준을 추가. XP 둥지는 레거시 as-built |
| `onboarding.md` | `onboarding.js`, `nest.js` empty state, local notifications | 📝 | 첫 책=가지·첫 문장=잎·비손실 리듬·축소 세리머니 목표 여정 추가. 기존 카피는 현행 이력 |
| `ops.md` | dev/prod workflows, `wrangler.toml`, release scripts | 📝 | spec 승인→구현→DEV QA→동일 SHA PROD→Production QA→Play, 권한·XP 단계 증거와 rollback 계약 추가 |
| `ota.md` | Capacitor updater, Worker `/api/ota`, OTA KV, release workflows | 🔧 | 실제 `ota-release`·`ota-promote`는 모두 `workflow_dispatch`+production environment. stable DEV/main 동일 SHA로 beta 수동 발행 후 같은 manifest를 prod에 수동 승격 |
| `privacy-policy.md` | 공개 privacy URL, consent UI, account deletion | 📝 | 현행 처리 사실을 유지하면서 4-B 사전 고지 후 자동 활성화+전체 opt-out, 5-A 제한 API 선배포→구버전 관측→base RLS owner-only 축소 게이트를 분리 |
| `profile.md` | `library.js`, `settings-view.js`, `user-profile-modal.js` | 🚩 | 목표 무XP 프로필·친구 책나무·3단계 문장 기본값 round-trip 반영. 현행 `followers` 기본값 저장/복원 불일치는 출시 차단 구현 갭 |
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
| 홈 상단 | `js/app.js` `topbar-stats` | `XP {n} · 🪺 둥지 {floor(xp/1600)}개` 노출 |
| 전용 둥지 탭 | `js/app.js`, `js/nest-grow.js`, `js/nest-theatre.js` | 내부키 `nest-grow`, 라벨 `둥지`, 1,600 XP 주기·완성 이력 |
| XP 쓰기 | `js/datastore.js`, `js/datastore-supabase.js`, `39_increment_xp_rpc.sql` | 체크인·방문·반응 등에서 XP 적립, 로그인은 원자 RPC 사용 |
| 스트릭 | `js/datastore.js`, `43_checkin_atomic.sql`, `js/nest.js` | 연속일·하루 만회·마일스톤 회고 구현 |
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
- 현재 Node·Worker·Playwright 회귀 통과는 현행 v16/레거시 계약의 증거다. XP 제거·책나무·새 공개범위·1,000자 공개 저장을 검증하는 v17 invariant는 아직 없다.
- 이번 spec-only 작업에서는 코드·DB·DEV·Production·Play Store를 변경하지 않는다.
- 최신 제품 결정은 구현 사실과 분리해 각 기능 스펙에 `목표 계약 / 현재 갭 / 전환 게이트`로 기록한다.
