# 스펙 ↔ 구현 추적 매트릭스

> **감사 기준**: `origin/main@0744eaa` (2026-08-19)
> **목적**: 현재 구현 사실과 스펙의 정합 여부를 파일별로 검토한다. 제품의 미래 목표 계약은 `meta/decisions.md`와 각 기능 스펙에서 관리하며, 아직 구현되지 않은 결정은 구현 완료로 표시하지 않는다.

## 상태

- ✅ **정합**: 현재 구현·검증 증거와 스펙이 일치
- 🔧 **이번 정합**: 구현은 존재하지만 인덱스·추적 문서가 뒤처져 이번 spec PR에서 보정
- ⚠️ **레거시 현행**: 현재 구현돼 있으나 최신 제품 결정에 따라 후속 교체 예정
- ⏳ **의도된 미구현**: 스펙에 후속 범위로 명시됐고 현재 구현되지 않음
- 🚩 **검토 필요**: 스펙과 구현 중 어느 쪽을 정본으로 할지 제품·운영 결정 필요

## 검증 기준선

| 검증 | 결과 | 해석 |
|---|---|---|
| `python3 tests/spec-align/align_v7.py` | ✅ 99/99 | 과거 v7~v16 기능의 존재·부재 검사. 최신 제품 결정을 검증하지는 않음 |
| `python3 tests/spec-align/nest.py` | ✅ 9/9 | 현재 XP·둥지 구현이 존재함을 확인하는 레거시 기준선 |
| `python3 tests/spec-align/architecture_current.py` | ✅ 3/3 | Vite·Capacitor·Cloudflare·DataStore 현재 계약 확인 |
| `python3 tests/spec-align/drift.py` | ✅ | spec-drift workflow 구조 확인 |
| `python3 tests/spec-align/design_lint.py` | ✅ 0건 | 이모지·raw hex·ghost·radius·font 규칙 위반 없음 |
| 루트 `npm test` | 🚩 스크립트 없음 | 저장소 루트에 `package.json`이 없어 실행 불가. 제품 빌드는 `docs/readinggo/` 기준으로 별도 검증 |

## 1. 33개 스펙 파일 전수 상태

| 파일 | 현재 구현 증거 | 상태 | 감사 메모 |
|---|---|---|---|
| `README.md` | `architecture_current.py`; 현재 Vite·Capacitor·Cloudflare 설명 | 🔧 | 실제 33개 중 다수 파일이 지도에서 누락됐고 v7을 최상위 기준으로 오해하게 하던 문구를 이번 PR에서 보정 |
| `SYNC-POLICY.md` | `.github/workflows/spec-drift.yml`, `tests/spec-align/drift.py` | ✅ | 정책과 CI 구조가 존재. 모든 조항의 의미 검증까지 자동화되지는 않음 |
| `_traceability.md` | 본 문서 | 🔧 | 부분 기능·과거 이슈 연대기 중심 문서를 33개 전수표로 교체 |
| `admin-dashboard.md` | `js/admin-dashboard.js`, `DataStore.admin.*`, admin RPC migrations | ✅ | 현행 운영 표면과 지표 계약 존재 |
| `analytics.md` | `rgTrack`, PostHog 동의 게이트, 주간 리포트 workflow | ✅ | 현행 이벤트·동의 계약은 구현. 제품 지표 변경 시 별도 갱신 필요 |
| `architecture-asbuilt.md` | `main.js`, `worker/index.mjs`, `wrangler.toml`, migrations | ✅ | 2026-08 런타임 구조와 검증기 일치 |
| `backend.md` | `datastore.js`, `datastore-supabase.js`, `schema.sql`, migrations | ✅ | 현재 DataStore·XP·상태·공개범위 계약을 반영. 미래 데이터 모델은 별도 표기 필요 |
| `barcode-scan.md` | `barcode-scan.js`, Android native scanner bridge | ✅ | 웹 폴백과 Android 경계가 문서화됨 |
| `co-reading.md` | `co-reading.js`, `rooms.*`, villages/room migrations | ✅ | 현재 `함께`·`숲`·방 구현과 일치. 명칭 변경 결정은 미래 계약으로 분리 필요 |
| `companion.md` | `companion.js`, `/api/companion`, `companion_sessions` | ✅ | 최대 10턴·동의·완독 회고·프리셋 구현 증거 존재 |
| `design.md` | `index.html` tokens, `RG_ICONS`, `design_lint.py` | ✅ | 현행 토큰·컴포넌트 규칙은 자동검증 0건 |
| `feed.md` | `social.js`, `SentenceCard`, moderation migrations/tests | ✅ | 현재 피드·공개 문장·신고·차단 계약 구현. 책 상태 공개 정책 변경은 미래 계약 |
| `flexible-import.md` | `data-import.js`, `/api/parse-books`, shelf-import core | ✅ | 구현·검수 경로 존재 |
| `inquiry-sync.md` | 직접 대응 정책, 자동화 제거 커밋 | ✅ | 현재 자동 issue 동기화가 아니라 관리자 확인·개별 회신 |
| `integrated-shelf.md` | `shelf-import.js`, `import_staging`, `/api/seed` | ✅ | 스크린샷 복원·검토함·시드 경로 구현 |
| `legal-copyright.md` | 문장 길이·공개범위 제약, seed provenance 검증 | ✅ | 공개 인용과 private 1,000자 경계가 코드·DB에 존재 |
| `meta/decisions.md` | v12~v16과 현재 코드 이력 | ✅ | 2026-08-16까지 결정과 현행 구현 일치. 이후 결정은 append-only로 추가 필요 |
| `meta/journey.md` | 역사 문서 | ✅ | v5/v6 여정으로만 사용. 현재 계약으로 사용하지 않음 |
| `meta/open-issues.md` | GitHub 이슈와 수동 대조 필요 | 🚩 | 해소된 XP destination 등 오래된 항목과 최신 미결정을 다시 분류해야 함 |
| `meta/rejected.md` | 역사 문서 | ✅ | 기각 이력 보존. 최신 결정으로 대체된 것과 기각된 것을 구분해야 함 |
| `nest.md` | `nest.js`, `nest-grow.js`, `nest-theatre.js`, `ceremony.js` | ⚠️ | 현재 XP·1,600 주기·둥지 탭은 구현과 일치하지만 최신 제품 방향에서 교체 예정 |
| `onboarding.md` | `onboarding.js`, `nest.js` empty state, local notifications | ✅ | 현재 가입·빈 상태·알림 구현과 일치. 세계관 온보딩 목표는 미래 계약 |
| `ops.md` | dev/prod workflows, `wrangler.toml`, release scripts | ✅ | DEV·Production 분리와 동일 SHA 승격 계약 존재 |
| `ota.md` | Capacitor updater, Worker `/api/ota`, OTA KV | ✅ | shell version affinity와 beta→prod 흐름 구현 |
| `privacy-policy.md` | 공개 privacy URL, consent UI, account deletion | ✅ | 처리방침 게시·동의·권리 계약 구현. 친구 책 상태 공개는 제품 공개정책과 별도 검토 |
| `profile.md` | `library.js`, `settings-view.js`, `user-profile-modal.js` | ✅ | 현재 5탭·책 상태·공개 위시리스트 토글·문장 설정과 일치 |
| `prompt-lab.md` | DEV-only API/UI, promotion transaction | ✅ | DEV 격리와 Judy 승격 경계 구현 |
| `refactor-modularize.md` | `main.js` import map, 분리된 `js/*.js` | ✅ | 현재 모듈 구조와 부팅 순서가 as-built에 기록됨 |
| `referral.md` | `shareService`, 외부 공유 동선 | ⏳ | 보상·귀속·랜딩은 초안/미구현으로 명시됨 |
| `resurface.md` | `resurfaceCandidate`, `markResurfaced`, UI 카드 | ✅ | 코어 되감기 구현, 확장 범위는 의도된 후속 |
| `seed-collector.md` | `collector/`, `seed_queue`, Worker seed endpoint | ✅ | fail-closed provenance와 재시도 경계 문서화 |
| `share.md` | `share-card.js`, `navigator.share`·clipboard fallback | ✅ | 1:1 카드 구현, 9:16은 의도된 후속 |
| `systems.md` | `DataStore.streak`, `DataStore.xp`, `increment_xp`, shield schema | ⚠️ | 현행 스트릭·XP·둥지 계약은 구현됐지만 최신 제품 방향에서 교체 예정 |

