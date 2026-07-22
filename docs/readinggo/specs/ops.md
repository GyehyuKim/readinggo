# 운영: 배포 안전 (피처 플래그 · 카나리)

> **신설 (2026-06-24, #960·#901)** — 배포안전 에픽([#897](https://github.com/), decisions.md §8.13)의 P3 구현 스펙.
> 런칭 후 개발 중 **'머지 = 즉시 100% 프로덕션'** 사고를 줄이는 두 장치를 정의한다: **피처 플래그/킬 스위치**(#960)와 **카나리(점진 배포)**(#901).
> **2026-07-22 #1303 갱신**: [decisions.md §8.16](./meta/decisions.md)이 §8.13의 별도 환경 기각을 supersede한다.
> 카나리·플래그는 prod 내부 안전망으로 남고, 기본 릴리스 경로는 별도 dev 검증 → 동일 SHA prod 승격이다.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-first(코드 PR 동반 시 사유 PR 본문).

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

### 2.1 개념

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
