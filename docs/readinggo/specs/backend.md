# 백엔드 스펙 (플랫폼·인증·DataStore 계약·데이터 모델)

> **Split from** `docs/2. specifications/_archive/readinggo-spec.md` v6 (2026-05-28 분할). 원 위치: §7.
> **v7 갱신 (2026-06-01)**: web-first 재정의. Capacitor 보류 → 순수 웹(Phase 0/1). 운영자 짹·스포일러 컬럼(`is_private`)·`chapter_id` 자동매핑 제거, 완독 별점·소감·마을 테이블 추가, **DataStore 계약(§7.2) 신설**. 변경 이력은 git log 참조.
> **v7.1 갱신 (2026-06-04, QA 2차)**: `is_private` 재도입 + `note_private`, **DB CHECK 제약**(`04_constraints.sql`), 닉네임 규칙 `{2,20}`, 이메일 **autoconfirm**(베타 한정). [decisions §8.1](./meta/decisions.md).
> **v7.2 갱신 (2026-06-04, post-beta 2)**: ⚠️ `is_private` binary → **`visibility` 3단계**(public/followers/private, `06_privacy_v2.sql`), `admin.stats()`·`claps.isMine`·`friends.unfollow/isFollowing`·`users.public*`·`sessions.calendar` 계약 추가, 마을 Supabase 연동·이메일 브랜딩. [decisions §8.2/§8.3](./meta/decisions.md).
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.

## 7. 백엔드 스펙

### 7.1 플랫폼

**web-first.** Phase 0 은 백엔드 없이 정적 웹으로, Phase 1 부터 Supabase 를 붙인다. 두 단계는 **DataStore 계약(§7.2)** 으로 추상화되어, 피처 코드는 어느 Phase 인지 모른 채 동일 인터페이스만 호출한다.

| 항목 | Phase 0 (정적 웹 데모) | Phase 1+ (Supabase) |
|---|---|---|
| 데이터 저장 | `localStorage` (키 `rg_v41`) + 정적 TSV (`data/books.tsv`) | PostgreSQL + RLS |
| 인증 | 없음 (가짜 세션 localStorage) | Supabase Auth (Google OAuth) |
| 배치 | 없음 (날짜 시뮬레이터로 대체, §발표용) | pg_cron (UTC 15:00 일일, 월 00:00 주간) |
| AI 도서 추천 | 하드코딩 추천 시뮬 | **Gemini Flash 무료 티어** + 서버리스 프록시 (§7.9) |
| 표지 이미지 | 알라딘 CDN URL (`books.cover_url`) | 동일 + Storage 옵션 |
| 풀텍스트 보조 | 클라이언트 fuzzy (Fuse.js + 자모 분해) | + `pg_trgm` 서버 보조 |

**플랫폼 결정 (v7):**

- **빌드**: 현행 React 18 CDN + Babel standalone 유지 (빌드 도구 없음). Vite 전환은 **PWA 전환 시 재검토** (현재 보류).
- **배포**: **Netlify** — 사이트 `resilient-licorice-f4b889`, `https://resilient-licorice-f4b889.netlify.app`. (GitHub Pages 폐기.) 재배포: `npx netlify-cli deploy --dir=docs/readinggo` (프로덕션 `--prod`).
- **모바일/네이티브**: **Capacitor 보류** — OCR·STT·앱스토어가 필요한 Phase 3 에서 재도입 검토. 그전까지 한 줄 입력 마찰은 **OS 키보드 음성입력**(폰 키보드 마이크 = OS STT, 비용 0)으로 대체 안내.
- **푸시 알림**: Phase 2 **PWA 전환(웹푸시)** 이후로 후순위. Phase 0/1 은 알림 없음(인앱 토스트 시뮬).

### 7.2 DataStore 계약 (Phase 0 ↔ Phase 1 이음매) — v7 신설

**목적**: 백엔드 오염 방지. 모든 데이터 접근을 **한 모듈(`DataStore`)로 가둔다.** 피처 코드(nest·village·social·profile·onboarding)는 `localStorage` 나 `supabase` 를 직접 호출하지 않고, 아래 인터페이스만 호출한다.

```
피처/컴포넌트  ──(DataStore.* 호출)──▶  DataStore 계약
                                          ├─ Phase 0: localStorageAdapter  (rg_v41 + 시드/시뮬)
                                          └─ Phase 1: supabaseAdapter        (Auth · Postgres · RLS)
```

