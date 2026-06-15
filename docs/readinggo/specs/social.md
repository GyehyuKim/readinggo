# 소셜 탭 — 화면 스펙

> **Split from** `docs/2. specifications/_archive/readinggo-spec.md` v6. 원 위치: §5.7.
> **v7 갱신 (2026-06-01)**: "모이"→"한 문장", **페이지 기반 스포일러 블라인드(§5.7.1) 신설** (`is_private` 폐기), 리액션 **짹** 확정. 피드는 **전체 공개**. 짹 XP는 [systems.md §6.3](./systems.md).
> **v7.1 갱신 (2026-06-04, QA 2차)**: 피드 **팔로우/최근/추천 3탭**, `is_private` 재도입 + 감상 `note_private`. [decisions §8.1](./meta/decisions.md).
> **v7.2 갱신 (2026-06-04, post-beta 2)**: ⚠️ `is_private` binary → **`visibility` 3단계**(public/followers/private, Instagram 모델 — §5.7.1). [decisions §8.3](./meta/decisions.md).
> **v8.2 갱신 (2026-06-15, #558)**: **위시리스트(관심 책) 공개 토글** 신설 — `users.wishlist_public` 컬럼 + RLS 확장 + 설정 토글 + 타인 프로필 섹션 (§5.7.2).
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 준수.

### 5.7 소셜 탭

```
┌─────────────────────────────────────┐
│ 👥 소셜                       🔓 🔍  │   ← 스포일러 토글 / 친구 찾기
├─────────────────────────────────────┤
│ 📚 이번 주 새로 시작한 책            │   ← 신규 시작러 Top3
│  1위 사피엔스  2위 데미안  3위 …     │
├─────────────────────────────────────┤
│ 🐦 @계휴 · 어린왕자 · p.72      🔖   │   ← 한 문장 피드 (전체 공개)
│ "별은 아름답다, 모래들이…"           │
│ [짹 3]                               │
└─────────────────────────────────────┘
```

**이번 주 신규 독서 시작러 Top3**:

| 요소 | 규칙 |
|---|---|
| 집계 | 이번 주(월~일) 신규 `user_books` 생성 기준 상위 3권 |
| 표시 | 순위 + 책 제목 + "N명 시작" |
| Phase 0 | 하드코딩 시드 / Phase 1+ 주간 집계 쿼리 |

**한 문장 피드**:

| 섹션 | 규칙 |
|---|---|
| 범위 | **전체 공개** — 모든 공개 한 문장. 친구 필터는 탭으로 선택 |
| 탭 (v7.1) | **팔로우**(`feedFollowing`) · **최근**(전체 시간순 `feed`) · **추천**(내 서재 책을 읽는 타인의 최근 1주, 공유 책 유사도 `feedRecommended`, 비면 최근 폴백) |
| 카드 구성 | 아바타 + 닉 + 책 제목 탭(→ 책 상세) + **페이지(`p.N`)** + 한 문장 텍스트 + 리액션 |
| 리액션 — 좋아요 = 짹 | **좋아요 = 짹**: 타인 문장에 대한 **공개 반응**(±1 토글, **개수 공개**). 내 한 문장이 받은 짹 = **XP +1** ([systems.md §6.3](./systems.md)). 저장(책갈피)과 별개 동작 |
| 저장 = 책갈피 | **저장 = 책갈피**: 내·타인 문장을 다시 보기 위한 **비공개 개인 보관**(**공개 개수·XP 없음**). 카드 우측 상단 🔖 → `sentence_bookmarks` ([profile.md](./profile.md)). 짹(공개 반응)과 별개 동작 |
| 책 자세히 | 책 제목 탭 → [profile.md](./profile.md) 책 상세 |
| 본인 카드 | **짹 비활성**(자기 문장에 공개 짹 불가) · **책갈피 허용**(내 문장도 비공개 저장 가능) |
| 감상(`my_note`) | **피드 비노출** — 본인 프로필·책 상세에서만 ([profile.md §5.8.4](./profile.md)). 공개여부는 `note_private` 토글(§5.7.1) |
| 빈 상태 | "아직 한 문장이 없어요. 오늘의 문장을 남겨보세요 🐦" |
| 카드 리뷰 (보류 — #186→#540) | **현재 제품 범위 제외 (2026-06-15, #540).** 틴더식 스와이프 카드의 **우=좋아요(짹+책갈피 동시)** 가 짹(공개 반응)과 책갈피(비공개 저장)의 의미를 섞어 보류한다. 피드 상단 **'🃏 카드로 넘겨보기'** CTA 및 `TinderCards` 호출 연결은 **후속 코드 PR에서 해제**(컴포넌트 코드·데이터는 **삭제하지 않고 보존**). 재도입 시 두 행동 분리 전제. *(기존 구현 참고: 피드 상단 CTA → 한 문장 스와이프 카드, 카드 상단 책 표지·제목·저자, Pointer Events 직접 — Stack Lock)* |

> v7 폐기: ~~주간 리그~~([systems.md §6.5](./systems.md)), ~~"모이"~~.

#### 5.7.1 한 문장 노출 — 페이지 블라인드(자동) + 공개 범위 3단계 (v7.2, SSOT)

노출을 두 층으로 통제한다. **이 절이 단일 출처** — 책 상세·프로필·마을이 참조.

**(A) 페이지 기반 블라인드 (자동)** — 읽은 위치 기준 자동 가림(아래 표). 저장 컬럼 없음.

**(B) 수동 공개 범위 — `visibility` 3단계 (v7.2, #179 — v7.1 `is_private` binary 확장. [decisions §8.3](./meta/decisions.md))**
- `sentences.visibility` ∈ **`public`**(전체 공개) · **`followers`**(상호 팔로워만) · **`private`**(나만 보기). 기본 `public`. Instagram 모델 — **작성자가 공개해야만 타인에게 보인다.**
- 서버(RLS) 강제: `public`=누구나 / `followers`=작성자 본인 OR 양방향 `follows` 존재 / `private`=작성자 본인만. 마이그레이션 `06_privacy_v2.sql`(기존 `is_private=true`→`private`, `false`→`public`).
- `sentences.note_private` — 감상(`my_note`)만 별도 비공개. 컬럼 단위라 RLS 불가 → **클라이언트 표시 단계 존중**(soft).
- 토글 위치: 책 상세(BookDetailModal) 각 한 문장의 순환 탭. **표기 = 텍스트 칩 "🌐 전체공개 → 👥 친구공개 → 🔒 비공개"**(아이콘만은 의미 모호 → 라벨 병기, QA3).

| 상황 | 처리 |
|---|---|
| 내가 **읽고 있는** 책의 한 문장 중, **내 현재 페이지보다 뒤** 페이지 | **블라인드** — "⚠️ 내가 아직 안 읽은 부분 · 탭하면 보기" |
| 내 현재 페이지 이하 | 그대로 노출 |
| 내가 **읽지 않는** 책 | **전체 공개** (블라인드 없음) |
| 내가 **완독**한 책 | **전체 공개** |

- **전역 토글 (v7.2)**: **설정(프로필 ⚙️)으로 이전**(#3) — 소셜 헤더 `🔓`는 제거됨. `SettingsModal`의 "스포일러 모두 보기" 스위치 → `SpoilerContext`(`spoilerReveal`)로 전 영역(피드·책상세·프로필·마을) 블라인드 일괄 해제. (구 "헤더 우측 🔓"·#157 표기는 폐기)
- 적용 범위: **소셜 피드 · 책 상세 · 프로필 한 문장 모음 · 마을 한 문장** — 전 영역 동일 규칙.
- 판정 데이터: 뷰어의 `user_books.current_page`(해당 책) vs `sentences.page` 비교 (`DataStore.spoiler.myCurrentPage`). 저장 컬럼 없음.

**친구 찾기**:
- 헤더 우측 "🔍 친구 찾기" → 인라인 패널 토글
- @닉네임 검색 → Phase 0 `NPC_SEARCH_USERS` 풀(`@book_bear`, `@activist_raccoon`, `@reading_owl`, `@page_fox`) 실시간 필터
- "팔로우" → `friends`에 추가, 마을 그리드 즉시 반영. 이미 팔로우 시 "팔로잉 ✓"
- Phase 1+: `users` 테이블 검색, 맞팔 요청

#### 5.7.2 위시리스트(관심 책) 선택적 공개 (#558, v8.2)

기본값: **비공개**. 사용자가 설정에서 ON으로 바꾸면 타인 프로필에 위시리스트 섹션이 노출된다.

**DB 계약**

| 항목 | 내용 |
|---|---|
| 컬럼 | `users.wishlist_public BOOLEAN NOT NULL DEFAULT FALSE` |
| 마이그레이션 | `25_wishlist_public.sql` — 컬럼 추가 + `wish_all` RLS 정책 교체 |
| RLS (`wish_all`) | `SELECT`: 소유자(`user_id = auth.uid()`) OR 대상 user의 `wishlist_public = TRUE`. `INSERT/UPDATE/DELETE`: 소유자만 (`user_id = auth.uid()`). |

**DataStore 계약** (local·supabase 어댑터 동일 시그니처)

```
users.publicWishlist(userId)  → WishBook[]   // wishlist_public=true인 타인의 위시리스트. false이면 [] 반환.
```

**설정 UI** (`SettingsModal`)

- "❤️ 읽고 싶은 책 공개" 토글 항목 추가 (스포일러 토글 아래).
- ON → `DataStore.profile.update({ wishlist_public: true })` / OFF → `false`.
- Supabase 모드에서만 활성(로컬/게스트는 비활성 + "로그인 후 이용 가능" 안내).

**타인 프로필** (`UserProfileModal`)

- 대상 user의 `wishlist_public = true`이면 책장 아래에 "❤️ 읽고 싶어하는 책" 섹션 표시.
- 섹션 구성: 가로 스크롤 표지 카드(표지 + 제목). 탭 → 책 드릴다운(기존 `BookCard`·`bookView` 패턴 재활용).
- `wishlist_public = false`(기본)이면 섹션 자체를 렌더하지 않음(※ 안내 문구도 표시 안 함).
