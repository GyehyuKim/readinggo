# ReadingGo 시드 수집기 (Seed Collector) — 큐 폴링 방식

마중물 시드(#774)의 **예스24 "책 속으로"** 크롤러. 맥미니에 상시 가동하는 Node + Playwright(헤드리스 크롬) **폴링 데몬**이다.

> **큐 기반 비동기 온디맨드**: 워커는 책을 `seed_queue`에 넣기만 하고(인바운드 없음), collector가 큐를 폴링해 크롤·적재한다. Cloudflare Tunnel·공개 노출·토큰 **불필요** — collector는 Supabase로 **아웃바운드 폴링만** 한다.
>
> 단일 진실(SSOT): [`docs/readinggo/specs/seed-collector.md`](../docs/readinggo/specs/seed-collector.md).

```
앱 ──/api/seed──▶ 워커 ──byBook 있으면 즉시 반환
                  └ 없으면 seed_queue upsert(high) + [] 반환("모으는 중")
collector(맥미니 상시) ──seed_queue 폴링(priority desc)──▶ 예스24 크롤
                  └ book_id 해석(auto-upsert) → 발췌마다 다른 NPC 명의 sentences 적재
                  └ seed_sentences 원장 기록(출처·중복판정·takedown) → status='done'
앱 ──byBook 폴링──▶ NPC 아바타와 함께 "같은 책 읽는 사람들"에 노출
```

## 구성

| 파일 | 역할 |
|---|---|
| `poller.mjs` | **메인 데몬**. `seed_queue` 폴링 → 크롤 → 적재 → 상태전이. 브라우저 1개 순차 |
| `prewarm.mjs` | 배치(spec §3.2) — 인기 카탈로그책을 `seed_queue`에 low 우선순위로 큐잉(크롤은 poller가) |
| `crawl-once.mjs` | 단발 크롤 검증 도구(DB 적재 없이 파이프라인만) |
| `lib/queue.mjs` | `seed_queue` 픽업/상태전이/큐잉 |
| `lib/npc.mjs` | 발췌 → **여러 NPC 명의** `sentences` 적재(book_id auto-upsert, distinct NPC, kind='quote') + 원장 |
| `lib/yes24.mjs` | 예스24 검색·매칭·발췌 추출 |
| `lib/browser.mjs` | 헤드리스 크롬 관리 + 봇 탐지 완화 + 홈 워밍업 |
| `lib/db.mjs` | `seed_sentences` 원장 + 인기책 조회(service role) |
| `launchd/*.plist` | 데몬(poller)·배치(prewarm) launchd 템플릿 |

## 1. 설치 (맥미니)

```bash
cd collector
npm install          # playwright + chromium 자동 설치
```

## 2. 환경변수

`collector/.env.example` → `collector/.env`. **랩탑 `.env` 값을 AirDrop/scp 로 옮긴다(평문 메일 금지).**

```bash
cp .env.example .env
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (필수 — 큐 폴링·적재)
# SUPABASE_ACCESS_TOKEN (선택 — 마이그레이션 적용용 PAT)
```

`.env` 는 루트 `.gitignore` 가 차단 — 절대 커밋 금지. **토큰·Tunnel 불필요**(인바운드 없음).

## 3. DB 마이그레이션 적용 (1회)

`seed_queue` 테이블 생성(CONTRIBUTING §8.5 — 수동):

```bash
# 대시보드 SQL Editor 에 docs/readinggo/supabase/31_seed_queue.sql 붙여넣기 Run
# 또는 PAT 있으면:
node ../docs/readinggo/supabase/admin-cli.mjs sql 31_seed_queue.sql
```

## 4. 동작 확인

```bash
# 파이프라인만(DB 적재 없음)
node crawl-once.mjs "모순" "양귀자" "9788998441012"

# 폴러 가동(큐 소진). 큐가 비어있으면 5초마다 폴링.
npm start
# 인기책 배치 큐잉(low) — 한가할 때 채워짐
npm run prewarm 150
```

큐에 책을 넣는 건 보통 워커(/api/seed)다. 수동 큐잉은 `lib/queue.mjs`의 `enqueue()` 사용.

## 5. launchd (상시 가동 + 새벽 배치)

```bash
mkdir -p logs ~/Library/LaunchAgents
NODE=$(which node); DIR=$(pwd)
for f in collector collector-prewarm; do
  sed -e "s#__NODE__#$NODE#g" -e "s#__COLLECTOR_DIR__#$DIR#g" \
    launchd/com.readinggo.$f.plist > ~/Library/LaunchAgents/com.readinggo.$f.plist
  launchctl load -w ~/Library/LaunchAgents/com.readinggo.$f.plist
done
launchctl list | grep readinggo
```

- `com.readinggo.collector` — **poller** 상시(KeepAlive, 부팅 시 시작).
- `com.readinggo.collector-prewarm` — 매일 04:00 인기책 큐잉.
- 로그: `collector/logs/*.log`.

## 6. 적재 규칙 / 예의 / 저작권

- **멀티NPC**: 발췌마다 서로 다른 NPC 명의로 `sentences`(kind='quote') 적재 → byBook 피드에 아바타와 노출. `page=null`(스포일러 블라인드 없음).
- **멱등**: 이 책에 이미 있는 문장 텍스트는 건너뜀(재폴링·재크롤 누적 0).
- **off-catalog**: 카탈로그에 없는 책은 `books`에 auto-upsert 후 적재.
- 예의(spec §7): 책 사이 딜레이 2~3초, 동시성 1, 식별 UA, 차단(홈 리다이렉트) 시 워밍업 재시도+백오프.
- 저작권(spec §8): 책당 ≤6, 비영리·교육/데모, `seed_sentences` 원장으로 권리자 요청 시 일괄 삭제. 상용화 전 재검토.
  - ⚠️ NPC 명의 표시라 피드에 출처 링크는 노출되지 않음(원장에만 보존). 상용화 전 출처 표기 방식 재검토 필요.
