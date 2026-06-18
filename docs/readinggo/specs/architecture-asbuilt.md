# 아키텍처 실측 (As-Built) — 코드에서 역생성

> **이 문서는 "실제 코드가 지금 이렇게 동작한다"는 사실(WHAT)만 적는다.** 계획·의도가 아니라 구현 스냅샷이다.
> - **기준**: `main` (생성 시점 — 코드에서 재생성 가능, §12 참조).
> - **WHY(왜 이렇게 했나)는 여기 없다** → [`meta/decisions.md`](./meta/decisions.md)·`MANIFESTO`·`ROADMAP`(의도 문서). 이 둘을 섞지 않는 게 이 문서의 존재 이유(드리프트 방지).
> - **드리프트 주의**: 계획 문서(README §3 Phase, Stack Lock의 "Gemini" 등)와 어긋나면 **이 문서(코드 실측)가 사실**이다. §11에 차이를 정리.

---

## 1. 한눈에 (스택 요약)

| 층 | 무엇 | 핵심 |
|---|---|---|
| **프론트엔드** | React 18 (CDN) + 인브라우저 Babel | **빌드 도구 없음**. JSX를 브라우저가 즉석 변환. 모듈 27개 |
| **모듈 공유** | `window.X` 전역 | import/export 없음. 로드 순서가 계약 |
| **상태/데이터** | DataStore 계약 | 미로그인=localStorage / 로그인=Supabase (부팅 스왑) |
| **백엔드** | Cloudflare Worker (`worker/index.mjs`) | 정적 서빙 + 8개 API 프록시 + cron |
| **DB/인증** | Supabase (Postgres·Auth·RLS·pg_cron) | 테이블 22개, 마이그레이션 30개 |
| **외부 연동** | 알라딘·구글북스·오픈라이브러리·네이버·Upstage·PostHog | 키는 워커(서버)에만 |
| **배포** | Cloudflare Workers Build | `main` 머지 시 자동. 키 캐시버스트 `_RG_V` |
| **CI** | GitHub Actions 3종 | test · spec-drift · deploy-verify |

---

## 2. 프론트엔드 — 무빌드 React

