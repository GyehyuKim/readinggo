# 백엔드 스펙 (플랫폼·인증·DataStore 계약·데이터 모델)

> **Split from** `docs/2. specifications/_archive/readinggo-spec.md` v6 (2026-05-28 분할). 원 위치: §7.
> **v7 갱신 (2026-06-01)**: web-first 재정의. Capacitor 보류 → 순수 웹(Phase 0/1). 운영자 짹·스포일러 컬럼(`is_private`)·`chapter_id` 자동매핑 제거, 완독 별점·소감·마을 테이블 추가, **DataStore 계약(§7.2) 신설**. 변경 이력은 git log 참조.
> **v7.1 갱신 (2026-06-04, QA 2차)**: `is_private` 재도입 + `note_private`, **DB CHECK 제약**(`04_constraints.sql`), 닉네임 규칙 `{2,20}`, 이메일 **autoconfirm**(베타 한정). [decisions §8.1](./meta/decisions.md).
> **v7.2 갱신 (2026-06-04, post-beta 2)**: ⚠️ `is_private` binary → **`visibility` 3단계**(public/followers/private, `06_privacy_v2.sql`), `admin.stats()`·`claps.isMine`·`friends.unfollow/isFollowing`·`users.public*`·`sessions.calendar` 계약 추가, 마을 Supabase 연동·이메일 브랜딩. [decisions §8.2/§8.3](./meta/decisions.md).
> **v8 갱신 (2026-06-24, #968)**: **네이티브 OAuth 딥링크**. Capacitor 채택(§7.1 모바일/네이티브 갱신)으로 네이티브 앱 구글 로그인이 외부 브라우저(`https://localhost` 복귀)에 멈추던 문제 해결 — 네이티브일 때 `redirectTo=com.readinggo.app://login-callback`(커스텀 스킴) + PKCE + `appUrlOpen` 복귀. 웹 분기 무변경.
> **v9 갱신 (2026-06-24, #937)**: **카카오 소셜 로그인 추가** + **애플**(iOS·웹만 노출, Android 제외) + **네이버 보류**. `signInWithGoogle`을 `signInWithOAuth(provider)`로 일반화 — 같은 네이티브 딥링크 경로(#968)를 모든 provider 가 공유. provider 등록(Supabase 대시보드 + Kakao Developers + Apple Developer)은 §7.1 모바일/네이티브 끝의 체크리스트 참조.
> **v10 갱신 (2026-06-26, #1007)**: **독서 위키 Q&A — `POST /api/wiki-ask`** 신설(§7.9.2). "내 문장에게 묻기"의 호출 경로 — companion 형제 프록시(동일출처 가드·`callLLM` 키 서버 보관). 내가 모은 문장에만 근거(그라운딩·환각 가드), 질문당 1콜(Gemini Flash 텍스트, AI lock 안), RAG 불필요(전체 문장 한 프롬프트).
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.

## 7. 백엔드 스펙

### 7.1 플랫폼

**web-first.** Phase 0 은 백엔드 없이 정적 웹으로, Phase 1 부터 Supabase 를 붙인다. 두 단계는 **DataStore 계약(§7.2)** 으로 추상화되어, 피처 코드는 어느 Phase 인지 모른 채 동일 인터페이스만 호출한다.

| 항목 | Phase 0 (정적 웹 데모) | Phase 1+ (Supabase) |
|---|---|---|
| 데이터 저장 | `localStorage` (키 `rg_v41`) + Supabase `books` 카탈로그 (#490; 구 정적 TSV 제거 #972) | PostgreSQL + RLS |
| 인증 | 없음 (가짜 세션 localStorage) | Supabase Auth (Google · Kakao · Apple OAuth — #937. 네이버 보류) |
| 배치 | 없음 (날짜 시뮬레이터로 대체, §발표용) | pg_cron (UTC 15:00 일일, 월 00:00 주간) |
| AI 도서 추천 | 하드코딩 추천 시뮬 | **Gemini Flash 무료 티어** + 서버리스 프록시 (§7.9) |
| 표지 이미지 | 알라딘 CDN URL (`books.cover_url`) | 동일 + Storage 옵션 |
| 풀텍스트 보조 | 클라이언트 fuzzy (Fuse.js + 자모 분해) | + `pg_trgm` 서버 보조 |

**플랫폼 결정 (v7):**

- **빌드**: 현행 React 18 CDN + Babel standalone 유지 (빌드 도구 없음). Vite 전환은 **PWA 전환 시 재검토** (현재 보류).
- **배포**: **Cloudflare Workers** — Worker `readinggo`, `https://readinggo.hyuniverse.workers.dev`. (Netlify → Cloudflare 이전 완료, GitHub Pages 폐기.) 재배포: `npx wrangler deploy`.
- **모바일/네이티브 (v8 갱신)**: **Capacitor 채택** — iOS·Android 앱스토어 셸([iOS-PLAN](../iOS-PLAN.md), Stack Lock). 네이티브 앱 **소셜 로그인은 OAuth 딥링크로 복귀**한다(#968, v9 #937 로 provider 일반화): 네이티브 WebView 의 web-origin(`https://localhost`) 복귀는 외부 브라우저에 멈추므로, `isNative()` 일 때 `redirectTo=com.readinggo.app://login-callback`(AndroidManifest 커스텀 스킴 intent-filter) + **PKCE** + 인앱 브라우저(`@capacitor/browser`)로 열고, 복귀는 `@capacitor/app` 의 `appUrlOpen` → `exchangeCodeForSession` → `onAuthStateChange` 자동 발화. **전제: Supabase 대시보드 Auth→URL Configuration→Redirect URLs 에 그 스킴 등록.** 웹 플로우는 `redirectTo=origin` 그대로(분기). 이 경로는 provider 무관(google·kakao·apple 공통). 이메일 매직링크 네이티브 복귀는 후속(현재 네이티브는 소셜 로그인/게스트 권장). 네이티브 변경이라 OTA 불가 — 새 빌드 필요. **⚠️ 함정(#1009)**: 위 네이티브 분기는 `isNative()`=true 일 때만 돈다. `setup-globals` 가 네이티브 런타임이 주입한 `window.Capacitor`(브리지)를 **번들 `@capacitor/core` 인스턴스로 덮으면** 브리지와 분리돼 `isNativePlatform()`=false → 분기를 못 타고 다시 웹(외부 브라우저)으로 샌다(=#968 이전 증상 재현). → 브리지를 **덮지 말고 보존**(`if (!window.Capacitor) …`), 네이티브 여부는 로드 시점 `window.RG_NATIVE` 플래그로 확정해 신뢰한다. **⚠️ 함정(#1011)**: 네이티브는 딥링크 복귀라 **페이지 리로드가 없다** → OAuth 성공·세션 복원 후에도 `showLogin` 이 풀리지 않아 로그인 화면이 그대로 남는다(웹은 `redirectTo=origin` 리디렉트 리로드가 화면 상태를 초기화해 이 증상을 가린다). → 인증 성공(`authUser` 채워짐) 시 `setShowLogin(false)` 로 로그인 화면을 **명시적으로 닫아야** 한다(app.js, `authUser` 의존 effect).
- **소셜 로그인 provider (v9, #937)**: 지원 = **Google · Kakao · Apple**. **네이버는 보류**(Supabase 가 기본 provider 로 미지원 — generic OIDC/커스텀 토큰 교환이 필요해 별도 작업, 지금은 안 만든다). **애플 버튼은 iOS·웹에서만 노출**하고 Android 에선 숨긴다(`Capacitor.getPlatform() !== 'android'`): Google Play 는 "제3자 로그인 제공 시 Apple 로그인도 제공" 의무가 없어 굳이 안 띄운다([iOS-PLAN](../iOS-PLAN.md) Android-first 메모). 반대로 **iOS App Store 가이드라인 4.8** 은 타사 소셜 로그인을 쓰면 Apple 로그인 동등 제공을 요구 → iOS 출시 시 애플 버튼 필수(그래서 코드에 이미 포함, iOS·웹 노출). UI 는 각 provider **브랜드 가이드 색**을 따른다(카카오 `#FEE500`/검정 글씨·말풍선, 애플 검정 버튼/흰 로고) — DESIGN.md 그린 버튼 위계의 명시적 예외(OAuth 버튼은 제공자 규정 우선, 기존 Google 흰색 버튼과 동일 형태로 정렬).
  - **provider 등록 체크리스트 (코드 외 — 사람이 콘솔에서 1회 설정)**:
    - **Kakao**: [Kakao Developers](https://developers.kakao.com) 앱 생성 → REST API 키 발급 → 카카오 로그인 활성화 + 동의항목(이메일 등) → **Redirect URI** 에 Supabase 콜백(`https://<project>.supabase.co/auth/v1/callback`) 등록 → Supabase 대시보드 Auth→Providers→**Kakao** enable + REST API 키/Client Secret 입력.
    - **Apple**: [Apple Developer](https://developer.apple.com)(유료 $99/yr) → App ID + **Services ID** 생성, Sign in with Apple 활성화 → **Return URL** 에 Supabase 콜백 등록 → Sign in with Apple **Key(.p8)** 발급 → Supabase 대시보드 Auth→Providers→**Apple** enable + Services ID·Team ID·Key ID·.p8 입력. (Apple Dev 결제·활성화 대기는 iOS 출시 트랙 — [iOS-PLAN §8](../iOS-PLAN.md).)
    - **공통**: Supabase Auth→URL Configuration→**Redirect URLs** 에 웹 origin + 네이티브 스킴(`com.readinggo.app://login-callback`) 둘 다 등록(#968).
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
auth.currentUser()                         → User | null     // #646: 클라 인증 판정은 getSession()(로컬 스토리지, 무네트워크). getUser()(매 호출 서버 토큰검증)는 모바일 네트워크 불안정 시 null로 떨어져 로그인 유저가 조용히 게스트(localStorage) 고착 → my_note(대화) 등 데이터 안 보임. uid()도 동일.
auth.signInWithOAuth(provider)             → User           // v9 #937: 소셜 로그인 일반화. provider ∈ {'google','kakao','apple'}(미지원 값은 throw). 네이티브/웹 분기·딥링크 복귀는 provider 무관 공통(#968). Google 만 queryParams `prompt=select_account`(#721) 부착, kakao/apple 은 미부착.
auth.signInWithGoogle() / signInWithKakao() / signInWithApple() → User  // 위 signInWithOAuth 의 provider별 얇은 래퍼(기존 호출부 회귀 방지). #721 prompt=select_account 는 Google 한정. #968: 네이티브는 커스텀 스킴 딥링크(`com.readinggo.app://login-callback`)+PKCE+`appUrlOpen` 복귀, 웹은 origin 복귀(§7.1 모바일/네이티브). 애플 버튼 노출은 iOS·웹만(Android 제외, §7.1).
//   ↳ #822 쓰기 실패·세션 만료 계약: 위 getSession() 로컬 판정 때문에 access_token 만료/무효(서버 401)여도 "로그인됨"으로 표시될 수 있다. 그 상태의 쓰기(myBooks.add·sessions.addToday·sentences.add·activeBook.set 등)는 user_books 행이 안 생기고 read도 빈 결과 → 서재 비고 체크인 'user_book 미해소'. **쓰기 실패는 silent 금지**: `surfaceWriteError()`(app.js)가 ① getUser()(네트워크 토큰검증) → ② refreshSession() 시도 → ③ 그래도 무효면 '세션 만료' 토스트 + 재로그인 화면(RG_login). 세션 유효한 일시 오류는 재시도 안내만.
//   ↳ #822 체크인 귀속 계약: 등록·활성화로 화면 책을 세팅하는 경로(handleSearchSelectBook·handleActivateUserBook, 그리고 buildStateFromSupabase)는 `appState.book.ubId`(=user_books.id)를 함께 채운다. 체크인은 1순위로 ns.book.ubId 로 user_book 을 해소(없으면 book_id 폴백) → 잘못된 귀속/저장 누락 방지.
profile.get(userId?)                       → User
profile.update({display_name, avatar_url, bio})
settings.get() / settings.update({reminder_hour, ...})

// 책 / 검색
books.search(query)                        → Book[]          // DB ilike(즉시) — 클라에서 데모 Fuse + 알라딘 결과와 병합·중복제거(isbn13). 외국 작가 표기변이는 알라딘 위임 (QA3 #148)
// 도서 프록시(Cloudflare Worker `worker/index.mjs` `/aladin`, 별칭 `/.netlify/functions/aladin`): **ItemSearch(검색)는 packing을 줘도 itemPage 미제공** — 쪽수는 **ItemLookUp(?isbn=)만** 반환. 등록 시 쪽수 없으면 isbn 개별 조회로 1회 보강 (QA7 #233). 그래도 없으면 total_pages=null → 수동 입력 폴백(#204)
// 외서 균형 보강(#302): 검색이면 **국내(알라딘) 최대 5 + 외서(Google Books) 최대 5 = 총 ≤10**, isbn13/title 중복제거. Google 키는 `GOOGLE_BOOKS_API_KEY`(무키 시 레이트리밋). ISBN 단건 조회엔 미적용.
// 책 소개·풀 메타(#316→#489): 검색·ISBN 조회 응답에 알라딘 풀 메타(`description` 등) 첨부. **#489: `normalize()` 가 books 풀 메타 컬럼(위 테이블)을 채워 upsert** → archive·검색 양 경로 공통 반영(이전엔 description 컬럼 부재로 미반영).
// 검색 도서 자동 저장(#489): `aladinProxy` 가 알라딘 결과를 `ctx.waitUntil` 백그라운드로 books upsert(`on_conflict=isbn13`). 검색(ItemSearch)은 itemPage 누락 잦아 **저장 직전 ISBN 보강**(위 QA7). Google 외서는 우리 컬럼 매핑분만 + `source='google'`. 응답 지연 0(upsert는 응답과 분리).
// 외서·빈필드 폴백 체인(#489): 등록 시 **알라딘 → Google Books → OpenLibrary** 순으로 빈 필드만 non-destructive merge(표지: Google thumbnail → OpenLibrary covers). 끝내 빈 `description`은 **LLM 보강 허용**(solar-pro3/Gemini, **결과를 books DB ISBN 매칭해 환각 필터**, 사실성 부담 큰 쪽수·가격엔 미적용). `source`·`enriched_at` 로 출처·재보강 추적. 신뢰 카피 차등은 [nest.md/library 추천 #496] 참조.
// 인기도서 사전 아카이브(#239): `worker/index.mjs` `scheduled()`(cron 0 18 * * *) — 알라딘 베스트셀러→ItemLookUp→books upsert(service_role). 등록 지연 0·API 의존 감소. env: SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY·ARCHIVE_DAILY_CAP(기본3000)
books.get(bookId)                          → Book
myBooks.list()                             → UserBook[]      // 읽는 중 + 완독 + 중단(aborted). publisher/total_pages는 override 병합값(#431)
myBooks.add({book, current_page})          → UserBook
myBooks.updateBook(userBookId, {publisher?, total_pages?}) → UserBook  // #410/#431: user_books.*_override 저장(공유 books 미수정)
myBooks.abort(userBookId)                  → UserBook        // #593: 읽던 책 중단 — status='aborted'. current_page 보존(진척 손실 없음), 활성 책이면 active 해제. 되돌리기 가능
myBooks.resume(userBookId)                 → UserBook        // #593: 중단 책 다시 읽기 — status='aborted' → 'reading'. completed_at 미설정(완독과 무관)
activeBook.get()                           → UserBook | null
activeBook.set(userBookId)                                  // = users.active_user_book_id UPDATE

// 일일 기록 (세션 + 한 문장)
sessions.addToday({userBookId, page, duration_sec?}) → Session  // 하루 첫 기록: 세션 생성 + 스트릭/XP. duration_sec(#430): 읽기 세션 시간(초) 누적
sessions.list(userBookId)                  → Session[]
sentences.add({userBookId, sessionId, page, text, my_note?, kind?}) → Sentence  // kind(#360): 사실상 **quote 단일**. '내 생각'(thought) 폐기(#596, [nest.md §147]) — 입력 경로 제거·add 는 kind:'quote' 고정·기존 thought 행 quote 전환(27_extinct_thought.sql). kind 컬럼은 롤백 안전상 유지. '내 생각'은 my_note(문장 앵커)로. 20_sentence_kind.sql
sentences.setNote(sentenceId, my_note)                       // 사후 감상 추가·편집 (작성 시점 무관, §profile 5.8.4)
sentences.listByBook(userBookId)           → Sentence[]      // 내 책(user_book) 한 문장
sentences.byBook(bookId, {limit?, sort?})  → Sentence[]      // 그 책(books.id)의 *타인* 공개 한 문장(#11). 본인 제외(neq user_id), 비-UUID id → []. sort='likes'(#594): 좋아요 많은 순 Top N(clap_count embed), 기본 'recent'(최신순). 각 행에 clapCount 부착
sentences.feed({cursor})                   → Sentence[]      // 최근(전체 공개) 피드 (§social)
sentences.feedFollowing({limit})           → Sentence[]      // v7.1: 팔로우 피드
sentences.feedRecommended({limit})         → Sentence[]      // v7.1: 추천(공유 책 유사도, 비면 최근 폴백)
sentences.setVisibility(id, {visibility?, note_private?})    // v7.2: visibility 3단계(public|followers|private) + 감상 note_private
sentences.listMine()                       → Sentence[]
sentences.random()                         → Sentence        // 무작위 회상 — 내 과거 한 문장 1개 (§profile 5.8.7)

// 스트릭 / XP / 성(XP 주기 완료)
streak.get()                               → Streak
streak.bumpOnCheckIn()                                      // 입력 즉시 호출
xp.get() / xp.add(amount, reason)
books.complete(userBookId, {rating?, review_text?})         // 완독 상태·별점·소감 저장. 성 직접 지급 없음
castles.list()                             → Castle[]        // DB 조회 없이 users.xp 파생. length=floor(totalXp/1600)

// 일일 기록 (추가)
sessions.calendar(days?)               → {readDates, shieldDates}  // 스트릭 캘린더 — 최근 N일(기본 35) 읽은/방패 날짜
sessions.heatmap(days?)                → [{date, pages}]           // v7.2: 활동 히트맵(#195) — 일별 읽은 쪽수 합(기본 182일)

// 소셜 (좋아요 / 관심책 / 콕찌르기 / 팔로우)
claps.toggle(sentenceId)               → boolean            // ❤️ 좋아요 = 한 문장 반응+저장 단일화 (#641, true=liked). 자기 문장도 허용(self=저장, XP 비부여)
claps.isMine(sentenceId)               → boolean            // 내가 좋아요했는지 — SentenceCard 초기 상태 로드 (#156)
claps.list()                           → {sentence_id, sentence}[]  // #641: 내가 좋아요한 문장(sentence 임베드) — '좋아요한 문장 모아보기'(profile §5.8.8). 구 bookmarks.list 대체
// ~~bookmarks.toggle / bookmarks.list~~ — #641 폐기(claps로 흡수, sentence_bookmarks deprecate)
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
users.publicWishlist(userId)           → WishBook[]          // v8.2: 타인 위시리스트 — wishlist_public=true인 경우만 반환, 아니면 [] (#558)
users.bookContrib(userId, bookId)      → {userBook, sentences[]}  // v7.2: 그 사람의 그 책 평점·후기·한 문장 (#5)

// 운영 대시보드 — is_admin=true 전용 (#161, Phase 2 기본)
admin.stats()                          → {users, realUsers, sentences, completed, todaySessions, trend[]}  // v7.2: 실사용자(NPC제외)·최근7일 추세 추가(#190 A+B)
admin.inquiries()                      → Inquiry[]           // v7.2: 문의 목록 (RLS: is_admin)

// 문의 (설정 → 운영자) v7.2
inquiries.create({message, email?})    → Inquiry             // 09_inquiries.sql + app_version(10) + response/answered_at(11_inquiry_response.sql, #208)
// 답변: inquiries.response/answered_at 컬럼 존재. LLM(Hermes/Gemini) 자동응답·기록은 Phase 2 — 현재 admin UI는 스캐폴드(#208)

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
  wishlist_public       bool DEFAULT false   -- v8.2 #558: 위시리스트 타인 공개 여부
  created_at            timestamptz
  -- v7 제거: is_operator (운영자 짹 폐기)
  -- 성(🏰) 개수는 floor(xp / 1600) 에서 파생 — 별도 컬럼/테이블 없음

books
  id            uuid PK
  isbn13        text UNIQUE
  title         text
  author        text
  publisher     text
  total_pages   int
  cover_url     text
  -- 알라딘/외서 무료 메타 (#489) — normalize() 가 채움. 외서·LLM은 가용 필드만, 나머지 NULL.
  -- ⚠️ 최종 컬럼셋은 구현 1단계 raw 실측(프록시 임시 &debug=raw)으로 무료 TTBKey 실제 채움 필드를 확인 후 확정.
  description          text     NULL  -- 책 소개(알라딘 description / Google·OpenLibrary 폴백)
  full_description     text     NULL  -- 출판사 제공 긴 소개(알라딘 OptResult=fulldescription)
  subtitle             text     NULL  -- 부제(subInfo.subTitle)
  original_title       text     NULL  -- 원제(외서, subInfo.originalTitle)
  pub_date             date     NULL  -- 출간일(pubDate)
  category_id          int      NULL  -- 알라딘 분야 ID — 추천(#496) 같은 분야 폴백에 사용
  category_name        text     NULL  -- 분야명(categoryName)
  toc                  text     NULL  -- 목차(OptResult=Toc)
  story                text     NULL  -- 줄거리(OptResult=Story)
  price_standard       int      NULL  -- 정가
  price_sales          int      NULL  -- 판매가
  customer_review_rank smallint NULL  -- 알라딘 별점 0~10
  sales_point          int      NULL  -- 알라딘 판매지수
  aladin_link          text     NULL  -- 알라딘 상세 링크
  adult                bool     NULL  -- 성인 여부
  source               text     NULL  -- 메타 출처: 'aladin'|'google'|'openlibrary'|'llm' (폴백 추적·신뢰 카피 차등)
  -- #642: source='llm' ⟺ "책 소개를 LLM이 생성". 책 상세 "📚 책 소개" 제목 옆 작은 회색 `AI` 칩으로 표기
  --   (본문 디스클레이머 없음). 대상 = components.js BookInfoModal · library.js BookDetailModal.
  --   library는 알라딘 실시간 폴백 경로도 응답 `items[0].source`를 함께 받아 칩 판정.
  --   (환각 가드·사실 검증은 스코프 아웃 — 표기만. 영속 정책 재검토는 후순위.)
  enriched_at          timestamptz NULL  -- 메타 보강 시각 — 빈 필드 재보강 cron 추적(#489)
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
  status        text                 -- 'reading' | 'completed' | 'aborted'(#593: 읽던 책 중단, current_page 보존·되돌리기 가능) | 'archived'(예약, 미사용)
  current_page  int  DEFAULT 0
  rating        numeric(2,1) NULL    -- v7 신설. 완독 별점 0.5~5, 0.5 단위(반별점) (선택)
  review_text   text NULL            -- v7 신설. 완독 소감 (선택)
  started_at    timestamptz
  completed_at  timestamptz NULL
  publisher_override   text    NULL  -- #431: BookEditModal 수정값. 공유 books.publisher 대신 표시(읽기 시 override 우선)
  total_pages_override int     NULL  -- #431: BookEditModal 수정값. 공유 books.total_pages 대신 표시(읽기 시 override 우선)
  UNIQUE(user_id, book_id)

reading_sessions
  id               uuid PK
  user_book_id     uuid FK user_books.id
  user_id          uuid                 -- 비정규화
  session_date     date
  current_page     int
  pages_read_today int                  -- v7.2: addToday가 전일 대비 증분 누적 기록 → 활동 히트맵(#195, sessions.heatmap)
  duration_sec     int  DEFAULT 0       -- #430: 그날 읽기 세션 누적 시간(초) — 프로필 독서 시간 통계
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

claps                                       -- ❤️ 좋아요 = 한 문장 반응+저장 단일화 (#641: 짹·책갈피 수렴처)
  id              uuid PK
  from_user_id    uuid FK users.id          -- #641: from = to_sentence 작성자여도 허용(self=저장). self-clap XP 비부여
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

sentence_bookmarks                          -- DEPRECATED (#641, 28_deprecate_bookmarks.sql): claps로 흡수. 테이블·데이터는 롤백 안전상 보존(신규 쓰기 없음)
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
  app_version   text NULL            -- (deprecated #799) RG_VERSION 폐기로 미사용. 컬럼은 잔존(과거 데이터·drop 생략)
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
- `wish_books`: insert/update/delete = 본인만. select = 소유자 OR 대상 user의 `wishlist_public=true` (v8.2, #558, `25_wishlist_public.sql`)
- `sentence_bookmarks`: 본인만 insert/select/delete
- `inquiries` (v7.2): 본인만 insert(user_id=auth.uid()). select = 본인 OR `is_admin()`. update = `is_admin()`만(상태 변경)
- `village_members` (v7.2): leave = 본인 행 delete (마을 탈퇴, #9)
- `villages`: 누구나 공개 마을 목록 select. insert는 로그인 사용자. `village_members` 의 멤버만 피드/멤버 현황 select (구경 불가는 §village 에서 규정). **단 `password_hash` 컬럼은 `revoke select` 로 클라 read 차단** — 비번 검증은 `room_verify_password` RPC 서버측만(#996, §7.6.1)
- `village_members` (#1022, CSO HIGH): `vmembers_mod` = **본인 탈퇴(delete)만** 클라 직접 허용. **INSERT 자격 회수** — 클라 직접 `village_members` insert/upsert 가 방 비번·정원·visibility 우회 입장 경로였으므로(RLS 가 `user_id=auth.uid()` 만 봄), 멤버십 생성은 SECURITY DEFINER RPC(`room_join`/`room_create_membership`, §7.6.1)가 서버측 검증 후에만 수행한다(`36_room_join_rpc.sql`). select(`vmembers_sel`)는 유지
- v7 제거: `operator_replies` RLS (운영자 짹 폐기)

### 7.6 닉네임 RPC

```
POST /rpc/check_handle  { handle }
→ { ok: true } | { ok: false, reason: 'taken' | 'format' | 'banned' }
```

#### 7.6.1 숲(방) 비밀번호 RPC (#996, co-reading §6.4)

방 비밀번호는 **평문 저장 금지** — pgcrypto **bcrypt** 해시(`villages.password_hash`) + 서버측 검증. 해시 컬럼은 `revoke select (password_hash)` 로 클라 read 차단, 비번여부는 비-비밀 `has_password` 플래그로만 노출. 둘 다 **SECURITY DEFINER**(search_path 고정).

```
room_set_password(p_room_id uuid, p_password text)    → void     -- host(created_by=auth.uid())만. bcrypt 해시 저장(빈값=해제). has_password 갱신
room_verify_password(p_room_id uuid, p_password text) → boolean  -- crypt(input, stored)=stored 서버 비교. boolean만(해시 비노출). 비번 없는 방=true
```

- `rooms.create` 는 평문 insert 안 함 — 방 생성 후 `room_set_password` 호출. `rooms.join` 은 `password` select 제거 → `room_verify_password`(boolean)로 분기.
- 마이그레이션 `35_room_password_hash.sql` **수동 1회 적용 필수**(pgcrypto·컬럼·REVOKE·RPC). 기존 평문은 해시로 변환 후 컬럼 drop.

#### 7.6.2 숲(방) 입장 RPC — 서버측 권한 강제 (#1022, co-reading §6.3)

방 입장(멤버십) 권한은 **서버가 최종**이다. 이전엔 어댑터(JS)가 비번·정원을 검사한 뒤 `village_members` 를 **클라가 직접 insert** 했고, RLS(`vmembers_mod`)는 `user_id=auth.uid()` 만 확인 → join UI 를 건너뛴 직접 `POST /rest/v1/village_members` 로 **비번·정원·visibility 우회 입장**이 가능했다(CSO HIGH, OWASP A01). 이제 클라 직접 insert 는 RLS(`vmembers_mod` = **delete만**)로 거부되고, 멤버십 생성은 아래 **SECURITY DEFINER** RPC(search_path 고정) 경유만 — 함수 안에서 서버가 검증한 뒤에만 행을 만든다.

```
room_join(p_room_id uuid, p_password text)  → void   -- ①방 존재 ②room_verify_password=true ③count(members)<capacity 검증 후에만
                                                     --   insert village_members(auth.uid()) on conflict do nothing. 실패=raise(errcode 로 비번/정원/없는방 구분)
room_create_membership(p_room_id uuid)       → void   -- 방 생성자(created_by=auth.uid()) 자기등록. create 직후 호출(직접 insert 대체)
```

- `rooms.join` → `room_join` RPC 호출(직접 upsert 제거). `rooms.create` → 생성자 멤버 등록을 `room_create_membership` RPC 로(직접 insert 제거).
- RLS 변경: `vmembers_mod` 를 `for all`(insert/delete) → **`for delete`(본인 탈퇴)만**. INSERT 정책이 없어 클라 직접 insert/upsert 거부. `vmembers_sel`(조회)은 유지.
- 마이그레이션 `36_room_join_rpc.sql` **수동 1회 적용 필수**. `room_verify_password`(#35)에 의존 → **35 를 먼저** 적용. `migrations_applied.py` 는 컬럼/테이블만 검사하므로 RPC·정책은 적용 후 수동 확인.

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

**전체 게스트 활동 백필 (#370, 구현)**: 위 `pending_*`(단건)만으로는 게스트가 읽기모드에서 남긴 **여러 문장·참새 대화(my_note)** 가 가입 시 유실됐다(피치 해자 "축적되는 대화"가 비는 구조적 원인). 수정:

- 로컬 어댑터 `sentences.add`는 게스트가 직접 남긴 문장에 **`_guest: true`** 태그(시드 `_seed()` 문장은 태그 없음 → 백필 제외).
- `syncPendingToSupabase`(app.js)는 `_guest` 문장을 가진 **모든 user_book**을 이전: 책 upsert → 문장 `add({text, page, my_note, kind})`로 **대화(my_note)·종류까지 보존**. 활성 책은 로컬 `active_user_book_id` 매핑 유지.
- 이전 후 `pending` 비우고 `_guest` 플래그 제거(재동기화 방지). 시드 완독 책은 `_guest` 문장이 없어 미이전(폴루션 방지).
- 참여 가시화: `answer_saved`(PostHog)는 동의와 무관하게 발화(`rgTrack`→`posthog.capture`) — 미동의 게스트의 engagement도 집계됨.
- **동의 유저 my_note → `companion_sessions` 백필 (#394, 구현)**: 로그인 시 `backfillCompanionSessions()`(app.js) — 동의(`yes`)·기존 세션 0건일 때만(중복 방지) sentence `my_note`의 `Q./A.` 쌍을 파싱(`parseQAPairs`)해 `companionSessions.add`. 가드용 `companionSessions.countMine()` 양 어댑터 추가(로컬=0). 미동의 유저 제외(PIPA). 해자 집계(`companion_sessions`)를 과거 대화로 채움.

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

#### 7.9.1 관련 도서 — `POST /api/related` (#496)

책 상세 "함께 읽으면 좋은 책"([profile.md §5.8.4](./profile.md)) 의 호출 경로. companion/ocr 과 동일한 동일출처 가드 + `callLLM(env)` 프록시 패턴(키 서버 보관).

- **라우트**: `POST /api/related` (`worker/index.mjs` `relatedProxy`). 입력 `{isbn, title, author}`(현재 책) → 출력 `{books:[{isbn, title, author}]}` (최대 8). system = 사서(실존 한국 출간서만, 각 책의 **ISBN-13** 포함, JSON 배열만 출력). worker 는 ISBN-13(13자리 숫자) 형식이 유효한 후보만 추리고 ISBN 기준 중복 제거. 키/설정 없거나 호출 실패 시 `{books:[]}` 폴백(무중단).
- **ISBN 환각 필터(클라)**: LLM 이 준 ISBN 을 **신뢰하지 않는다**. `data.js filterRelatedCandidates`(순수 함수)가 후보를 **실존 books DB 의 ISBN 과 정확 일치할 때만** 통과시킨다. 통과 조건: ① ISBN-13 형식 유효 ② 현재 책 ISBN 아님 ③ 중복 ISBN 아님 ④ DB 에 해당 ISBN 실재 ⑤ DB 책의 정규화 제목이 후보 제목과 일치. **제목 prefix/부분 매칭은 환각 필터로 쓰지 않는다**(다른 책·다른 권·다른 판본 오통과 방지). 매칭된 실제 DB 책 객체만 반환, 책 단위 메모리 캐시. #489 외서 보강의 ISBN 매칭 환각 필터와 동일 원칙.
- **DataStore 계약**: `books.related(book)` — 두 어댑터 표면 일치(§7.2). Phase 0 은 양쪽 모두 LLM 폴백. **Phase 1**: Supabase 어댑터를 `user_books` 공동독서 집계 RPC(예: `books_also_read`)로 교체 → '이 책 읽은 사람들이 읽은 책'(실데이터). 그 전까지 허위 카피 금지.

#### 7.9.2 독서 위키 Q&A — `POST /api/wiki-ask` (#1007)

"내 문장에게 묻기"([profile.md §5.8.8](./profile.md)) 의 호출 경로. 사용자가 책에서 모은 한 문장(+감상)에 **근거해서만** LLM이 답한다(개인 독서 위키). companion/related 와 동일한 동일출처 가드 + `callLLM(env)` 프록시 패턴(키 서버 보관).

- **AI lock**: Gemini Flash **텍스트** 사용 — CLAUDE.md Stack Lock 'AI: 텍스트·vision 모두 자유 사용' 범위 안이라 **별도 lock 결정 불필요**. provider-agnostic `callLLM`(base_url/model/key 전부 env) 재사용.
- **라우트**: `POST /api/wiki-ask` (`worker/index.mjs` `wikiAskProxy`). 입력 `{question, items:[{text, note, book, author, page}]}` — 클라가 `listMine()` 결과(내 문장만)를 payload 로 보낸다. 출력 `{answer}`. 워커가 items 를 번호 매긴 코퍼스로 묶어(책·페이지·감상 포함) 한 프롬프트에 통째로 넣는다. 토큰 안전: items **최대 120**·각 필드 길이 컷, question 500자 컷.
- **규모상 RAG 불필요**: 유저당 ≤약 100문장 ≈ 2-3K 토큰 → 임베딩·벡터DB 없이 **전체를 한 프롬프트에**, **질문당 1콜**. 무료 티어 한도 내(비용 0).
- **그라운딩(환각 가드)**: system 프롬프트가 ① 답의 근거가 된 문장·책 제목을 함께 밝히고 ② 모은 문장에서 못 찾으면 지어내지 말고 정확히 "모은 문장에서는 못 찾았어요"라고만 답하며 ③ 문장에 없는 사실·다른 책 내용을 새로 만들지 않도록 강제한다. "다른 책에서 비슷한 생각"(책 가로지르기, #919)은 *주어진 문장들 사이*에서만 짝을 찾는다.
- **프라이버시/저작권**: 내 문장→LLM 전송은 `/api/companion`(재키)이 이미 하는 선례와 동일 경로(키 서버 보관). **내 문장만** 보내므로 타인 발췌 수집/저작권(#1008) 위험은 낮다([legal-copyright.md] 원칙 일관).
- **폴백**: `question` 누락 → 422, `items` 비었으면 422(`empty`). 키/설정 없으면 200 + 안내 문구(`demo:true`, 목 답 대신 "키워드 검색으로 찾아보세요"). LLM 호출 실패 → 502(`error`). 클라(`window.RG_wikiAsk`, supabase-client.js)가 로딩·에러·빈 상태를 처리.
- **DataStore 계약 밖**: 저장 없는 stateless LLM 프록시라 어댑터(§7.2) 표면이 아니다 — companion/related 와 같이 클라 래퍼가 직접 `fetch`. (저장형 위키·소재 태깅으로 확장하면 그때 계약화.)

---
