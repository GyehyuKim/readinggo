# 운영: 배포 안전 (피처 플래그 · 카나리)

> **신설 (2026-06-24, #960·#901)** — 배포안전 에픽([#897](https://github.com/), decisions.md §8.13)의 P3 구현 스펙.
> 런칭 후 개발 중 **'머지 = 즉시 100% 프로덕션'** 사고를 줄이는 두 장치를 정의한다: **피처 플래그/킬 스위치**(#960)와 **카나리(점진 배포)**(#901).
> **2026-07-22 #1303 갱신**: [decisions.md §8.16](./meta/decisions.md)이 §8.13의 별도 환경 기각을 supersede한다.
> 카나리·플래그는 prod 내부 안전망으로 남고, 기본 릴리스 경로는 별도 dev 검증 → 동일 SHA prod 승격이다.
> **v17 전환 게이트 (2026-08-19, #1410·#1452·#1454·#1456)**: 책나무·XP 동결·친구 공개범위는 아래 §0의 순서를 건너뛰지 않는다. spec-only PR 승인·머지 전 구현을 시작하지 않으며, DEV에서 검증하지 않은 SHA를 Production이나 Play Store로 승격하지 않는다.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-first(코드 PR 동반 시 사유 PR 본문).

## 0. 책나무 전환 전달 게이트 (v17)

1. **결정 정합**: `meta/decisions.md`와 기능 SSOT가 구현 사실·목표 계약·미결정을 분리한다.
2. **스펙 승인·머지**: spec-only PR의 CI, 리뷰, 미해결 대화 0을 확인하고 main에 머지한다.
3. **구현 계획 승인**: UI, DataStore, RLS/RPC, migration, legacy APK, analytics, fixture, rollback을 작업 순서와 함께 승인한다.
4. **코드·DB 구현**: 신규 XP 쓰기 제거와 친구용 제한 권한을 코드·migration으로 구현한다. 기존 사용자 공개 확대와 XP 물리 삭제는 이 단계의 자동 포함 범위가 아니다.
5. **DEV 배포·QA**: DEV 전용 합성 fixture로 본인·친구·비친구·차단·공개범위·수백 가지/잎·구 APK 호환을 검증한다. Production 실사용자 데이터를 fixture로 쓰지 않는다.
6. **동일 SHA Production 승격**: DEV에서 승인한 commit SHA만 승격한다. 환경 차이와 적용 migration을 기록한다.
7. **Production QA**: 실제 Production에서 읽기·문장 저장·친구 권한·XP 무증가·롤백 경로를 직접 검증한다. CI·배포 성공만으로 완료 처리하지 않는다.
8. **Play Store**: Production QA와 네이티브 빌드 검증 뒤에만 스토어 빌드를 제출한다.

### 0.1 구 클라이언트·RLS 컷오버 순서

친구 책나무 권한 변경은 한 번의 배포로 처리하지 않는다. 각 release는 위 1~8 게이트를 독립적으로 통과한다.

1. **호출 인벤토리**: web, OTA 가능 셸, 스토어 APK의 `user_books`·`wish_books` 직접 조회와 `friends|followers` 공개범위 처리 버전을 확인한다.
2. **확장 단계 후보 — 신 경로 선배포**: 제한 friend view/RPC, 공개범위 호환 처리를 구현하고 신규 클라이언트가 이를 사용하게 한다. 이 release를 DEV QA → 동일 SHA Production QA → 필요 시 Play Store 순으로 전달한다. 이 단계에서 base RLS를 먼저 좁히지 않는다.
3. **수신·전환 확인**: OTA production 채널 수신율, 스토어 지원 버전 분포, friend RPC 호출과 legacy base 호출의 버전별 관측을 남긴다.
4. **컷오버 승인**: 구 API 실패를 허용할 최소 지원 버전, 업데이트/차단 정책, `friends|followers` fail-closed 방식을 제품·운영이 승인한다. 수치와 방식은 관측 전 임의 확정하지 않는다.
5. **축소 단계 후보 — 권한 축소**: 별도 migration release로 base RLS를 소유자 전용으로 좁힌다. 다시 DEV 직접 API QA → 동일 migration·SHA Production → Production 직접 API QA를 수행한다.
6. **rollback**: 축소 단계 장애 시 친구 책나무 UI·제한 RPC를 비활성화한다. 광범위한 base select 정책을 복원해 개인정보 노출을 되살리지 않는다. 최소 버전 이하 구 APK의 친구 서재 실패는 승인된 업데이트 정책으로 처리한다.

확장 단계 수신 증거와 축소 단계 승인 사이에는 broad `ub_sel` 개인정보 갭이 남는다. 이 기간을 정상 완료 상태로 보지 않고, 기간·영향·완화·종료 조건을 release 기록에 남긴다.

### 0.2 활성화와 롤백

- **책나무 UI 노출 게이트**: 새 책나무 UI와 읽기 모델의 노출을 제어한다. off면 기존 화면으로 돌아가되 신규 XP 쓰기를 다시 켜지 않는다. 실제 flag 식별자는 구현 계획에서 정한다.
- **친구 공개 게이트**: 친구 책나무 UI와 제한 friend view/RPC 호출을 제어한다. RLS·구버전 컷오버가 배포·검증되기 전 기본 off다. 실제 flag 식별자는 구현 계획에서 정한다.
- XP 동결은 feature flag rollback 대상이 아니다. 구 APK 호환 RPC가 no-op으로 안전해야 하며, 장애 시에도 신규 XP 적립을 재개하지 않는다.
- 공개범위 migration은 가역적 mapping과 영향 건수, 백업·복원 쿼리, 고지 버전·효력일·opt-out 및 철회 상태의 기기 간 복원 기록을 갖춘 별도 승인 작업이다.
- rollback은 스키마 하위호환을 우선한다. UI rollback이 기존 앱·데이터를 읽을 수 있는 기간이 끝나기 전 컬럼·RPC를 삭제하지 않는다.

### 0.3 단일 release receipt와 완료 증거

각 전달 단위는 다음 항목을 **하나의 release receipt**로 연결한다. Worker·OTA·DB·Play·QA가 서로 다른 SHA나 미확인 artifact를 가리키면 완료가 아니다.

- spec merge SHA, 구현 PR, 승인 SHA, DEV workflow/run·Worker version·`/api/release`, Production workflow/run·Worker version
- OTA beta/production version·manifest SHA·URL·checksum·`minNative`·기기 수신 결과
- DB migration 파일명·SHA-256·적용 순서·대상 환경·원격 ledger read-back·영향 건수·rollback 쿼리
- Play versionCode·AAB checksum·서명/출처·내부/Production 트랙·설치 기기 QA
- owner·friend·nonfriend·blocked·anonymous 직접 API와 UI 허용·거부 결과
- XP 신규 획득 경로의 DB 값 변화 0, app version별 legacy 호출량, 분석 격리

모든 검증 항목은 `PASS | FAIL | BLOCKED | NOT_RUN` 중 하나다. skip·unknown·secret 부재·"workflow success"만으로 PASS를 만들지 않는다.

`migrations_applied.py`의 현재 범위는 table 33개·column 40개 존재 확인이며 policy·view·RPC body·grant·trigger·RLS·backfill을 검증하지 않는다. 일부 원격 조회 실패가 성공으로 오인될 수 있으므로, verifier green만으로 migration 완료를 선언하지 않는다. v17 migration은 위 객체의 정의·권한·역할별 동작과 원격 ledger를 별도 fail-closed 검증한다. 정확한 verifier 구현은 후속 코드 PR에서 승인한다.

## 1. 피처 플래그 / 킬 스위치 (#960)

위험·신규 기능을 **boolean 설정값 뒤에** 둔다. 카나리가 놓친 회귀가 100%까지 가도, **배포·롤백 없이 그 기능만 즉시 끈다.** 카나리(§2)가 "영향 범위를 쪼개는" 사전 장치라면, 플래그는 "이미 나간 걸 기능 단위로 차단하는" 사후 장치다 — 둘이 빈틈(한 번에 100% · 자동 롤백이 렌더만 봄)을 메운다.

### 1.1 위치 · 패턴 (SSOT)

- **정의처**: [`js/config.js`](../js/config.js) `RG_CONFIG.FLAGS = { <name>: <boolean>, ... }`. 클라 공개 안전(민감정보 아님 — 키·시크릿 금지).
- **조회**: `window.RG_flag(name)` — 단순·안전 조회. **미정의/오타/`FLAGS` 부재 → `false`**(기능 미노출이 안전 기본값). 피처 코드는 이 헬퍼만 쓴다(`RG_CONFIG.FLAGS` 직접 접근 금지 — 안전 폴백 우회 방지).
- **토글 방법(Phase 0)**: `config.js` 값을 바꿔 **작은 배포**(`npx wrangler deploy` 또는 main 머지→Workers Build). 코드 한 줄·작은 diff라 카나리·롤백 위험이 거의 없다.

### 1.2 off = 미노출 원칙 (graceful-skip)

플래그가 **off면 그 기능의 UI·네트워크 호출이 노출되지 않는다.** 기존 graceful-skip 패턴 재사용:

- 위험 호출(네트워크·트리거)을 감싼 분기를 `if (!window.RG_flag(name)) { …정리… return; }` 로 **조기 종료**.
- **빈 섹션·진행 placeholder도 함께 생략**(빈 섹션 금지 원칙). 예: '모으는 중' 안내는 트리거가 돌 때만 떠야 하므로 off면 상태를 false로 두어 자연히 숨긴다.
- 읽기 전용 부수 표시(예: 이미 적재된 문장 조회)는 위험 행위가 아니면 플래그 대상이 아니다 — **트리거/쓰기 경로만** 끈다(최소 차단면).

### 1.3 저장 위치 — config.js 채택 (대안 1줄)

플래그 저장 위치 fork가 있다: **(A) `js/config.js` 값**(최소·Phase 0) vs **(B) Cloudflare Worker `[vars]`/원격 설정**(재배포 없는 즉시 토글). 본 스펙은 **(A) config.js 단일을 채택** — 3인·Phase 0 규모에서 추적이 한곳에 모이고 추가 인프라가 없다. (B)는 "작은 배포조차 없이 토글"이 필요할 때(큰 장애 대응) 재검토하되, 현재는 (A)의 작은 배포로 충분하다. 게스트/유저별 분기·관리 UI는 **현 범위 밖**(필요해지면 별도 이슈).

### 1.4 현재 플래그

| 플래그 | 기능 | 기본 | off 동작 |
|---|---|---|---|
| `seedCollectorTrigger` | 마중물 시드 트리거 (#774) — 빈 책에서 collector(맥미니)로 `/api/seed` 큐잉+폴링. **실배선 킬 스위치** = [`js/book-info-modal.js`](../js/book-info-modal.js) | `true` | `/api/seed` POST·폴링 미실행 + '이웃의 문장 모으는 중' placeholder 생략. 이미 적재된 인기 문장(byBook 읽기)은 유지 |
| `socialProofSentences` | 같은 책 타인 한 문장 — 콜드스타트 사회적 증거 ([nest.md §5](./nest.md), [#926](https://github.com/) in-flight) | `true` | (예시) 해당 기능 출시 시 둥지 '이 책의 다른 한 문장' 섹션·`/api/seed` 트리거를 이 플래그 뒤에 둔다 |

> **실배선 1건**: `seedCollectorTrigger` 가 main에 실재하는 위험 기능(collector 백엔드 의존 네트워크 트리거)을 끄는 킬 스위치로 `book-info-modal.js` 효과 진입부에 배선됐다. collector 장애·과부하 시 클라발 호출을 즉시 차단한다.
> `socialProofSentences` 는 같은 트리거를 동반하는 신규 기능(#926, 별도 브랜치 진행 중)이 main에 들어올 때 그 섹션을 가릴 자리만 미리 잡아둔 것이다(off=미노출 원칙 적용 예시).

## 2. dev 검증 → 동일 SHA production 승격 (#1303)

| 경계 | DEV | PROD |
|---|---|---|
| Supabase | 별도 `ReadingGo Dev`(서울), 합성 fixture만 | 기존 `ReadingGo`, 운영 사용자 |
| Worker | `readinggo-dev`, stable URL + version preview | `readinggo`, 기존 사용자 URL |
| binding | dev 전용 KV, dev service-role secret. cron/R2/운영 side effect 없음 | 기존 prod KV/R2/secret/cron |
| 배포 | PR=비프로모션 preview, `main`=stable dev 자동 배포 | `workflow_dispatch` + GitHub `production` environment Hermes 승인 |

DEV 빌드는 `VITE_SUPABASE_URL`·`VITE_SUPABASE_PUBLISHABLE_KEY`·`VITE_API_ORIGIN`을 GitHub DEV secret에서
주입한다. 저장소에는 dev project ref나 credential을 고정하지 않는다. Worker는 `wrangler.dev.toml`을 쓰며
`SUPABASE_URL`·`RELEASE_SHA`를 배포 시 주입하고, `SUPABASE_SERVICE_ROLE_KEY`는 `readinggo-dev`에만 등록한다.

승격 workflow는 (1) 승인 SHA가 `origin/main` HEAD인지, (2) stable dev `/api/release` receipt의 SHA와 같은지
검증한 뒤에만 동일 checkout을 prod에 배포한다. 자세한 실행·rollback은 [RUNBOOK-DEPLOY](../RUNBOOK-DEPLOY.md).

### 2.1 prod 카나리 — 보조 안전망 (#901)

> **이 절차의 롤아웃 단계는 Cloudflare 계정 액션(대시보드/`wrangler`)이라 코드/PR로 자동화되지 않는다 — 계휴(계정 보유자)가 수동 실행한다.** 본 스펙은 *방법*을 문서화할 뿐, 실제 트래픽 분할은 LLM이 실행할 수 없다.

### 2.1.1 개념

[Cloudflare Workers gradual deployment](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/) 로 **새 버전을 일부 트래픽에만 먼저** 보낸 뒤(예: 10%) 모니터하고, 이상 없으면 100%로 올린다. "터져도 일부만" — 영향 범위를 시간축으로 쪼갠다. 현재 배포(main 머지 → Workers Build가 Vite 빌드→`dist` 즉시 100% 서빙)의 빈틈(① 한 번에 100% ② 자동 롤백이 "렌더되나"만 봄)을 메우는 *사전* 장치.

### 2.2 절차 (수동 — 계정 액션)

1. **새 버전 업로드(배포 아님)** — 트래픽을 받지 않는 버전만 올린다.
   ```bash
   npx wrangler versions upload
   ```
   출력의 **Version ID**(예: `e6b2…`)를 기록한다. 이 단계는 라이브 트래픽에 영향 없음.
2. **카나리 시작 — 새 버전 10% / 직전 버전 90%**:
   ```bash
   npx wrangler versions deploy <NEW_VERSION_ID>@10 <PREV_VERSION_ID>@90
   ```
   (대시보드: Workers & Pages → `readinggo` → Deployments → *Deploy version* → 두 버전 비율 지정.)
3. **모니터**(권장 10~30분 또는 트래픽 한 사이클). 보는 것: Workers 대시보드 **Errors/Invocations**, `deploy-verify` live smoke(렌더), 그리고 **카나리가 못 보는 데이터·플로우 회귀**는 수동 확인(핵심 플로우 1~2개 직접). 이상 징후면 §2.3 즉시 롤백.
4. **승격 — 100%**:
   ```bash
   npx wrangler versions deploy <NEW_VERSION_ID>@100
   ```
   또는 안정 확인 후 일반 `npx wrangler deploy`(최신 빌드 100%).

### 2.3 롤백

- **카나리 중**: 직전 버전 100%로 되돌린다.
  ```bash
  npx wrangler versions deploy <PREV_VERSION_ID>@100
  ```
- **기능 단위**: 회귀가 특정 기능이면 §1 플래그를 off로(작은 config 배포) — 전체 롤백보다 좁게 차단.
- 기존 `deploy-verify`(live smoke ×3 → 3연속 실패 시 자동 롤백)는 그대로 안전망으로 둔다(렌더 회귀 한정).

### 2.4 버전 affinity (선택, #901)

비율 분할 중 한 세션이 매 요청 다른 버전에 붙으면 상태가 튄다. 세션 고정이 필요하면 gradual deployment의 **version affinity**(쿠키 기반 세션 고정)를 켠다 — Phase 0 정적+클라 상태(localStorage) 특성상 필수는 아니나, Phase 1 Supabase 세션·서버 상태가 늘면 검토.

## 3. 격리 불변조건

- dev bundle에 prod Supabase/Worker endpoint가 없어야 한다.
- dev Worker에 prod KV/R2 ID, production secret, cron이 없어야 한다.
- production 관련 workflow는 `main` push로 실행되면 안 되며 `production` environment 승인을 요구한다.
- 이 중 하나라도 증명할 수 없으면 prod 승격을 중단하고 rollback이 아니라 pause/report한다.