- **Phase 0 → 1 이행 = 어댑터 교체 한 줄.** 피처 코드는 한 줄도 바뀌지 않는다.
- 버려지는 것은 `localStorageAdapter` 하나뿐. 컴포넌트·UX·상태 로직은 100% 재사용.
- **규율**: 피처 파일에서 `localStorage.getItem` / `supabase.from(...)` 직접 호출 금지. 위반 시 Phase 1 마이그레이션이 깨진다. auto 구현(Ralph loop) 시에도 이 계약을 SSOT 로 강제.

**인터페이스 (메서드 표면, 도메인별 그룹):**

```
// 인증 / 프로필 / 설정
auth.currentUser()                         → User | null
auth.signInWithGoogle()                    → User           // Phase 0: 가짜 세션
profile.get(userId?)                       → User
profile.update({display_name, avatar_url, bio})
settings.get() / settings.update({reminder_hour, ...})

// 책 / 검색
books.search(query)                        → Book[]          // DB ilike(즉시) — 클라에서 데모 Fuse + 알라딘 결과와 병합·중복제거(isbn13). 외국 작가 표기변이는 알라딘 위임 (QA3 #148)
books.get(bookId)                          → Book
myBooks.list()                             → UserBook[]      // 읽는 중 + 완독 + 보관
myBooks.add({book, current_page})          → UserBook
activeBook.get()                           → UserBook | null
activeBook.set(userBookId)                                  // = users.active_user_book_id UPDATE

// 일일 기록 (세션 + 한 문장)
sessions.addToday({userBookId, page})      → Session         // 하루 첫 기록: 세션 생성 + 스트릭/XP
sessions.list(userBookId)                  → Session[]
sentences.add({userBookId, sessionId, page, text, my_note?}) → Sentence
sentences.setNote(sentenceId, my_note)                       // 사후 감상 추가·편집 (작성 시점 무관, §profile 5.8.4)
sentences.listByBook(userBookId)           → Sentence[]
sentences.feed({cursor})                   → Sentence[]      // 최근(전체 공개) 피드 (§social)
sentences.feedFollowing({limit})           → Sentence[]      // v7.1: 팔로우 피드
sentences.feedRecommended({limit})         → Sentence[]      // v7.1: 추천(공유 책 유사도, 비면 최근 폴백)
sentences.setVisibility(id, {visibility?, note_private?})    // v7.2: visibility 3단계(public|followers|private) + 감상 note_private
sentences.listMine()                       → Sentence[]
sentences.random()                         → Sentence        // 무작위 회상 — 내 과거 한 문장 1개 (§profile 5.8.7)

// 스트릭 / XP / 성(완독)
streak.get()                               → Streak
streak.bumpOnCheckIn()                                      // 입력 즉시 호출
xp.get() / xp.add(amount, reason)
books.complete(userBookId, {rating?, review_text?})         // 완독 → 🏰 1개 (성 = 파생)
castles.list()                             → UserBook[]      // status='completed' (성 컬렉션)

// 일일 기록 (추가)
sessions.calendar(days?)               → {readDates, shieldDates}  // 스트릭 캘린더 — 최근 N일(기본 35) 읽은/방패 날짜

// 소셜 (짹 / 책갈피 / 관심책 / 콕찌르기 / 팔로우)
claps.toggle(sentenceId)               → boolean            // 짹 = 한 문장 좋아요 (true=liked)
claps.isMine(sentenceId)               → boolean            // 내가 좋아요했는지 — SentenceCard 초기 상태 로드 (#156)
bookmarks.toggle(sentenceId) / bookmarks.list()             // 책갈피
wishBooks.add(bookId) / wishBooks.list() / wishBooks.remove(bookId)
pokes.send(toUserId) / pokes.listReceived()                 // 콕찌르기 🪱 (일 1회)
friends.list() / friends.follow(userId) / friends.unfollow(userId) / friends.isFollowing(userId)  // 팔로우

// 유저 (공개 데이터)
users.search(query)                    → User[]
users.getByHandle(handle)              → User | null
users.publicBooks(userId)              → UserBook[]          // 완독 책장 (status='completed', 전체 공개)
users.publicSentences(userId)          → Sentence[]          // 공개 한 문장 (visibility='public', RLS가 followers/private 필터)
users.publicStreak(userId)             → number              // 타인 스트릭 카운트 (공개)
users.isHandleAvailable(handle)        → boolean             // 닉네임 중복 검사 (본인 제외)
users.publicShelf(userId)              → UserBook[]          // v7.2: 타인 책장 — 읽는 중+완독(status 포함) (#4)
users.bookContrib(userId, bookId)      → {userBook, sentences[]}  // v7.2: 그 사람의 그 책 평점·후기·한 문장 (#5)

// 운영 대시보드 — is_admin=true 전용 (#161, Phase 2 기본)
admin.stats()                          → {users, sentences, completed, todaySessions}  // count 집계 4종(todaySessions=reading_sessions 오늘)
admin.inquiries()                      → Inquiry[]           // v7.2: 문의 목록 (RLS: is_admin)

// 문의 (설정 → 운영자) v7.2
inquiries.create({message, email?})    → Inquiry             // 09_inquiries.sql. LLM 자동처리는 Phase 2(Gemini)

// 스포일러 (read-side 계산, 저장 컬럼 없음)
spoiler.myCurrentPage(bookId)              → int             // 블라인드 판정용 (§social)

// 마을
villages.create({bookId, name, visibility, parts[]}) → Village
villages.join(villageId, {code?})
villages.leave(villageId)                                   // v7.2: 마을 탈퇴 (#9)
villages.listMine() / villages.listPublic({limit}) / villages.get(villageId)
villages.members(villageId)                → VillageMember[]
villages.ranking(villageId)                → 누적 페이지 순위

// AI (Phase 0 하드코딩 / Phase 1+ Gemini 프록시 §7.9)
ai.recommendBooks(userBookId)              → {title, reason}[]   // 나↔책 fit
ai.extractBook(userBookId)                 → 추출 책 요약
```

