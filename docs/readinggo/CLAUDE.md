# ReadingGo 데모 — Claude Code 가이드

이 디렉토리(`docs/readinggo/`)가 ReadingGo Phase 0 데모의 루트다.

> **제품 계약 경계:** 아래 파일 구조와 코드 설명에는 레거시 as-built가 섞여 있다. 활성 v18 목표는 [`specs/README.md`](./specs/README.md)를 먼저 따른다. 3번째 탭은 `서재`이며 `nest-grow`는 legacy alias로만 유지한다. 기존 책 카드 디자인은 네 상태 포함·제외 filter가 만든 단일 projection의 유한 가로 `scroll-snap` 레일로 빠르게 넘기고, 4번째 `프로필`에는 사용자 로컬 페이지 세션 날짜 문자열과 내 문장 timestamp의 로컬 날짜 합집합으로 월간 활동 캘린더와 비징벌적 연속일을 표시한다. 책나무·친구 책나무 사용자 표면은 보류하고 XP·둥지·성·방패·하루 만회를 복원하지 않는다. 책·문장·세션·위시·최근 14일 리듬·누적 성장일·공개범위·RLS 안전 계약은 유지한다.

## 도서 데이터 — Supabase `books` (canonical)

도서 데이터의 단일 진실원천은 **Supabase `books` 테이블**이다(#490). 게스트도 publishable key + anon RLS read 로 같은 카탈로그를 읽는다. **책 정보를 코드에 하드코딩하지 말 것.** 구 정적 `books.tsv`(542권)는 과도기 잔재이자 stale 드리프트 원인이라 **제거됨(#972)** — Supabase 미설정/장애 시 폴백은 `data.js`의 인라인 `RG_BOOKS`(12권, 데모 무중단용)뿐이다.

### 코드에서 사용하는 법

```js
// data.js의 loadBooks()가 Supabase books 를 적재·캐시(실패 시 인라인 RG_BOOKS 폴백)
const books = await loadBooks();
// books[0] → { id, isbn, title, author, pub, total, cover, ... }

// 동기 단건 조회 — 부팅 시 캐시 워밍됨 (#490)
const book = window.getBook(bookId);

// 퍼지 검색 (검색창용)
const results = fuzzySearch(books, query).slice(0, 20);
```

`loadBooks`·`fuzzySearch`·`getBook`는 `window`에 export됨.

### 새 책 추가가 필요하다면

검색·등록 시 워커가 알라딘 결과를 Supabase `books`에 upsert 한다(#489). 코드 수정 불필요.

## 파일 구조

```
docs/readinggo/
├── index.html          # HTML 셸 — CSS 토큰·부트 placeholder. <script module main.js>
├── main.js             # Vite 진입(#871) — setup-globals + js/* 순서 import + app 마운트
├── setup-globals.js    # React/ReactDOM/Fuse/htmlToImage/supabase → window 노출
├── vite.config.js      # .js→JSX(esbuild classic), base './', dist 산출
├── public/             # 정적자산(런타임 fetch/참조)
│   ├── fonts/          # Moneygraphy Rounded / Pixel
│   └── assets/         # sparrow 등 (도서 데이터는 Supabase — §도서 데이터)
├── js/
│   ├── data.js         # 상태·시드 데이터·loadBooks·fuzzySearch
│   ├── components.js   # 공용 UI (AppHeader, BookCover, 레거시 StreakCalendar 등)
│   ├── nest.js         # 현행 홈 탭 (독서 기록, 레거시 스트릭)
│   ├── social.js       # 현행 함께 탭 (레거시 리그·피드 포함)
│   ├── library.js      # 서재 탭 (책 목록, 상세, 설정)
│   └── app.js          # 최상위 App + ReactDOM.createRoot
└── capacitor.config.json  # 앱 셸(#872) webDir=dist
```

## 아키텍처 메모

- **Vite 빌드(#871)** — React 18 + 빌드타임 JSX(esbuild, classic). `js/*.js`는 `main.js`가 기존 순서대로 ES import(런타임 Babel 폐기). 개발 `npm run dev`, 빌드 `npm run build`→`dist/`(wrangler/netlify 서빙).
- **크로스 파일 공유**: 각 파일 맨 끝 `window.X = X` 패턴으로 전역 노출. import/export 없음.
- **상태**: `localStorage` 키 `rg_v41`에 전체 앱 상태 저장. 초기값은 `data.js`의 `INITIAL_STATE`.
- **날짜 시뮬레이터**: `state.simDate`(`null` = 오늘). 홈 화면 우하단 "+1일" 버튼으로 조작.
