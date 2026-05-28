# 백엔드 스펙 (플랫폼·인증·데이터 모델)

> **Split from** `docs/readinggo-spec.md` v5 (2026-05-26 분할). 원 위치: §7. 변경 이력은 git log 참조.

## 7. 백엔드 스펙

### 7.1 플랫폼

**Supabase** (Phase 1+). Auth + PostgreSQL + Storage + pg_cron.

| 역할 | 컴포넌트 |
|---|---|
| 인증 | Supabase Auth (Google OAuth) |
| DB | PostgreSQL + RLS |
| 표지 | Storage 또는 외부 URL (`books.cover_url`) |
| 배치 | pg_cron (UTC 15:00 일일, 월 00:00 주간) |
| 풀텍스트 보조 | `pg_trgm` extension |

### 7.2 인증

Supabase Auth Google Provider. Phase 0은 가짜 세션 localStorage.

### 7.3 데이터 모델 (관계형)

```
users
  id                    uuid PK
  handle                text UNIQUE
  display_name          text
  avatar_url            text
  timezone              text                 -- "Asia/Seoul"
  is_npc                bool DEFAULT false
  is_operator           bool DEFAULT false   -- v5 신설. 운영자 권한
  daily_pace            int  NULL            -- NPC 전용
  active_user_book_id   uuid NULL FK user_books.id   -- 현재 활성 책
  settings              jsonb DEFAULT '{}'   -- 알림 시간, 비공개 모드 등
  xp                    int  DEFAULT 0
  created_at            timestamptz

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

chapters
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

sentences
  id            uuid PK
  user_id       uuid FK users.id
  user_book_id  uuid FK user_books.id
  session_id    uuid FK reading_sessions.id NULL
  page          int
  text          text                 -- 원문 인용. 200자 이내 (클라이언트 검증)
  my_note       text NULL            -- v5 신설. 내 감상·코멘트 (선택). 길이 제한 없음 (UI 권장 500자)
  chapter_id    uuid NULL FK chapters.id  -- v5 신설. 인용된 페이지가 속한 챕터 (자동 매핑)
  is_private    bool DEFAULT false
  created_at    timestamptz

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

claps
  id              uuid PK
  from_user_id    uuid FK users.id
  to_session_id   uuid FK reading_sessions.id
  created_at      timestamptz
  UNIQUE(from_user_id, to_session_id)

pokes
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

wish_books
  id          uuid PK
  user_id     uuid FK users.id
  book_id     uuid FK books.id
  created_at  timestamptz
  UNIQUE(user_id, book_id)

sentence_bookmarks
  id           uuid PK
  user_id      uuid FK users.id
  sentence_id  uuid FK sentences.id
  created_at   timestamptz
  UNIQUE(user_id, sentence_id)

operator_replies                            -- v5 신설
  id              uuid PK
  to_sentence_id  uuid FK sentences.id      -- 사용자가 입력한 모이
  from_user_id    uuid FK users.id          -- 운영자 (is_operator=true)
  text            text                       -- 200자 이내
  reply_kind      text                       -- 'welcome'|'daily'|'graduation'|'comeback'|'manual'
  created_at      timestamptz
  UNIQUE(to_sentence_id, from_user_id)
```

JSONB 사용:
- `users.settings` — `{"reminder_hour": 21, "private_mode": false}`
- 그 외 관계형 컬럼. JSON 남발 금지.

### 7.4 인덱스

```
follows(follower_id), follows(following_id)
sentences(user_id, created_at desc), sentences(user_book_id, created_at)
reading_sessions(user_id, session_date desc)
reading_sessions(user_id, session_date) where session_date >= date_trunc('week', current_date)  -- 리그 쿼리 보조
books(rank_recent), books(rank_steady)
pokes(to_user_id, day)
users using gin (handle gin_trgm_ops)
books using gin (title gin_trgm_ops)
wish_books(user_id, created_at desc)
sentence_bookmarks(user_id, created_at desc)
operator_replies(to_sentence_id), operator_replies(from_user_id, created_at desc)
```

### 7.5 RLS 정책 (요약)

- `users`: 본인 row update. 다른 유저 select 가능 (피드용 공개 정보)
- `sentences`: `is_private=true`면 본인만 select. 그 외 모두 select. insert는 본인만
- `reading_sessions`, `streak`, `user_books`: insert/update 본인. select 모두
- `follows`: follower_id가 본인인 행만 insert/delete
- `claps`: from_user_id가 본인인 행만 insert
- `pokes`: from_user_id가 본인인 행만 insert. to_user_id가 본인이면 select (수신 확인용)
- `operator_replies`: insert는 `is_operator=true` 사용자만. select 는 to_sentence 의 작성자와 모든 사용자(공개 카드용)
- `users.is_operator`: 직접 update 불가. Supabase admin 또는 service role 만 토글 가능

### 7.6 닉네임 RPC

```
POST /rpc/check_handle  { handle }
→ { ok: true } | { ok: false, reason: 'taken' | 'format' | 'banned' }
```

### 7.7 가입 전 데이터 동기화

Phase 1: 클라이언트는 가입 전 입력을 localStorage 보관:

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
- 활성 책 전환 = `users.active_user_book_id` UPDATE만으로 끝
- The Path 쿼리: `reading_sessions where user_book_id = users.active_user_book_id order by session_date asc`
- **각 책의 진척·세션·문장은 `user_book_id` 단위로 분리 저장되므로 책 전환 시 데이터 손실 없음**

Phase 0 (localStorage):

```json
{
  "user_books": [
    { "id": "uuid", "book": { ... }, "current_page": 72, "sessions": [...], "sentences": [...] },
    { "id": "uuid", "book": { ... }, "current_page": 5,  "sessions": [...], "sentences": [...] }
  ],
  "active_user_book_id": "uuid"
}
```

---