> 휴식코스(Pause) 관련 메서드(`pause.start(days)` 등)는 **상세 미정** — `systems.md`(승원)에서 기간·빈도·스트릭 동결 규칙 확정 후 본 계약에 추가.

### 7.3 데이터 모델 (관계형 — Phase 1 기준)

> Phase 0 은 아래 구조를 localStorage JSON 으로 미러링(§7.8). 컬럼명·관계 동일하게 유지해 Phase 1 이관 시 1:1 매핑.

```
users
  id                    uuid PK
  handle                text UNIQUE
  display_name          text
  avatar_url            text
  bio                   text NULL
  timezone              text                 -- "Asia/Seoul"
  is_npc                bool DEFAULT false
  daily_pace            int  NULL            -- NPC 전용
  active_user_book_id   uuid NULL FK user_books.id   -- 현재 활성 책
  settings              jsonb DEFAULT '{}'   -- 알림 시간 등
  xp                    int  DEFAULT 0
  created_at            timestamptz
  -- v7 제거: is_operator (운영자 짹 폐기)
  -- 성(🏰) 개수는 user_books(status='completed') 에서 파생 — 별도 컬럼 없음

books
  id            uuid PK
  isbn13        text UNIQUE
  title         text
  author        text
  publisher     text
  total_pages   int
  cover_url     text
  rank_recent   int  NULL
  rank_steady   int  NULL
  created_at    timestamptz

chapters                                    -- Phase 후순위, 현재 미사용 (챕터 XP 후순위)
  id            uuid PK
  book_id       uuid FK books.id
  title         text
  start_page    int
  end_page      int
  chapter_order int

user_books
  id            uuid PK
  user_id       uuid FK users.id
  book_id       uuid FK books.id
  status        text                 -- 'reading' | 'completed' | 'archived'
  current_page  int  DEFAULT 0
  rating        numeric(2,1) NULL    -- v7 신설. 완독 별점 0.5~5, 0.5 단위(반별점) (선택)
  review_text   text NULL            -- v7 신설. 완독 소감 (선택)
  started_at    timestamptz
  completed_at  timestamptz NULL
  UNIQUE(user_id, book_id)

reading_sessions
  id               uuid PK
  user_book_id     uuid FK user_books.id
  user_id          uuid                 -- 비정규화
  session_date     date
  current_page     int
  pages_read_today int
  xp_earned        int
  created_at       timestamptz
  UNIQUE(user_book_id, session_date)

sentences                                   -- "한 문장" (DB 테이블명 유지, 앱 용어는 "한 문장")
  id            uuid PK
  user_id       uuid FK users.id
  user_book_id  uuid FK user_books.id
  session_id    uuid FK reading_sessions.id NULL
  page          int                  -- 스포일러 블라인드 판정 기준 (§social)
  text          text                 -- 원문 인용. 1~200자 (CHECK + 클라, 04_constraints.sql)
  my_note       text NULL            -- 내 감상·코멘트 (선택, 사후 추가·편집). ≤1000자 (CHECK)
  visibility    text default 'public' -- v7.2: 'public'|'followers'|'private' 3단계. RLS 강제 (§social 5.7.1, 06_privacy_v2.sql). is_private(boolean) 대체
  is_private    boolean default false -- DEPRECATED (v7.1→v7.2 visibility 마이그레이션 후 미사용. 마이그레이션 호환 위해 컬럼 보존)
  note_private  boolean default false -- v7.1: 감상만 비공개 (클라 존중 — 컬럼 단위 RLS 불가)
  created_at    timestamptz
  -- v7 제거: chapter_id (챕터 자동매핑 폐기)

streak
  user_id              uuid PK FK users.id
  current              int  DEFAULT 0
  longest              int  DEFAULT 0
  last_check_in_date   date
  shields_remaining    int  DEFAULT 0
  first_shield_granted bool DEFAULT false

shield_log
  id           uuid PK
  user_id      uuid FK users.id
  consumed_at  timestamptz
  refunded     bool DEFAULT false

follows
  follower_id   uuid FK users.id
  following_id  uuid FK users.id
  created_at    timestamptz
  PRIMARY KEY (follower_id, following_id)

claps                                       -- "짹" = 한 문장 좋아요
  id              uuid PK
  from_user_id    uuid FK users.id
  to_sentence_id  uuid FK sentences.id      -- v7 변경: to_session_id → to_sentence_id
  created_at      timestamptz
  UNIQUE(from_user_id, to_sentence_id)

pokes                                       -- "콕찌르기" 🪱 (미기록 친구 독려)
  id              uuid PK
  from_user_id    uuid FK users.id
  to_user_id      uuid FK users.id
  day             date                 -- 일자별 1회 제한
  created_at      timestamptz
  UNIQUE(from_user_id, to_user_id, day)

npc_sentence_seeds
  id        uuid PK
  npc_id    uuid FK users.id (where is_npc=true)
  text      text
  weight    int DEFAULT 1

wish_books                                  -- 관심 책
  id          uuid PK
  user_id     uuid FK users.id
  book_id     uuid FK books.id
  created_at  timestamptz
  UNIQUE(user_id, book_id)

sentence_bookmarks                          -- 책갈피 (관심 한 문장)
  id           uuid PK
  user_id      uuid FK users.id
  sentence_id  uuid FK sentences.id
  created_at   timestamptz
  UNIQUE(user_id, sentence_id)

villages                                    -- v7 신설. 마을 = 책 1권 단위 그룹
  id            uuid PK
  book_id       uuid FK books.id
  name          text
  description   text NULL
  visibility    text                 -- 'public' | 'private'
  invite_code   text NULL            -- 비공개 입장 코드
  created_by    uuid FK users.id
  created_at    timestamptz

village_parts                               -- v7 신설. 마일스톤 (책을 N파트로 분할)
  id            uuid PK
  village_id    uuid FK villages.id
  part_order    int
  title         text NULL
  end_page      int                  -- 이 파트의 끝 페이지
  due_date      date
  UNIQUE(village_id, part_order)

village_members                             -- v7 신설
  village_id    uuid FK villages.id
  user_id       uuid FK users.id
  joined_at     timestamptz
  PRIMARY KEY (village_id, user_id)

inquiries                                   -- v7.2 신설 (09_inquiries.sql) — 운영자 문의
  id            uuid PK
  user_id       uuid FK users.id NULL
  email         text NULL
  message       text                 -- 1~2000자 CHECK
  status        text DEFAULT 'open'  -- open | answered | closed
  app_version   text NULL            -- QA3: 작성 시점 RG_VERSION (어느 버전 문제/해결인지, 10_inquiry_version.sql)
  created_at    timestamptz
  -- RLS: 본인 insert/select + is_admin() select·update. LLM 자동분류는 Phase 2. email=작성시점 auth 이메일(답장용)

-- v7 제거: operator_replies 테이블 전체 (운영자 짹 폐기)
```

