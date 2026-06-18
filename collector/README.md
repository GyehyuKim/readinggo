# ReadingGo 시드 수집기 (Seed Collector)

마중물 시드(#774)의 **예스24 "책 속으로"** 크롤러. 맥미니에 상시 가동하는 Node + Playwright(헤드리스 크롬) 데몬이다.
워커는 브라우저를 못 돌리므로(Cloudflare) 헤드리스 크롤을 이 데몬으로 이관한다.

> **단일 진실(SSOT)**: 설계·정책은 [`docs/readinggo/specs/seed-collector.md`](../docs/readinggo/specs/seed-collector.md). 막히면 spec 을 다시 읽어라.

```
앱 ──/api/seed──▶ 워커 ──stored 없으면 /collect──▶ collector(맥미니) ──예스24 크롤──▶ seed_sentences
                   └ stored 있으면 즉시 반환(영속)        └ 토큰 검증·큐(직렬)·적재(service role)
```

## 구성

| 파일 | 역할 |
|---|---|
| `server.mjs` | HTTP 데몬. `POST /collect`(토큰), `GET /health`. 브라우저 1개 직렬 큐(spec §5) |
| `prewarm.mjs` | 주기 배치(spec §3.2) — 인기책 선충전 + TTL(#806) 재크롤 |
| `crawl-once.mjs` | 단발 크롤 검증 도구(DB 적재 없이 파이프라인만, 시크릿 불필요) |
| `lib/browser.mjs` | 헤드리스 크롬 관리 + 봇 탐지 완화 + 홈 워밍업 |
| `lib/yes24.mjs` | 예스24 검색·매칭·발췌 추출(spec §4) |
| `lib/db.mjs` | `seed_sentences` 적재/조회(service role, 워커와 동일 계약) |
| `lib/collect.mjs` | 수집 오케스트레이션(stored 가드 → 크롤 → 적재) |
| `launchd/*.plist` | 데몬·배치 launchd 등록 템플릿 |

## 1. 설치 (맥미니)

```bash
cd collector
npm install          # playwright + chromium 자동 설치(postinstall)
```

## 2. 환경변수

`collector/.env.example` 를 복사해 `collector/.env` 작성. **랩탑 repo `.env` 값을 AirDrop/scp 로 옮긴다(평문 메일 금지).**

```bash
cp .env.example .env
# 편집: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (랩탑에서 복사)
#       COLLECTOR_TOKEN  (새로 생성: openssl rand -hex 32)
```

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — `seed_sentences` 직접 적재(본인 신뢰 기기).
- `COLLECTOR_TOKEN` — 워커↔collector 인증. **같은 값을 워커 secret 으로도 등록**(아래 5단계).
- `.env` 는 루트 `.gitignore` 가 차단 — 절대 커밋 금지.

## 3. 동작 확인 (시크릿 불필요)

```bash
# 파이프라인만(DB 적재 없음) — 진짜 책 인용이 나오는지
node crawl-once.mjs "모순" "양귀자" "9788998441012"
#  → ✓ 6 excerpts: "아버지의 삶은 아버지의 것이고…" 등

# 데몬 기동 + 헬스
npm start &
curl -s localhost:8787/health        # {"ok":true,...}
curl -s -X POST localhost:8787/collect \
  -H "Authorization: Bearer $(grep COLLECTOR_TOKEN .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"title":"모순","author":"양귀자","isbn":"9788998441012"}'
```

`.env` 에 Supabase 키가 있으면 `/collect` 가 `seed_sentences` 에도 적재한다(`GET /health` 의 `configured:true`).
소량(10~20권) 적재 후 Supabase `seed_sentences` 를 조회해 품질을 확인하라.

## 4. Cloudflare Tunnel (고정 URL 노출)

맥미니 로컬 데몬(127.0.0.1:8787)을 `https://collector.<도메인>` 으로 공개한다(포트포워딩 불필요). 워커만 토큰으로 호출.

```bash
brew install cloudflared
cloudflared tunnel login                              # 브라우저 로그인(대화형)
cloudflared tunnel create readinggo-collector
cloudflared tunnel route dns readinggo-collector collector.<도메인>

# ~/.cloudflared/config.yml 예:
#   tunnel: <TUNNEL_ID>
#   credentials-file: /Users/<you>/.cloudflared/<TUNNEL_ID>.json
#   ingress:
#     - hostname: collector.<도메인>
#       service: http://127.0.0.1:8787
#     - service: http_status:404

cloudflared tunnel run readinggo-collector            # 상시: launchd 로 등록 권장
# (또는)  sudo cloudflared service install
```

> `cloudflared tunnel login` 등은 **대화형 로그인**이라 직접 실행해야 한다. 이 세션에서 돌리려면 프롬프트에 `! cloudflared tunnel login` 처럼 입력하면 출력이 대화에 들어온다.

## 5. 워커 secret 등록

워커가 collector 를 호출하도록(코드는 `gyehyu/seed-collector-worker` PR):

```bash
npx wrangler secret put COLLECTOR_URL      # 예: https://collector.<도메인>
npx wrangler secret put COLLECTOR_TOKEN    # collector/.env 와 동일 값
npx wrangler deploy
```

워커는 `seed_sentences` 에 stored 가 없을 때만 `/collect` 를 호출하고(동기, ~12s 타임아웃),
실패·타임아웃·미커버 시 블로그(#819) 폴백 또는 빈 반환한다(spec §3.1·§9).

## 6. launchd (상시 가동 + 새벽 배치)

```bash
mkdir -p logs ~/Library/LaunchAgents
# 템플릿의 __NODE__ / __COLLECTOR_DIR__ 치환 후 설치:
NODE=$(which node); DIR=$(pwd)
for f in collector collector-prewarm; do
  sed -e "s#__NODE__#$NODE#g" -e "s#__COLLECTOR_DIR__#$DIR#g" \
    launchd/com.readinggo.$f.plist > ~/Library/LaunchAgents/com.readinggo.$f.plist
  launchctl load -w ~/Library/LaunchAgents/com.readinggo.$f.plist
done
launchctl list | grep readinggo
```

- `com.readinggo.collector` — 데몬 상시(KeepAlive, 부팅 시 시작).
- `com.readinggo.collector-prewarm` — 매일 04:00 인기책 선충전 + TTL 재크롤.
- 로그: `collector/logs/*.log`.

## 7. 예의 / 차단 대응 (spec §7)

- 요청 간 딜레이 2~3초, **동시성 1**(브라우저 1개 직렬 큐).
- 식별 가능한 UA, robots best-effort. 새벽 소량 배치.
- 차단 감지: 검색이 홈으로 리다이렉트되면 재워밍업 1회 재시도 → 실패 시 `status:'blocked'` 로그 + 백오프.

## 8. 저작권 / 약관 가드 (spec §8)

- 출처 표기(예스24/출판사 + 링크), **책당 인용 ≤6**, 비영리·교육/데모 한정.
- 권리자 요청 시 즉시 삭제(`seed_sentences` 에서 SQL/콘솔 삭제). robots/약관 best-effort.
- **정식 상용화 전 재검토**(spec 에 못박음).