- **진입점**: `docs/readinggo/index.html` (약 1,470줄). 대부분이 **인라인 CSS**(`<style>`, 디자인 토큰)이고, `<body>`엔 `<div id="root">`(부팅 placeholder 🐦)뿐.
- **렌더**: `app.js`가 `ReactDOM.createRoot(#root)`로 전체 앱을 그린다. 화면 내용은 전부 React 컴포넌트.
- **JSX 변환**: 빌드 단계 없음. `loadBabel(src)`가 각 `js/*.js`를 `fetch` → `Babel.transform(...presets:[['react',{runtime:'classic'}]])` → `eval`. (Babel은 자체 호스팅 `vendor/babel.min.js@7.29.7`, #687/#691)
- **캐시버스트**: 전역 `_RG_V`(현재 `'96'`). 모든 `js/X.js?v=_RG_V`. 배포마다 bump(스큐·#687 방지).

### 2.1 부팅 로드 순서 (index.html, 의존 먼저)

```
[plain script] config.js → supabase-client.js → datastore-supabase.js
[loadBabel 순서] data → datastore → icons → components → sentence-card →
  book-info-modal → user-profile-modal → sentence-collection-modal →
  share-card → search → ocr-crop-overlay → ceremony → nest → companion →
  social → admin-dashboard → book-detail-modal → nest-theatre →
  follow-list-modal → library → settings-modal → shelf-import → app
```

> 로그인 상태면 `app.js` 직전에 `window.DataStore`를 `SupabaseDataStore`로 스왑(§4).

### 2.2 모듈 맵 (27개, `window.X` export)

| 파일 | 줄 | export(주요) | 역할 |
|---|---|---|---|
| `config.js` | 69 | `RG_CONFIG`·`RG_VERSION`·`RG_VALIDATE`·`RG_COMPANION_PRESETS` | 설정·버전·검증 |
| `data.js` | 495 | `ALL_BOOKS`·`getBook`·`loadBooks`·`fuzzySearch`·`NEST_STAGES`·`XP_RULES`·`computeCheckinXp`·`nest*` | 시드·도서·XP/둥지 로직 |
| `datastore.js` | 732 | `localStorageAdapter`·`DataStore`·`getBook` | localStorage 어댑터 |
| `datastore-supabase.js` | 992 | `SupabaseDataStore` | Supabase 어댑터 |
| `supabase-client.js` | 98 | `RG_SB` | Supabase 클라이언트·auth |
| `icons.js` | 117 | `RG_ICONS`·`rgIcon`·`NEST_ART`·`nestArt`·`SectionLabel` | 공용 아이콘(인라인 SVG) |
| `components.js` | 307 | `BookCover`·`Toast`·`showToast`·`decodeEntities`·`rgTrack`·`ConsentBanner`·`ActivityHeatmap` 등 | 공용 UI·유틸 |
| `sentence-card.js` | 225 | `SentenceCard`·`SentenceActions` | 한 문장 카드·액션(좋아요/공개범위) |
| `book-info-modal.js` | 209 | `BookInfoModal` | 책 정보 모달 |
| `book-detail-modal.js` | 591 | `BookDetailModal` | 책 상세(서재) |
| `user-profile-modal.js` | 226 | `UserProfileModal` | 타인 프로필 |
| `sentence-collection-modal.js` | 118 | `SentenceCollectionModal` | 한 문장 모음 |
| `share-card.js` | 379 | `shareSentence`·`shareService`·`renderSentenceCardBlob` | 외부 공유 카드(html-to-image) |
| `search.js` | 405 | `SearchModal`·`SearchResultItem` | 도서 검색 UI |
| `ocr-crop-overlay.js` | 137 | `OcrCropOverlay` | 사진 글귀 크롭 |
| `ceremony.js` | 197 | `Ceremony` | 체크인/진화 세리머니 |
| `nest.js` | 631 | `NestView` | 홈 탭(읽기·체크인) |
| `nest-theatre.js` | 151 | `NestTheatre` | 둥지 캐릭터(프로필) |
| `companion.js` | 276 | `CompanionModal` | 재키(LLM 독서 파트너) |
| `social.js` | 222 | `SocialView` | 소셜 피드 |
| `admin-dashboard.js` | 259 | `AdminDashboardModal` | 운영자 대시보드 |
| `follow-list-modal.js` | 63 | `FollowListModal` | 팔로우 목록 |
| `library.js` | 546 | `LibraryView` | 서재(프로필) 탭 |
| `settings-modal.js` | 189 | `SettingsModal` | 설정 |
| `shelf-import.js` | 148 | `ShelfImportModal` | 서가 가져오기(#772) |
| `app.js` | 837 | `RG_*` 핸들러·`createRoot` | 최상위 앱·라우팅 |
| `onboarding.js` | 402 | `OnboardingFlow` | ⚠️ **index.html 부팅에 미로드 — 미사용 추정**(§11) |

---

## 3. 라이브러리 (CDN·고정 버전)

| 라이브러리 | 출처 | 용도 |
|---|---|---|
| React 18 / ReactDOM 18 (`development`) | unpkg | UI |
| `@babel/standalone@7.29.7` | **자체 호스팅** `vendor/babel.min.js` | 인브라우저 JSX 변환 |
| `fuse.js@7.0.0` | jsdelivr | 퍼지 검색 |
| `html-to-image@1.11.11` | jsdelivr | 공유 카드 이미지화 |
| `@supabase/supabase-js@2` | jsdelivr | DB·인증 클라이언트 |

> 빌드/번들러 **없음**(Stack Lock). React는 dev 빌드 사용 중.

---

## 4. 상태·데이터 — DataStore 계약

- 피처 코드는 저장소를 **직접 호출하지 않고** `DataStore.<도메인>.<메서드>()`만 부른다(추상층).
- **부팅 스왑**(index.html): 기본은 `localStorageAdapter`(`datastore.js`). `RG_SB.isConfigured()` && 로그인 사용자면 `window.DataStore = SupabaseDataStore`(`datastore-supabase.js`)로 교체.
  - **미로그인/게스트** → localStorage (서버 없이 동작)
  - **로그인** → Supabase (실데이터·RLS)
- 계약 검증: CI `datastore-contract.mjs`가 "피처가 부르는 메서드가 supabase 어댑터에 실제 있나" 정적 검사.

---

## 5. 백엔드 — Cloudflare Worker (`worker/index.mjs`)

정적 사이트(`[assets]`)를 서빙하고, 키가 필요한 호출을 대행(동일출처만 허용, 키 클라 비노출).

| 라우트 | 무엇 | 외부 호출 |
|---|---|---|
| `/js/config.js` | 배포 버전 ID 주입(#748) | — (`CF_VERSION`) |
| `/aladin` (+`/.netlify/functions/aladin`) | 도서 검색·메타 프록시 | 알라딘 TTB API |
| `/api/img` | 표지 이미지 프록시(CORS 우회) | image.aladin.co.kr |
| `/api/companion` | 재키 질문 생성 | Upstage LLM |
| `/api/ocr` | 책 사진 → 한 문장 | Upstage Document OCR |
| `/api/related` | 관련 도서(함께 읽을 책) | Upstage LLM(+검색 소스) |
| `/api/shelf-import` | 서가 가져오기(#772) | 검색 소스·Supabase |
| `/api/seed` | 시드 데이터 | Supabase(service_role) |
| **cron** `0 18 * * *`(UTC)=KST 03:00 | 일일 인기도서 아카이브(#239) | 알라딘·Supabase |

도서 검색/메타는 **다중 소스**: 알라딘(주) + 구글북스(`books/v1/volumes`) + 오픈라이브러리(`api/books`, 표지 폴백 `covers.openlibrary.org`) + 네이버 블로그검색(보강). 정확한 폴백 순서는 `worker/index.mjs` 참조.

---

## 6. 외부 연동 (전수 — 코드 grep 기반)

| 호스트 | 역할 | 인증(서버) | 위치 | 비고 |
|---|---|---|---|---|
| `www.aladin.co.kr/ttb` | 도서 검색·메타(주 소스) | `ALADIN_TTB_KEY` | worker | |
| `image.aladin.co.kr` | 표지 이미지 | — | worker `/api/img` | CORS 프록시 |
| `www.googleapis.com/books` | 도서 검색·메타 | `GOOGLE_BOOKS_API_KEY`(선택) | worker | 무키 시 레이트리밋 |
| `openlibrary.org` / `covers.openlibrary.org` | 메타·표지 폴백 | — | worker | |
| `openapi.naver.com` | 블로그검색(보강) | `NAVER_CLIENT_ID`/`SECRET` | worker | |
| `api.upstage.ai` | **유일 AI** — 재키·OCR·관련도서 | `UPSTAGE_API_KEY`(Bearer) | worker | model `solar-pro3` |
| `*.supabase.co` | DB·인증 | `SUPABASE_SERVICE_ROLE_KEY`(서버)·publishable(클라) | worker·client | |
| `us.posthog.com` | 사용 분석 | (클라 토큰) | client·admin | 어드민 링크아웃 |
| `search.kyobobook.co.kr` | **구매처 링크아웃** | — | book-detail/info-modal | ⚠️ API 아님, `<a href>` |
| `cdn.jsdelivr.net`·`unpkg.com` | 라이브러리 CDN | — | index.html | |

> **Gemini는 코드에 없음** — `datastore-supabase.js`에 "프록시 붙기 전 **stub**" 주석 1곳뿐(§11).

---

## 7. Supabase 스키마

- 마이그레이션 **30개**(`docs/readinggo/supabase/*.sql`), 테이블 약 **22개**:
  `users·books·user_books·sentences·claps·follows·pokes·reading_sessions·streak·shield_log·wish_books·sentence_bookmarks·inquiries·companion_sessions·npc_sentence_seeds·seed_sentences·villages·village_members·village_opinions·village_parts·village_topics`
- **RLS**(행 단위 보안) 정책 다수, `create or replace function`(admin insights·stats 등) 포함.
- 마이그레이션은 **자동 적용 안 됨** — 수동 적용 + CI `migrations_applied.py`(라이브 DB 대조, 토큰 있을 때).

---

## 8. 배포 (`wrangler.toml`)

- **Cloudflare Worker** `readinggo`, `main = worker/index.mjs`.
- `[assets] directory = docs/readinggo` → 워커가 정적 사이트 서빙.
- `[version_metadata] binding = CF_VERSION` → 버전 자동 주입(#748).
- `[vars]`: `SUPABASE_URL`·`ARCHIVE_DAILY_CAP`·`LLM_BASE_URL`(upstage)·`LLM_MODEL`(solar-pro3).
- `[triggers] crons = ["0 18 * * *"]`.
- **자동 배포**: `main` 푸시 시 Cloudflare Workers Build. (수동 폴백 `npx wrangler deploy`)
- **시크릿**(`wrangler secret`): `ALADIN_TTB_KEY`·`SUPABASE_SERVICE_ROLE_KEY`·`UPSTAGE_API_KEY`·`NAVER_CLIENT_ID/SECRET`·`GOOGLE_BOOKS_API_KEY`.

---

## 9. CI / 검증 (GitHub Actions)

| 워크플로우 | 잡(주요) |
|---|---|
| `test.yml` | validate-books · align_v7 · datastore-contract · **boot-smoke**(부팅 Babel 회귀) · biome lint · migrations_applied |
| `spec-drift.yml` | align_v7+nest+drift · datastore-contract · related-filter · nest-cycle · supabase-books · sentence-book-binding · biome lint |
| `deploy-verify.yml` | 배포 후 `_RG_V` 대조(#693) — Workers Build 멈춤 감지 |

---

## 10. 보안 원칙(코드에서 관찰)

- 모든 외부 키는 **워커(서버)에만**. 브라우저엔 publishable/anon 키만.
- 프록시 라우트는 **동일출처(Origin)만** 허용(쿼터 남용 차단).
- Supabase **RLS**로 행 단위 접근 제어. 게스트는 publishable key + RLS read.

---

## 11. 역생성으로 드러난 사실 (문서 드리프트)

코드 실측이 계획 문서와 어긋난 지점 — **이 문서가 사실**:

1. **Gemini 미구현**: Stack Lock·ROADMAP 등은 "도서 추천 = Gemini"라 적었으나 **코드엔 stub 주석뿐**. 실 AI는 Upstage `solar-pro3` 하나(재키·OCR·관련도서).
2. **검색 다중 소스**: 문서엔 알라딘 중심으로만 보이나, 실제론 **알라딘+구글북스+오픈라이브러리+네이버**.
3. **교보문고**: 데이터 연동이 아니라 **구매처 링크아웃**(`<a href>`).
4. **모듈화 진행됨**: `components.js` 1626→307줄. #761/#762로 27개 모듈로 분리 완료(부팅 순서 §2.1).
5. **`onboarding.js` 미로드**: `window.OnboardingFlow` 정의돼 있으나 index.html 부팅·`app.js`에서 참조 없음 → **사용 안 되는 코드로 추정**(별도 확인·정리 후보).
6. **Phase 표현**: README §3은 Phase 0/1을 미래형으로 적었으나, 실제 런타임은 **로그인=Supabase / 미로그인=localStorage 공존**.

---

## 12. 이 문서를 재생성하는 법 (낡지 않게)

이 문서는 **코드에서 다시 뽑을 수 있다**. 핵심 스캔:

```bash
# 외부 연동(호스트) 전수
grep -rhoE "https?://[a-zA-Z0-9.\-]+" worker/ docs/readinggo/js/ | sort | uniq -c | sort -rn
# 워커 라우트 / env(시크릿)
grep -nE "p ?===" worker/index.mjs ; grep -oE "env\.[A-Za-z_]+" worker/index.mjs | sort -u
# 모듈 export / 부팅 순서
grep -oE "window\.[A-Za-z_]+ ?=" docs/readinggo/js/*.js ; grep -n "loadBabel(" docs/readinggo/index.html
# Supabase 테이블
grep -rhoE "create table (if not exists )?[a-z_.]+" docs/readinggo/supabase/*.sql | sort -u
```

> 큰 변화(모듈 추가·외부 연동 변경·배포 방식 변경) 시 이 문서를 같은 PR에서 갱신한다. WHY는 `decisions.md`에.
