# 시드 수집기 (Seed Collector) — 온디맨드 책 인용 크롤러 스펙

> **신설 (#774 후속, 2026-06-18)**: 마중물 시드의 소스를 **출판사 발췌(예스24 "책 속으로")**로 확정하고, 그 수집을 담당하는 **상시 크롤러 서비스(맥미니)** 를 정의한다.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 준수. 구현(맥미니)은 후속 코드 PR.
> **선행 결정**: 시드 컨셉 = 독자가 옮긴 "책 원문 인용"(블로거 감상·소개 아님). [integrated-shelf.md §5.2](./integrated-shelf.md) 컨셉 교정 참조.

## 1. 배경 / 문제

마중물 시드(#774)는 "책 본문 인용"이어야 한다. 그런데 **공개·유료 API 전부 본문을 안 준다**(2026-06-18 조사 완료):

| 소스 | 본문 인용 | 비고 |
|---|---|---|
| 알라딘 TTB · 네이버 책 · 카카오 책 | ❌ | 서지·소개글(`contents`=출판사 소개)만 |
| 구글 Books `textSnippet` | ❌ | 한국 책 대부분 `NO_PAGES`(미리보기 없음) |
| 도서관 정보나루·국중도·문화공공데이터 | ❌ | 서지 메타데이터만 |
| 글로벌 인용 API(They Said So 등) | ❌ | 영어 전용 |
| 전자책(리디·밀리) 본문 | ❌ | 자사 앱 라이선스 전용(저작권) |

**유일한 양질 본문 = 출판사 발췌(예스24 "책 속으로", 교보 "책 속으로")**. 출판사가 홍보용으로 등록한 진짜 책 문장이라 **글쓴이 생각 혼입 0**. 단 이 섹션은 **JavaScript로 렌더**돼서 단순 `fetch`(HTTP)로는 못 받고 **실제 브라우저**가 필요하다.

→ Cloudflare 워커는 브라우저를 못 돌리므로, **상시 가동 머신(맥미니)에 헤드리스 브라우저 크롤러**를 둔다.

> **PoC 검증 (2026-06-18)**: 헤드리스 크롬으로 예스24 모순 상품페이지 "책 속으로"에서 진짜 책 인용 6개 추출 확인("아버지의 삶은 아버지의 것이고 어머니의 삶은 어머니의 것이다…" 등). 블로그(책당 1개)와 비교 불가한 품질·수율.

## 2. 아키텍처 (큐 폴링 + 멀티NPC)

> **2026-06-19 개정**: 동기 호출·Cloudflare Tunnel 방식을 **큐 폴링**으로 단순화하고, 시드를 **여러 NPC 명의의 `sentences`**(byBook 피드)로 적재하도록 변경. 인바운드·터널·토큰 불필요(collector는 Supabase로 아웃바운드 폴링만).

```
┌─ 맥미니 (collector poller, 상시) ───────┐      ┌─ Cloudflare 워커 ─┐        ┌─ 앱 ─┐
│ Node + 헤드리스 브라우저(인바운드 0)     │      │ /api/seed          │◀─조회─ │ 책 열기│
│  seed_queue 폴링(priority desc)         │─폴링→│  byBook 있으면 []   │        │       │
│  → 예스24 검색·책속으로 크롤            │ seed │  없으면 seed_queue   │ ─[]→   │ "모으는│
│  → book_id 해석(auto-upsert)           │_queue│  upsert(high) + []  │        │  중…" │
│  → 여러 NPC 명의 sentences 적재         │◀─────│                     │        │ +폴링 │
│  → seed_sentences 원장 + status='done' │      └────────────────────┘        └───┬───┘
│ launchd: poller 상시 + 새벽 prewarm     │           byBook(sentences) 직접 조회 ──┘
└─────────────────────────────────────────┘
```

- **collector(맥미니)** = `seed_queue`를 폴링하는 크롤러. 헤드리스 브라우저, **인바운드 없음**(Supabase로 아웃바운드만).
- **워커** = `/api/seed`로 큐잉 트리거(동기 대기 안 함). 브라우저 없음.
- **`seed_queue`** = 작업 큐(pending→done). **`sentences`** = 표시(여러 NPC 명의, byBook 피드). **`seed_sentences`** = 출처·중복판정·takedown 원장.
- 시드는 영속이라 **collector가 잠깐 죽어도 서비스는 멈추지 않고 큐 적체만 생긴다**(안전).
- **Cloudflare Tunnel·공개 노출·토큰 불필요** — 이전 동기 방식 대비 핵심 단순화.

## 3. 동작 흐름

### 3.1 큐 기반 비동기 온디맨드 (핵심 요구)

사용자가 **빈 책을 열면 큐잉하고, 둘러보는 동안 채워 노출한다**(동기 대기·화면 멈춤 없음).

1. 앱 → 워커 `POST /api/seed {title, author, isbn, have}`
2. 워커: 공개 문장이 이미 있으면(byBook>0) 큐잉 불필요. 없으면 → `seed_queue` upsert(`priority='high'`, book_key 중복 무시) → **빈 배열 반환**("모으는 중").
3. collector(맥미니)가 `seed_queue` 폴링(priority desc, 5초 간격) → pending 책 픽업.
4. collector: 예스24 검색 → "책 속으로" 크롤 → `book_id` 해석(없으면 `books` auto-upsert) → 발췌마다 **서로 다른 NPC 명의**로 `sentences`(kind='quote') 적재 + `seed_sentences` 원장 기록 → `status='done'`.
5. 앱: 시드 0건이면 "🌱 이웃의 문장을 모으는 중…" placeholder + **byBook 짧은 폴링**(예 4초 × ~5회) → 채워지면 "이 책의 한 문장"에 이웃 아바타와 함께 노출.
6. **실패**: not-found·no-excerpt(예스24 미커버)는 `status='failed'`(재시도 무의미). blocked·timeout은 attempts++ 후 재시도(≤3). 앱은 폴링 종료 시 placeholder 정리.

> **UX 결정**: 동기 대기 폐기 — 큐잉 즉시 반환 + 폴링. 첫 크롤은 ~15~25초(헤드리스 브라우저)라 인기책 prewarm으로 즉시감을 얻고, 나머지는 폴링으로 흡수.

### 3.2 누가 떠 보이나 (멀티NPC 귀속)

- 크롤한 "책 속으로" 발췌(출판사 발췌)는 **여러 NPC**(졸린토끼·밤샘올빼미 … `is_npc=true`) 명의로 `sentences`에 분산 적재 → "같은 책 읽는 사람들"에 다양한 이웃으로 노출.
- `kind='quote'`(인용)라 **"독자가 옮긴 책 문장"**으로 정직(NPC가 원작자인 척 아님). `page=null`(스포일러 블라인드 없음).
- 발췌마다 distinct NPC 배정. 멱등: 그 책에 이미 있는 문장 텍스트는 건너뜀(재폴링·재크롤 누적 0).
- 출처(예스24/상품 URL)는 `seed_sentences` 원장에만 보존(피드엔 NPC 명의로 노출 — §8 가드 참조).

### 3.3 주기 배치 (보조)

- 맥미니 `launchd`이 **매일 새벽 인기 카탈로그책을 `seed_queue`에 `priority='low'`로 큐잉**(워커 cron도 동일). 실제 크롤은 poller가 high(온디맨드) 처리 후 한가할 때 소진.
- 인기책은 첫 유저 도착 전에 미리 채워 즉시감 확보. **느긋하게**: 책 사이 딜레이 2~3초, 동시성 1.

## 4. 크롤 파이프라인 (PoC 검증됨)

입력 `{title, author, isbn}` → 출력 `[{text, sourceName, sourceUrl}]`:

1. **검색**: `https://www.yes24.com/Product/Search?domain=BOOK&query={제목 저자}` 를 **브라우저로** 열고 결과(`.gd_name`) 대기(JS 렌더).
2. **상품 매칭**: 검색 결과 앵커 `.gd_name` 에서 `/product/goods/{id}` 추출. 첫 결과 우선, **ISBN13 대조**(상품페이지 ISBN 일치 확인)로 정확 매칭. 동명이서·다른 판본 방지.
3. **발췌 추출**: 상품페이지를 **스크롤(lazy-load)** 한 뒤 `innerText`의 **"책 속으로"** 섹션 파싱. 발췌 구분자는 책마다 다르므로(`* ` 또는 `--- p.NN 「장」 중에서` 인용줄) **줄 단위 + 출처/인용 줄 제거**로 통일.
4. **정제**: 각 발췌를 시드로. 길이 필터(권장 15~400자), 공백 정규화. 예스24 발췌는 깔끔해 LLM 정제 불필요(블로그와 달리 꼬리표·군더더기 없음).
5. **적재**: `seed_sentences` insert(service role, `book_key`). `sourceName`='예스24 책속으로'(또는 출판사명), `sourceUrl`=상품 URL.

> **검증된 셀렉터·패턴 (2026-06-18, 구현 시 라이브 재확인하여 갱신)**: 검색은 `domain=BOOK` 사용 — 초안의 `domain=ALL` 은 현재 홈(`/Main/default.aspx`)으로 **리다이렉트**되어 못 씀. 검색 결과 링크는 프로모/추천 슬롯과 섞이므로 실제 결과 앵커 셀렉터 **`.gd_name`** 으로 한정(`a[href^="/product/goods/"]` 단독은 광고 슬롯을 잡음). "책 속으로"는 **스크롤 후** 렌더되며 구분자는 책마다 다름(`* ` / `--- … 중에서`). 의심 트래픽은 홈으로 소프트 리다이렉트되므로 **홈 워밍업(세션 쿠키)+봇탐지 완화** 필요. 모순·사피엔스·데미안·불편한편의점 발췌 확인.

## 5. collector 서비스 사양 (맥미니 구현)

- **런타임**: Node.js + 헤드리스 브라우저(Playwright). 인바운드 HTTP 없음 — `seed_queue` 폴링 데몬(`poller.mjs`).
- **폴링**: `seed_queue?status=pending&order=priority.desc,created_at.asc&limit=3`, 5초 간격. high(온디맨드) 먼저.
- **직렬화**: 브라우저 1개로 순차 처리(동시 크롤 금지 — 차단·자원). 책 사이 딜레이 2~3초.

> ✅ **정합됨 (2026-07-09)**: `collector/poller.mjs` 기본 `POLL_BATCH=1`(순차)로 낮춤 + 배포본(.env) 도 1로 재시작. 이전 병렬(2~4)에서 관측된 `browserContext.newPage: ...has been closed`(브라우저 컨텍스트 경합) 제거 + spec 동시성-1 안티차단 의도와 일치. (2주 라이브에서 예스24 차단 0건이었으나, 컨텍스트 경합 에러가 있어 순차로 안정화.)
- **적재**: 발췌 → `book_id` 해석(없으면 `books` auto-upsert) → distinct NPC 명의 `sentences`(kind='quote') + `seed_sentences` 원장. 멱등(그 책 기존 문장 텍스트 제외).
- **상태전이**: ok→`done`. not-found/no-excerpt→`failed`(영구). blocked/timeout→attempts++ 후 재시도(≤3).

## 6. 노출 / 연결 보안 (단순화)

- **인바운드·공개 노출·Cloudflare Tunnel 불필요.** collector는 Supabase로 **아웃바운드 폴링만** 한다(맥미니 NAT 뒤에서 그대로 동작).
- **토큰 불필요**: 워커는 `seed_queue`에 쓰기만, collector는 읽고 처리만 — 둘 다 service role로 Supabase 접근. 워커↔collector 직접 통신 없음.
- **service role key**: 맥미니 로컬 `collector/.env`. 본인 신뢰 기기. `seed_queue` RLS는 정책 없음(service role 전용).

## 7. 예의 / 레이트리밋 / 차단 대응

- 요청 간 **딜레이 2~3초**, 동시성 1. (✅ 정합됨 2026-07-09 — `poller.mjs` 기본 `POLL_BATCH=1`, §5 노트 참조.)
- robots/약관 best-effort 존중, 식별 가능한 UA.
- **차단 감지**: 수율 급락·캡차·403 → 백오프 + 로그/알림. DOM 변경 시 셀렉터 보정 신호.
- 주기 배치는 트래픽 적은 새벽, 소량씩.

## 8. 저작권 / 약관 (integrated-shelf §5.2 연계)

"책 속으로"는 **출판사가 홍보용으로 공개한 발췌**다. 가드:

- **인용 범위 최소**(책당 ≤6, 전문 전재 금지), **비영리·교육/데모**, **권리자 요청 시 즉시 삭제**(`seed_sentences` 원장으로 book_key·text 일괄 삭제 → 연결 `sentences`도 정리), robots/약관 best-effort.
- **⚠️ 멀티NPC 귀속의 정직성 한계**: 발췌가 NPC 명의로 뜨므로 **피드에 출처 링크가 노출되지 않는다**(원장에만 보존). `kind='quote'`로 "독자가 옮긴 인용"임은 드러나나, **상용화 전 출처 표기 방식 재검토 필수**.
- **정식 상용화 전 재검토**(이 spec에 못박음). 스크래핑은 약관 회색지대 — 베타·비영리 한정.

## 9. 폴백 / 기존과의 관계

- **#819 블로그 인용**: 큐+예스24로 전환하며 워커에서 **비활성화**(함수는 잠재 폴백 대비 잔존, 호출 없음). 컨셉상 블로그는 품질 낮아 메인은 큐잉.
- **`seed_sentences`**: 표시 SSOT에서 **원장(출처·중복판정·takedown)으로 역할 변경**. 표시는 `sentences`(NPC 명의, byBook).
- **기존 데이터**: 구 블로그 시드(~400건)는 `seed_sentences` 원장에 잔존하나 표시엔 안 쓰임. 인기책부터 큐로 NPC 문장 점진 충전(#806 TTL은 추후).

## 10. 모니터링

- 크롤 성공/실패/수율(책당 발췌 수)·차단 이벤트 로그.
- 수율 급락 = DOM 변경/차단 알림. 커버리지(예스24 책속으로 있는 책 비율) 추적.

## 11. 결정 필요 / 오픈 이슈

- ~~동기 대기 상한~~ → **해결**: 큐+폴링 비동기로 전환(§3.1).
- ~~collector 다운 시 UX~~ → **해결**: 큐에 적체, "모으는 중" 유지. 영구실패는 placeholder 정리.
- 책당 시드 개수 상한 — **≤6 확정**(§8).
- 멀티NPC 귀속 시 **출처 표기 방식**(피드에 출처 안 보임 — §8 한계) — 상용화 전 재검토.
- 인기책 prewarm 규모·빈도(즉시감 vs 차단 회피 균형).
- 예스24 외 **교보 "책 속으로"** 2차 소스 추가 여부(커버리지 보강).
- 예스24 미보유 책(신간·비주류) 처리 — 현재 `failed`(빈). 폴백 재고 여부.

## 12. 구현 체크리스트 (맥미니, 후속 코드 PR)

> ⚠️ **초안(동기·터널 방식) 폐기 — 큐 설계로 대체 (드리프트 정정 2026-07-09)**: 아래 체크리스트는 `POST /collect`·토큰 검증·Cloudflare Tunnel·`COLLECTOR_URL`/`COLLECTOR_TOKEN` 워커 호출을 전제한 **구 동기 아키텍처**의 잔재다. §2/§6/§11에서 **큐 폴링(아웃바운드만·인바운드 0·터널/토큰 불필요)**로 개정됐고 실제 코드(`collector/poller.mjs`)에도 그 엔드포인트·시크릿·터널은 존재하지 않는다. 유효 항목만 남기고 폐기 항목은 취소선 표기.

- [ ] 맥미니에 Node + 헤드리스 브라우저 환경
- [ ] collector 폴링 데몬(`poller.mjs` — `seed_queue` 폴링, 브라우저, 예스24 파이프라인 §4). ~~`POST /collect`·토큰 검증~~ **폐기(큐 폴링으로 대체)**
- [ ] `seed_sentences` 적재 로직(service role, book_key, 출처·상한)
- [ ] ~~Cloudflare Tunnel 설정 + 고정 URL~~ **폐기(§6 — 인바운드·터널 불필요)**
- [ ] launchd 등록(주기 배치 §3.2)
- [ ] ~~워커 측: `/api/seed` 가 stored 없을 때 collector 호출(`COLLECTOR_URL`/`COLLECTOR_TOKEN`), 폴백 처리~~ **폐기(워커는 `seed_queue` upsert만, collector와 직접 통신 없음 §2/§6)**
- [ ] 예의/레이트리밋/차단 대응(§7) + 모니터링 로그(§10)
- [ ] 저작권 가드(출처·상한·삭제대응 §8)
