# 배포 런북 — DEV 검증·동일 SHA 승격·rollback (#1303)

활성 SSOT는 [decisions.md §8.16](./specs/meta/decisions.md)과 [ops.md §2](./specs/ops.md)다.
기존 “main → production 자동배포” 절차는 superseded다. prod는 기존 ReadingGo를 보존한다.

## 1. 정상 흐름

1. PR: `preview-smoke`가 `wrangler.dev.toml`로 `readinggo-dev` version preview를 만들고 edge smoke를 수행한다.
2. merge: `deploy-dev`가 그 `main` SHA를 stable DEV에 배포하고 `/api/release`의 environment·SHA·Supabase host를 검증한다.
3. Hermes: 이슈·diff·CI·stable DEV smoke·미해결 대화를 검토한다.
4. prod: `promote-production`을 승인 SHA로 수동 실행한다. GitHub `production` environment 승인 뒤,
   `origin/main` HEAD와 stable DEV receipt가 모두 같은 SHA일 때만 기존 `readinggo`에 배포한다.
5. OTA가 필요하면 같은 SHA로 `ota-release`를 별도 수동 실행한다. beta→production은 기존 `ota-promote` gate를 따른다.

## 2. DEV 구성·비밀 경계

- Supabase project ref는 `supabase projects list` 인증 결과에서만 구한다. 저장소에 고정하지 않는다.
- DB password는 macOS Keychain service `supabase-db-password-readinggo-dev`, account `ReadingGo Dev`에서 읽고 출력하지 않는다.
- GitHub DEV secrets: `DEV_SUPABASE_URL`, `DEV_SUPABASE_PUBLISHABLE_KEY`.
- Worker DEV secret: `SUPABASE_SERVICE_ROLE_KEY`를 `readinggo-dev`에만 등록한다.
- DEV에는 prod 사용자 복사, prod KV/R2 binding, prod secret, cron, 문의 동기화, OTA publish를 연결하지 않는다.

## 3. 검증 receipt

```bash
curl -fsS https://readinggo-dev.hyuniverse.workers.dev/api/release
```

응답의 `environment=development`, 승인 SHA, DEV Supabase hostname만 기록한다. credential은 기록하지 않는다.
`tests/dev-isolation.test.mjs`는 DEV bundle의 prod endpoint 부재와 dev config의 prod KV/R2/cron 부재를 검사한다.

## 4. rollback·중단

- DEV 회귀: Cloudflare `readinggo-dev`의 직전 정상 version을 100% 재배포한다. prod는 건드리지 않는다.
- prod 승격 전 실패: **중단·보고**한다. stable DEV receipt를 새로 만들기 전 prod workflow를 재실행하지 않는다.
- prod 승격 후 회귀: GitHub `production` environment에서 직전 정상 prod SHA를 `promote-production`으로 재승격한다.
  자동 rollback이나 DEV credential로 prod를 조작하지 않는다.
- Cloudflare Workers Builds에 남은 `main → readinggo` 자동 연결은 제거돼야 한다. 이 계정 설정이 확인되기 전에는
  #1303을 완료 처리하거나 `Closes #1303`을 쓰지 않는다.

## 5. 감사 증거

PR URL/commit SHA, DEV project region/status, DEV Worker URL/version, DEV KV ID, migration 개수,
schema/RLS 검사 결과, preview/stable smoke run URL, production environment 승인 기록을 한 release receipt로 보존한다.
