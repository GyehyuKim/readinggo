# ReadingGo 데모 — Claude Code 가이드

이 디렉토리(`docs/readinggo/`)가 ReadingGo Phase 0 데모의 루트다.

## 도서 데이터 — books.tsv

`data/books.tsv` 가 유일한 도서 데이터 소스다. **책 정보를 코드에 하드코딩하지 말 것.**

### 파일 구조

```
book_id  isbn             title      author      publisher  total_pages  cover_url
b001     9788934972464    사피엔스   유발 하라리  김영사     648          https://image.aladin.co.kr/...
```

- 구분자: 탭(`\t`), 인코딩: UTF-8
- 총 542권 (민음사 세계문학전집 중심 + 사피엔스·코스모스 등 교양서)
- `cover_url`: 알라딘 CDN 이미지 URL — 모든 행에 존재

### 코드에서 사용하는 법

```js
// data.js의 loadBooks()가 TSV를 비동기 파싱 후 배열 반환 (내부 캐시됨)
const books = await loadBooks();
// books[0] → { book_id, isbn, title, author, publisher, total_pages, cover_url }

// 정확한 제목 검색
const book = books.find(b => b.title === '사피엔스');

// 퍼지 검색 (검색창용)
const results = fuzzySearch(books, query).slice(0, 20);
```

`loadBooks`와 `fuzzySearch`는 `window`에 export됨 — `data.js` 로드 이후 어디서든 호출 가능.

### 새 책 추가가 필요하다면

`data/books.tsv`에 행 추가 (탭 구분). 코드 수정 불필요.

## 파일 구조

```
docs/readinggo/
├── index.html          # 진입점 — React + Babel CDN, CSS 토큰 정의
├── data/
│   ├── books.tsv       # 도서 DB (542권, 유일한 소스)
│   └── books_toc.csv   # 목차 데이터 (챕터별 페이지)
├── js/
│   ├── data.js         # 상태·시드 데이터·loadBooks·fuzzySearch
│   ├── components.js   # 공용 UI (AppHeader, BookCover, StreakCalendar 등)
│   ├── onboarding.js   # 가입 여정 A→C1→C2→D1→D2→D3→E
│   ├── nest.js         # 홈 탭 (독서 기록, 스트릭)
│   ├── social.js       # 소셜 탭 (리그, 피드)
│   ├── library.js      # 서재 탭 (책 목록, 상세, 설정)
│   └── app.js          # 최상위 App + ReactDOM.createRoot
└── fonts/              # Moneygraphy Rounded / Pixel
```

## 아키텍처 메모

- **React 18 CDN + Babel standalone** — 빌드 도구 없음. `js/` 파일은 `index.html`에서 순서대로 `<script type="text/babel">`로 로드됨.
- **크로스 파일 공유**: 각 파일 맨 끝 `window.X = X` 패턴으로 전역 노출. import/export 없음.
- **상태**: `localStorage` 키 `rg_v41`에 전체 앱 상태 저장. 초기값은 `data.js`의 `INITIAL_STATE`.
- **날짜 시뮬레이터**: `state.simDate`(`null` = 오늘). 홈 화면 우하단 "+1일" 버튼으로 조작.