> **휴식코스(Pause)**: 채택됐으나 상세(기간·빈도·스트릭 동결) 미정. `systems.md`(승원) 확정 후 `pause_log` 류 테이블을 본 절에 추가.

JSONB 사용:
- `users.settings` — `{"reminder_hour": 21}` (알림은 Phase 2 PWA 이후 실동작)
- 그 외 관계형 컬럼. JSON 남발 금지.

### 7.4 인덱스

```
follows(follower_id), follows(following_id)
sentences(user_id, created_at desc), sentences(user_book_id, created_at)
reading_sessions(user_id, session_date desc)
books(rank_recent), books(rank_steady)
claps(to_sentence_id)                          -- v7 변경 (구 to_session_id)
pokes(to_user_id, day)
users using gin (handle gin_trgm_ops)
books using gin (title gin_trgm_ops)
wish_books(user_id, created_at desc)
sentence_bookmarks(user_id, created_at desc)
village_members(user_id), village_members(village_id)   -- v7 신설
village_parts(village_id, part_order)                    -- v7 신설
-- v7 제거: operator_replies 인덱스, 리그 보조 인덱스(리그 기능 삭제)
```

### 7.5 RLS 정책 (요약)

- `users`: 본인 row update. 다른 유저 select 가능 (피드용 공개 정보)
- `sentences`: select = `visibility='public' OR user_id=auth.uid() OR (visibility='followers' AND 양방향 follows 존재)` (v7.2 — 3단계 공개 범위, §social 5.7.1, 06_privacy_v2.sql). insert/update 본인만
- `reading_sessions`, `streak`, `user_books`: insert/update 본인. select 모두 (마을 그리드·완독 별점 공개)
- `follows`: follower_id가 본인인 행만 insert/delete
- `claps`: from_user_id가 본인인 행만 insert
- `pokes`: from_user_id가 본인인 행만 insert. to_user_id가 본인이면 select (수신 확인용)
- `wish_books`, `sentence_bookmarks`: 본인만 insert/select/delete
- `inquiries` (v7.2): 본인만 insert(user_id=auth.uid()). select = 본인 OR `is_admin()`. update = `is_admin()`만(상태 변경)
- `village_members` (v7.2): leave = 본인 행 delete (마을 탈퇴, #9)
- `villages`: 누구나 공개 마을 목록 select. insert는 로그인 사용자. `village_members` 의 멤버만 피드/멤버 현황 select (구경 불가는 §village 에서 규정)
- `village_members`: 본인 가입/탈퇴만 insert/delete
- v7 제거: `operator_replies` RLS (운영자 짹 폐기)

### 7.6 닉네임 RPC

```
POST /rpc/check_handle  { handle }
→ { ok: true } | { ok: false, reason: 'taken' | 'format' | 'banned' }
```

### 7.7 가입 전 데이터 동기화 (DataStore 어댑터 전환점)

가입 전 첫 책 등록 wedge 는 **Phase 1 에서도 로컬 계층을 요구**한다 (온보딩 §C → OAuth → 동기화). DataStore 관점에서 이는 *localStorageAdapter 가 보관한 pending 데이터를 supabaseAdapter 가 흡수*하는 1회성 흐름.

클라이언트는 가입 전 입력을 localStorage 보관:

```json
{
  "pending_book":     { "isbn13": "...", "title": "...", "total_pages": 300, "current_page": 5 },
  "pending_sentence": { "text": "...", "page": 5 }
}
```

OAuth 콜백 직후 동기화 → localStorage 비움:

1. `books` upsert by ISBN
2. `user_books` insert (status=reading, current_page) → `user_books.id` 받음
3. `users.active_user_book_id` = 위 id
4. `reading_sessions` insert (당일)
5. `sentences` insert
6. `streak` 초기화 (current=1, last_check_in_date=today)

### 7.8 다중 책 / 활성 책 전환

- `user_books` 다수 행 보유 가능 (status='reading' 여러 권)
- `users.active_user_book_id`가 현재 활성 책 가리킴 (NULL 가능: 책 없을 때)
- 활성 책 전환 = `users.active_user_book_id` UPDATE만으로 끝 (`DataStore.activeBook.set`)
- 둥지 진화 배너는 활성 책 진척률(`current_page/total_pages`)을 그린다 ([§5.2](./nest.md))
- **각 책의 진척·세션·문장은 `user_book_id` 단위로 분리 저장되므로 책 전환 시 데이터 손실 없음**

Phase 0 (localStorage, `rg_v41`):

```json
{
  "user_books": [
    { "id": "uuid", "book": { ... }, "current_page": 72, "rating": null, "sessions": [...], "sentences": [...] },
    { "id": "uuid", "book": { ... }, "current_page": 5,  "rating": null, "sessions": [...], "sentences": [...] }
  ],
  "active_user_book_id": "uuid"
}
```

### 7.9 AI 도서 추천 — 호출 경로 (Phase 1+)

나↔책 fit 기반 추천 ([§5.8](./profile.md)). 비용·보안 주의:

- **모델**: Gemini Flash **무료 티어** (Google AI Studio 키). 완독 1회당 1호출 → 무료 한도 내. 비용 0 이므로 "외부 API 비용 기각" 정책과 충돌 없음.
- **API 키 보호**: 클라이언트 JS 에 키 노출 금지. **서버리스 프록시**(Supabase Edge Function 또는 Netlify Functions)가 키를 쥐고 호출.
- **Phase 0**: 카테고리별 하드코딩 추천 3권 시뮬 (실 호출 없음).
- **프라이버시**: 무료 티어는 입력이 학습에 쓰일 수 있음 — 데모 범위 무방. 유료 전환 시 해제.

---