## 2. 현재 구현의 핵심 증거

| 영역 | 구현 위치 | 현재 사실 |
|---|---|---|
| 홈 상단 | `js/app.js` `topbar-stats` | `XP {n} · 🪺 둥지 {floor(xp/1600)}개` 노출 |
| 전용 둥지 탭 | `js/app.js`, `js/nest-grow.js`, `js/nest-theatre.js` | 내부키 `nest-grow`, 라벨 `둥지`, 1,600 XP 주기·완성 이력 |
| XP 쓰기 | `js/datastore.js`, `js/datastore-supabase.js`, `39_increment_xp_rpc.sql` | 체크인·방문·반응 등에서 XP 적립, 로그인은 원자 RPC 사용 |
| 스트릭 | `js/datastore.js`, `43_checkin_atomic.sql`, `js/nest.js` | 연속일·하루 만회·마일스톤 회고 구현 |
| 책 상태 | `user_books.status`, `wish_books`, `myBooks.abort/resume/complete` | reading/completed/aborted와 wish가 별도 구조로 존재 |
| 공개 문장 | `sentences.visibility`, `sentences_public`, moderation policies | public/followers/private와 신고·차단 필터 구현 |
| 타인 서재 | `users.publicShelf`, `users.publicWishlist`, `user-profile-modal.js` | 읽는 중·완독 책은 공개, 위시리스트는 `wishlist_public` 토글에 의존 |
| 같이읽기 | `js/co-reading.js`, `rooms.*` | 표면 용어 `함께`, 개별 공간 `숲`/방이 혼재 |
| AI 동반자 | `js/companion.js`, Worker companion route | 사용자 표시명은 Jacky/재키, 이름 교체 미결정 |

## 3. 감사 한계

- 정적 grep 검증은 코드 존재를 확인할 뿐 실제 UX·RLS·Production 적용을 보증하지 않는다.
- `docs/readinggo/supabase/*.sql` 존재와 Production 적용 여부는 다르다. live migration 감사 없이 적용 완료로 단정하지 않는다.
- 이번 spec-only 작업에서는 코드·DB·DEV·Production·Play Store를 변경하지 않는다.
- 최신 제품 결정은 구현 사실과 분리해 각 기능 스펙에 `목표 계약 / 현재 갭 / 전환 게이트`로 기록한다.
