# Cloudflare 이전 가이드 (Netlify → Workers)

> Netlify 무료 크레딧 소진 → Cloudflare Workers(무료, 크레딧 개념 없음)로 이전.
> **하나의 Worker**가 정적 사이트 + `/aladin` 프록시 + 일일 아카이브 cron을 모두 처리.

## 구성
- `wrangler.toml` — Worker 설정(assets=docs/readinggo, cron, SUPABASE_URL vars)
- `worker/index.mjs` — fetch(정적+/aladin) + scheduled(아카이브)
- 클라(`config.js`)의 `ALADIN_PROXY='/.netlify/functions/aladin'`는 **그대로 둬도 동작** (Worker가 이 경로를 별칭으로 처리)

## 계휴가 할 일 (1회)
1. **로그인**: `npx wrangler login` (브라우저 인증) — 또는 대시보드에서 GitHub repo 연결(Workers Builds, build command `npx wrangler deploy`)
2. **시크릿 등록** (service_role 만 비밀):
   ```
   npx wrangler secret put ALADIN_TTB_KEY
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
   (값은 로컬 `.env`에 있음. `SUPABASE_URL`은 wrangler.toml에 이미 공개값으로 둠)
3. **배포**: `npx wrangler deploy`
4. **확인**:
   - `https://readinggo.<계정>.workers.dev/` → 사이트 뜸
   - `…/aladin?query=데미안` → `{items:[…]}`
   - Cron: 대시보드 Worker → Triggers 에 `0 18 * * *` 보임 (매일 KST 03:00 아카이브)

## 전환/정리
- 동작 확인되면 커스텀 도메인 연결(선택) + Netlify 사이트는 보존/폐기 결정.
- Supabase **Auth redirect URL**에 새 workers.dev(또는 커스텀 도메인) 추가 필요(로그인 리다이렉트).
- GitHub Actions의 Netlify deploy job은 추후 제거/대체(#198 후속).

## 미검증 주의
- 헤드리스로 Cloudflare 배포를 못 돌려 **`worker/index.mjs`·`wrangler.toml`은 계약 기준 작성**. 첫 `wrangler deploy` 출력으로 검증/이터레이션.
