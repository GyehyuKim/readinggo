# 운영: 배포 안전 (피처 플래그 · 카나리)

> **신설 (2026-06-24, #960·#901)** — 배포안전 에픽([#897](https://github.com/), decisions.md §8.13)의 P3 구현 스펙.
> 런칭 후 개발 중 **'머지 = 즉시 100% 프로덕션'** 사고를 줄이는 두 장치를 정의한다: **피처 플래그/킬 스위치**(#960)와 **카나리(점진 배포)**(#901).
> **2026-07-22 #1303 갱신**: [decisions.md §8.16](./meta/decisions.md)이 §8.13의 별도 환경 기각을 supersede한다.
> 카나리·플래그는 prod 내부 안전망으로 남고, 기본 릴리스 경로는 별도 dev 검증 → 동일 SHA prod 승격이다.
> **v17 전환 게이트 (2026-08-19, #1410·#1452·#1454·#1456)**: 레거시·XP 동결·친구 공개범위는 아래 §0의 순서를 건너뛰지 않는다. spec-only PR 승인·머지 전 구현을 시작하지 않으며, DEV에서 검증하지 않은 SHA를 Production이나 Play Store로 승격하지 않는다.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-first(코드 PR 동반 시 사유 PR 본문).

## 0. 레거시 전환 전달 게이트 (v17)

1. **결정 정합**: `meta/decisions.md`와 기능 SSOT가 구현 사실·목표 계약·미결정을 분리한다.
2. **스펙 승인·머지**: spec-only PR의 CI, 리뷰, 미해결 대화 0을 확인하고 main에 머지한다.
3. **구현 계획 승인**: UI, DataStore, RLS/RPC, migration, analytics, fixture, 백업·rollback을 작업 순서와 함께 승인한다. **Phase 4의 XP·둥지·성·하루 만회 전용 표면에 한해** 구 APK 호환을 요구하지 않으며, 폐기 예정 전용/RLS·공개범위·재독의 별도 구버전 안전 게이트는 유지한다.
4. **코드·DB 구현**: 앱·DataStore·분석의 XP·둥지·성·하루 만회 전용 표면을 제거하고, DEV migration에 백업 생성·RPC/컬럼 삭제·schema readback 검증을 포함한다. 친구 공개 확대는 별도 범위다.
5. **DEV 배포·QA**: 자동 회귀와 DEV 전용 합성 fixture로 책·문장·세션·최근 14일 리듬·누적 성장일 보존과 legacy 참조 0을 검증한다. Hyu에게는 자동 판정할 수 없는 화면·사용감만 최소 항목으로 요청한다. Production 실사용자 데이터를 fixture로 쓰지 않는다.
6. **동일 SHA Production 승격**: DEV에서 승인한 commit SHA와 migration digest만 승격한다. 환경 차이·백업·적용 migration을 기록한다.
7. **Production QA**: 실제 Production에서 읽기·문장 저장·레거시·독서 리듬과 legacy 표면 부재·rollback 경로를 직접 검증한다. CI·배포 성공만으로 완료 처리하지 않는다.
8. **Play Store**: Production QA와 네이티브 빌드 검증 뒤에만 스토어 빌드를 제출한다.

### 0.1 구 클라이언트·base RLS 컷오버 순서

책나무 제품 은퇴와 retained surface의 base RLS 축소를 한 번의 배포로 섞지 않는다. 책나무 route·flag·전용 DataStore/RPC/analytics는 제거 대상이며 신 경로로 이관하거나 Production에서 다시 켜지 않는다. 각 release는 위 1~8 게이트를 독립적으로 통과한다.

1. **호출 인벤토리**: web, OTA 가능 셸, 스토어 APK의 `users`·`user_books`·`wish_books`·`sentences`·`claps` 직접 조회와 `friends|followers` 공개범위 처리 버전을 확인한다. 책나무 전용 호출과 retained 서재·피드·프로필·활동함 호출을 구분한다.
2. **retained 신 경로 선배포**: 현재 제품에 남는 surface만 owner/current-viewer 최소 projection과 fail-closed visibility 처리를 사용하게 한다. 필요 view/RPC는 별도 승인하고 DEV QA → 동일 SHA Production QA → 필요 시 Play Store 순으로 전달한다. 책나무 전용 view/RPC는 선배포하지 않는다.
3. **수신·전환 확인**: OTA production 채널 수신율, 스토어 지원 버전 분포, retained 제한 경로와 legacy base 호출을 버전별로 관측한다. 책나무 호출은 0이어야 한다.
4. **컷오버 승인**: 구 API 실패를 허용할 최소 지원 버전, 업데이트/차단 정책, `friends|followers|unknown`의 private fail-closed 방식을 제품·운영이 승인한다. 수치와 방식은 관측 전 임의 확정하지 않는다.
5. **권한 축소**: 별도 migration release로 broad base RLS를 owner/minimum-field로 좁힌다. DEV 역할별 직접 API QA → 동일 migration·SHA Production → Production 역할별 직접 API QA를 수행한다. #1260 source grant를 넓히지 않는다.
6. **rollback**: 영향받은 retained UI·제한 경로를 비활성화하거나 승인된 최소권한 이전 정의로 되돌린다. broad base select 정책을 복원해 개인정보 노출을 되살리지 않으며, 책나무 route·flag·전용 API를 rollback 경로로 복원하지 않는다.

retained 신 경로 수신 증거와 base 권한 축소 사이에 broad 정책이 남는 기간은 정상 완료 상태가 아니다. 기간·영향·완화·종료 조건을 release 기록에 남긴다.

### 0.2 은퇴와 롤백

- 책나무 UI·route·flag·전용 DataStore/RPC·analytics 제거는 feature flag 재활성화 대상이 아니다. migration rollback이 필요해 DB object를 잠시 복원해도 execute grant와 호출 surface는 fail-closed로 유지한다.
- XP·둥지·성·하루 만회 제거도 feature flag rollback 대상이 아니다. 장애 시 신규 XP 적립을 재개하지 않으며, DB rollback이 필요하면 승인된 migration backup에서 폐기 column/RPC만 복원한다.
- 공개범위 migration은 가역적 mapping과 영향 건수, backup·복원 query, 기기 간 값 복원 기록을 갖춘 별도 승인 작업이다. 기존 값을 더 공개적인 상태로 확대하지 않는다.
- 일반 schema rollback은 하위호환을 우선하지만, 은퇴 전용 surface는 구 APK 호환을 삭제 gate로 사용하지 않는다. 앱·DB rollback 단위를 release receipt에 분리 기록한다.

### 0.3 단일 release receipt와 완료 증거

각 전달 단위는 다음 항목을 **하나의 release receipt**로 연결한다. Worker·OTA·DB·Play·QA가 서로 다른 SHA나 미확인 artifact를 가리키면 완료가 아니다.

- spec merge SHA, 구현 PR, 승인 SHA, DEV workflow/run·Worker version·`/api/release`, Production workflow/run·Worker version
- OTA beta/production version·manifest SHA·URL·checksum·`minNative`·기기 수신 결과
- DB migration 파일명·SHA-256·적용 순서·대상 환경·원격 ledger read-back·영향 건수·rollback 쿼리
- Play versionCode·AAB checksum·서명/출처·내부/Production 트랙·설치 기기 QA
- owner·friend·nonfriend·blocked·anonymous 직접 API와 UI 허용·거부 결과
- 공개 1,000자 승격은 문장 길이·공개범위·출처표기·삭제 후 비노출 회귀를 검증하되, 후순위 #1463 전용 takedown 시스템을 선행 게이트로 두지 않는다. 크롤 seed 확대·상용화·반복 권리요청이 발생하면 실제 접수 링크, 책임자, 임시 숨김→삭제→이의·기록 SOP와 전 표면 비노출 E2E를 별도 승인한다.
- XP 신규 획득 경로의 DB 값 변화 0, Production module graph·DataStore의 XP/둥지/성/만회 참조 0, DEV migration의 backup manifest·삭제 컬럼/RPC·`users_public` 권한 readback

모든 검증 항목은 `PASS | FAIL | BLOCKED | NOT_RUN` 중 하나다. skip·unknown·secret 부재·"workflow success"만으로 PASS를 만들지 않는다.

`migrations_applied.py`의 현재 범위는 table 33개·column 40개 존재 확인이며 policy·view·RPC body·grant·trigger·RLS·backfill을 검증하지 않는다. 일부 원격 조회 실패가 성공으로 오인될 수 있으므로, verifier green만으로 migration 완료를 선언하지 않는다. v17 migration은 위 객체의 정의·권한·역할별 동작과 원격 ledger를 별도 fail-closed 검증한다. 정확한 verifier 구현은 후속 코드 PR에서 승인한다.

## 1. 피처 플래그 / 킬 스위치 (#960)

위험·신규 기능을 **boolean 설정값 뒤에** 둔다. 카나리가 놓친 회귀가 100%까지 가도, **배포·롤백 없이 그 기능만 즉시 끈다.** 카나리(§2)가 "영향 범위를 쪼개는" 사전 장치라면, 플래그는 "이미 나간 걸 기능 단위로 차단하는" 사후 장치다 — 둘이 빈틈(한 번에 100% · 자동 롤백이 렌더만 봄)을 메운다.

### 1.1 위치 · 패턴 (SSOT)

- **정의처**: [`js/config.js`](../js/config.js) `RG_CONFIG.FLAGS = { <name>: <boolean>, ... }`. 클라 공개 안전(민감정보 아님 — 키·시크릿 금지).
- **조회**: `window.RG_flag(name)` — 단순·안전 조회. **미정의/오타/`FLAGS` 부재 → `false`**(기능 미노출이 안전 기본값). 피처 코드는 이 헬퍼만 쓴다(`RG_CONFIG.FLAGS` 직접 접근 금지 — 안전 폴백 우회 방지).
- **토글 방법(Phase 0)**: `config.js` 변경도 일반 PR·CI를 거쳐 `main`에 머지하고 stable DEV에서 검증한다. Production 반영은 검증된 동일 SHA를 `promote-production.yml`로 수동 승격한다. 작은 config diff도 로컬 직접 배포나 Production gate 우회 사유가 아니다.

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

### 2.1 prod 카나리 — 비활성 제안 (#901)

[Cloudflare Workers gradual deployment](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/)은 일부 트래픽에 새 버전을 먼저 보내는 보조 안전망 후보다. 현재 저장소에는 승인 SHA·stable DEV receipt·GitHub `production` environment를 유지하면서 비율 배포하는 audited workflow가 없으므로 **활성 운영 절차가 아니다**. 대시보드나 로컬 `wrangler` 명령으로 ad-hoc Production 업로드·분할·100% 승격을 수행하지 않는다.

### 2.2 활성화 선행조건

1. `promote-production.yml`과 같은 SHA·stable DEV·`production` 승인 게이트를 보존하는 별도 workflow를 PR로 추가한다.
2. version ID와 source SHA의 대응, 트래픽 비율, 관측 시간, E2E, rollback SHA를 감사 가능한 receipt로 남긴다.
3. DEV·Production credential 및 Worker 이름 분리를 정적·실행 테스트로 검증한다.
4. 위 workflow와 runbook이 승인·머지되기 전에는 현재의 동일 SHA 수동 100% 승격 계약을 사용한다.

### 2.3 롤백

- Production 회귀는 직전 정상 변경을 되돌리는 revert PR을 CI 후 `main`에 머지하고, 새 HEAD의 stable DEV receipt·E2E를 확인한 뒤 그 동일 SHA를 `promote-production.yml`로 승격한다. 현재 workflow는 과거 SHA 직접 재승격을 거부한다. 로컬 checkout이나 dashboard 수동 배포로 되돌리지 않는다.
- 기능 플래그 off도 일반 PR·CI→stable DEV 검증→동일 SHA Production 승격 순서를 따른다.
- 친구 공개 5-A의 보안 rollback은 broad base RLS 복원이 아니라 신규 클라이언트 pause·제한 API 유지·원인 수정이다.

### 2.4 version affinity — 향후 검토 (#901)

비율 배포 workflow를 실제 도입할 때 한 세션이 요청마다 다른 버전에 붙지 않도록 version affinity 필요성을 검토한다. 현재 운영 계약에는 포함하지 않는다.

## 3. 격리 불변조건

- dev bundle에 prod Supabase/Worker endpoint가 없어야 한다.
- dev Worker에 prod KV/R2 ID, production secret, cron이 없어야 한다.
- production 관련 workflow는 `main` push로 실행되면 안 되며 `production` environment 승인을 요구한다.
- 이 중 하나라도 증명할 수 없으면 prod 승격을 중단하고 rollback이 아니라 pause/report한다.

## 4. Android 셸·OTA 출시 보안 계약 (#1398)

### 4.1 Android 셸

- 인증·독서 데이터는 Android cloud backup과 device transfer에서 모두 제외한다. `allowBackup=false`와 API 31+ `dataExtractionRules`를 함께 유지하며 root·file·database·sharedpref·external domain을 전부 제외한다.
- `FileProvider`는 공유가 필요한 앱 cache의 `shared-images/` 하위만 노출한다. 외부 저장소·files·cache 루트(`path="."`)는 공유하지 않는다.
- release build는 R8 minification과 resource shrinking을 활성화하고 `proguard-android-optimize.txt`를 사용한다. barcode AAR처럼 전이 runtime dependency가 누락된 경우 경고 억제로 숨기지 않고 upstream metadata와 맞는 dependency를 명시하며 `lintRelease`와 `assembleRelease`를 통과해야 한다.
- native OAuth callback은 [backend.md §7.1](./backend.md)의 빌드별 exact scheme·host/path 계약을 사용한다. development APK는 `com.readinggo.app.dev`, Production APK는 `com.readinggo.app`으로 분리한다.

### 4.2 OTA artifact·승격

- privileged OTA CLI는 exact semantic version으로 고정한다. `latest` 또는 floating major를 release·promote workflow에서 사용하지 않는다.
- beta bundle은 private key로 암호화한 파일만 업로드한다. 평문 zip은 암호화 직후 삭제하며 manifest는 `version`, encrypted `url`, encrypted `checksum`, `sessionKey`, `minNative`, source `sha`, UTC `date`를 포함한다.
- Android release 셸은 대응 public key가 없으면 build를 중단한다. public key는 secret이 아니지만, key 없는 셸이나 plaintext OTA를 fallback으로 만들지 않는다.
- beta→Production 승격은 동일 manifest SHA와 필수 암호화 field를 검증하고 `ota-production` environment의 required reviewers와 prevent self-review를 통과해야 한다. workflow 이름만으로 2인 승인이 증명되지 않으므로 repository environment 설정을 readback하기 전에는 운영 게이트 완료로 보지 않는다.
- OTA key 생성·회전, `ota-production` reviewer 설정, 실제 beta 기기 복호화·checksum·`minNative` 수신 검증, Production 승격은 코드 PR과 분리된 운영 승인 대상이다. secret이나 private key를 로그·artifact·manifest·PR에 남기지 않는다.
- release receipt는 Android versionCode·AAB checksum·내장 public key fingerprint, Capgo CLI version, encrypted bundle checksum·sessionKey 존재, beta/Production manifest SHA, 승인자, 기기 수신 결과를 연결한다.
