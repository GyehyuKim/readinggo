# 독서 이야기·한 문장 공유 — 제품 스펙

> **상태**: v1 활성 목표 계약
> **결정**: #1590
> **관련 구현**: `js/share-card.js`, `js/sentence-card.js`, `js/milestone-recap.js`, `js/book-detail-modal.js`
> **편집 정책**: 이 영역의 동작·공개범위·데이터 계약 변경은 spec-only PR을 먼저 머지한다.

## 1. 목적

ReadingGo에서 읽는 동안 남긴 **문장과 내 생각**을 다시 작성하지 않고 두 가지 결과물로 표현한다.

1. **한 문장 공유**: 문장 기록 한 건을 Feed 또는 Instagram Story 이미지로 공유한다.
2. **완독 독서 이야기**: 한 권의 문장 기록 여러 건과 완독 소감을 골라 “나는 이 책을 이렇게 읽었다”는 공개 결과물로 묶는다.

ReadingGo 공식 Instagram의 `책방지기의 하루 한 문장`도 일반 사용자와 같은 한 문장 공유 기능을 사용한다. 운영자 전용 모드·콘텐츠 DB·자동 게시 도구는 만들지 않는다.

## 2. 제품 원칙

### 2.1 하나의 기록, 세 가지 표현

- 원본은 책, 문장, 페이지, `my_note`, 공개범위다.
- 한 문장 카드와 완독 이야기는 원본을 복제 입력하지 않고 재사용한다.
- 매일 남긴 한 문장과 생각이 이후 완독 이야기의 재료가 된다.
- 공유는 선택 행동이며 저장·완독을 막거나 자동 공개하지 않는다.

### 2.2 SLC 범위

- 기존 1:1(1080×1080)·9:16(1080×1920) 렌더러와 Web Share를 재사용한다.
- 한 문장 공유는 미리보기, 내 생각 포함 여부, 공개범위 확인, 이미지 공유와 링크 복사를 제공한다.
- 완독 이야기는 모바일 세로 스크롤 결과물과 대표 9:16 카드 한 장을 우선 제공한다.
- 다장 Instagram 자동 업로드, 링크 스티커 자동 삽입, 공식 계정 자동 게시는 범위 밖이다.

## 3. 한 문장 공유

### 3.1 진입점

- 문장 저장 후 `내 생각 덧붙이기` 흐름을 유지한다.
- 생각 저장 또는 건너뛰기 뒤 `이 문장 공유하기`를 선택 행동으로 제공한다.
- 모든 내 `SentenceCard`의 기존 공유 액션에서도 같은 선택기를 연다.
- 운영자와 일반 사용자의 화면·권한·데이터 계약은 같다.

### 3.2 공유 선택기

- 결과 중심 라벨을 사용한다.
  - `피드용 정사각형`
  - `스토리용 세로형`
- 선택 전에 실제 결과 비율의 미리보기를 보여준다.
- 책 제목·저자·문장·페이지·내 생각·ReadingGo 브랜드를 확인할 수 있어야 한다.
- `my_note`가 있으면 `내 생각 포함`을 기본 ON으로 제공하되 사용자가 끌 수 있다.
- 생각이 비공개이거나 문장 공개범위가 `private`이면 이미지 자체는 개인 기기에서 만들 수 있지만 공개 링크를 만들거나 공개됐다고 표시하지 않는다.

### 3.3 Instagram 제약

Instagram이 Web Share의 이미지와 URL을 함께 받아 링크 스티커를 자동 생성한다고 가정하지 않는다.

1. primary: `스토리 이미지 공유`
2. secondary: `링크 복사`
3. 안내: `Instagram에서 링크 스티커에 붙여 넣으세요`

이미지 공유와 링크 복사의 성공·취소·실패 상태를 분리한다. 이미지에 적힌 URL 문자열을 클릭 가능한 링크로 표현하지 않는다.

## 4. 완독 독서 이야기

### 4.1 결과물

완독 이야기는 단순 완독 배지가 아니라 독자의 선택과 해석을 보여준다.

- 표지
- 이 책을 읽은 이유 또는 도입(선택)
- 직접 인용한 문장
- 문장에 남긴 내 생각
- 완독 소감
- 추천 대상 또는 마무리(선택)
- 작성자와 ReadingGo 공개 링크

`10~20장`은 인용문 수가 아니라 결과 카드 수다. 직접 인용은 권장 3~5개, 최대 8개다. 공개 화면에 노출하는 인용은 항목당 최대 500자, 이야기 전체 합계 최대 2,400자이며 초과분은 저장 원본을 바꾸지 않고 공개 결과물에서만 말줄임한다. 문장이 적어도 표지·소감·마무리를 포함한 짧은 이야기를 만들 수 있으며, 어떤 원문도 자동 선택·자동 공개하지 않는다. 생각이 있는 인용을 우선하도록 안내하되 작성을 강제하지 않으며, 인용만 선택한 경우 `내 생각을 더하면 나만의 독서 이야기가 돼요`를 보여준다.

### 4.2 진입점

- 완독 직후 `MilestoneRecap`에 secondary CTA `독서 이야기 만들기`를 둔다.
- 완독 책 상세에 상시 재진입점을 둔다.
  - 없음: `독서 이야기 만들기`
  - draft: `이야기 이어서 만들기`
  - published: `이야기 보기·공유하기`
- 문장이 없으면 비활성 버튼 대신 `먼저 기억할 문장을 남겨보세요`와 문장 추가 경로를 보여준다.

### 4.3 에디터

모바일 풀스크린 시트를 사용한다.

1. 헤더: 책 제목, 자동저장 상태, 닫기
2. 문장 선택: 문장과 기존 `my_note`를 한 단위로 표시
3. 구성: 생성될 카드 목록
4. 순서: 위/아래 버튼으로 이동. 새 드래그 라이브러리는 추가하지 않음
5. 대표 카드: 적합한 첫 문장을 자동 선택하고 변경 가능
6. 하단 CTA: primary `발행하기`, secondary `미리보기`

완독 소감과 기존 생각을 우선 재사용한다. 도입·마무리는 선택 입력이다.

### 4.4 에디터 상태

- 생성 즉시 `draft`이며 비공개다.
- 초안은 자동저장하며 오프라인에서는 로컬 초안을 유지한다.
- 저장 실패 시 초안을 버리지 않고 인라인 재시도를 제공한다.
- 발행 중 중복 탭을 막는다.
- 발행 실패 시 초안과 선택 순서를 유지한다.
- Android system back은 최상위 미리보기부터 닫고 초안을 잃지 않는다.

## 5. 공개 독서 이야기

권장 URL은 `/s/:slug`다.

- 로그인하지 않은 방문자도 `published` 이야기만 볼 수 있다.
- 표지, 책 제목·저자, 작성자 표시명, 완독 정보, 선택한 문장과 생각을 모바일 세로 스크롤로 보여준다.
- 인용문과 사용자 생각의 시각 위계를 분리한다.
- 하단 CTA는 `나도 이 책의 문장을 기록하기`다.
- 공유, 신고, 작성자 프로필 진입을 제공한다.
- 표지는 alt text를 가지며 문장·버튼의 스크린리더 순서를 보장한다.
- `draft`, unpublished, deleted, moderated는 내용 없이 `이 이야기는 지금 공개되어 있지 않아요`를 반환한다.
- 네트워크 실패는 공개 여부와 혼동하지 않고 재시도를 제공한다.

v1에서는 새 피드 타입을 만들지 않는다. 기존 완독 책 카드·상세에 이야기 상태와 진입점을 연결한다. 피드 노출은 후속 단계에서 대표 카드 한 건으로만 검토한다.

## 6. 공개범위·UGC 안전

- 사용자가 미리보기 후 `발행하기`를 눌러야 공개된다.
- v1 story visibility는 `public`과 `private(draft·unpublished)`만 지원한다.
- 발행 취소 시 고유 URL은 즉시 비공개 안내를 반환한다.
- 원본 문장이 삭제되거나 `private`로 바뀌면 연결된 인용·생각 카드는 공개 응답에서 즉시 제외한다.
- `followers` 원문은 anonymous 공개 이야기에 포함할 수 없으며, 사용자가 story 발행 전에 `public` 전환을 명시적으로 선택해야 한다.
- 발행 snapshot은 편집 안정성에 사용할 수 있지만 원본 공개범위를 우회해 노출하는 근거가 아니다.
- 기존 UGC 약관 동의·신고·차단·작성자 정지·운영자 숨김을 공개 이야기에도 적용한다.
- 정확한 공개 인용 상한은 한 이야기당 8개이며 서버에서 강제한다.

## 7. 데이터·권한 계약

### 7.1 엔티티

- `reading_stories`: `id`, `user_id`, `book_id`, `slug`, `status`, `title`, `intro`, `outro`, `cover_sentence_id`, `published_at`, timestamps
- `reading_story_pages`: `id`, `story_id`, `position`, `type`, `sentence_id`, 허용된 공개 snapshot, `is_cover`, timestamps
- 기본적으로 사용자·책 한 조합당 이야기 1개다. 재독 버전은 후속이다.

### 7.2 DataStore

피처 코드는 저장소를 직접 호출하지 않고 local/Supabase 어댑터가 같은 계약을 제공한다.

```text
readingStories.getByBook(userBookId)                → ReadingStory | null
readingStories.saveDraft({userBookId, pages, ...})  → ReadingStory
readingStories.publish(storyId)                     → ReadingStory
readingStories.unpublish(storyId)                   → ReadingStory
readingStories.getPublic(slug)                      → PublicReadingStory | null
```

게스트는 로컬 draft와 미리보기·이미지 생성을 사용할 수 있다. 공개 발행은 로그인과 UGC 동의를 요구한다.

### 7.3 서버 검증

- story 발행·편집·취소는 소유자만 가능하다.
- 서버가 story 상태, 책 소유, sentence 소유·책 일치, page type, position 중복, cover 최대 1개, 직접 인용 최대 8개를 검증한다.
- `slug`는 추측하기 어려운 안정적 식별자이며 발행 취소·재발행 뒤에도 가능한 한 유지한다.
- anonymous는 base table을 직접 조회하지 않는다.
- 공개 조회는 published 상태와 허용 필드만 반환하는 좁은 RPC/API를 사용한다.
- 제한 RPC가 `SECURITY DEFINER`이면 고정 `search_path`, schema-qualified relation, 명시적 grant/revoke를 사용한다.
- owner, other authenticated, anonymous, blocked, suspended, hidden, invalid slug 역할을 직접 테스트한다.

### 7.4 공개 응답 최소 필드

- story: slug, title, published_at
- book: title, author, cover_url
- author: display_name, handle, avatar_url
- pages: type, position, 허용된 quote/note snapshot, page number

이메일, Auth UUID, 내부 sentence/story ID, visibility 내부값, moderation 사유·신고 내역은 반환하지 않는다.

## 8. Worker·공유 메타데이터

- Worker가 `/s/:slug`를 처리하고 story별 OG title, description, image, canonical URL을 제공한다.
- 공개 콘텐츠를 확인할 수 없으면 일반 앱 shell 대신 비공개 안내를 반환하며 OG에 원문을 넣지 않는다.
- 공유 카드 링크는 서비스 홈이 아니라 해당 `/s/:slug`를 가리킨다.
- 커스텀 도메인 #1249는 광범위한 외부 채널 운영의 선행조건으로 추적하되 DEV 구현을 막지 않는다.

## 9. Analytics

원문·생각·닉네임·ISBN·slug·내부 ID를 보내지 않는다. 성공 이벤트는 실제 저장·발행·clipboard/share 완료 뒤에만 발화하며 `navigator.share` 취소를 성공으로 세지 않는다.

- `sentence_share_previewed {format, entry}`
- `sentence_share_sent {format, method, entry}`
- `reading_story_editor_opened {entry}`
- `reading_story_draft_saved {page_count_bucket}`
- `reading_story_published {page_count_bucket, quote_count_bucket}`
- `reading_story_unpublished {reason_code}`
- `reading_story_share_image_sent {method}`
- `reading_story_link_copied {entry}`
- `reading_story_landing_viewed {referrer_group}`
- `reading_story_cta_clicked {destination}`

## 10. 접근성·디자인

- 390×844, 430×932, desktop card view에서 오버플로를 확인한다.
- safe-area와 reduced-motion을 지킨다.
- 화면당 primary CTA는 하나다.
- 모든 터치 타깃은 최소 44×44px다.
- 키보드 포커스 이동, Escape/뒤로가기, screen reader 이름과 순서를 검증한다.
- 기존 `DESIGN.md` 토큰과 버튼 위계를 사용한다.

## 11. 전달 단계

### Phase 1 — 한 문장 공유 SLC

- 기존 1:1/9:16 카드 렌더러 재사용
- 결과 미리보기와 `my_note` 포함 선택
- 특정 공개 기록 또는 향후 story URL 계약
- 이미지 공유와 링크 복사 분리
- Instagram 링크 스티커 안내
- 기존 share-card 자동 테스트 확장

이 단계부터 Hyu가 ReadingGo 공식 Instagram에서 매일 같은 기능을 사용해 운영 마찰을 확인한다.

### Phase 2 — 완독 이야기 데이터·에디터

- migration, RLS, publish/unpublish/public-read
- local/Supabase DataStore parity
- 완독 회고·책 상세 진입점
- 선택·순서·대표 카드·미리보기·자동저장

### Phase 3 — 공개 랜딩·유입

- `/s/:slug` anonymous 랜딩과 동적 OG
- 대표 9:16 이미지 공유와 링크 복사
- 기존 완독 책 카드의 story 상태 연결
- share → landing → CTA 퍼널 검증

## 12. 출시 게이트

- 기존 share-card 테스트, Vite build, smoke, spec/design lint가 통과한다.
- publish/unpublish, 소유권, page 검증, slug, 공개범위 fail-closed 자동 테스트가 있다.
- anonymous base-table 접근 거부와 제한 RPC 허용 필드를 SQL로 직접 검증한다.
- 390×844, 430×932, desktop 스크린샷을 검토한다.
- Android Web Share와 Instagram에서 이미지 공유와 링크 복사를 각각 수동 확인한다.
- stable DEV에서 검증한 동일 SHA만 Production 승격 후보가 된다.
- Production 승격은 김계휴가 수동 승인·실행한다.

## 13. 비목표

- Instagram 자동 게시 또는 링크 스티커 자동 삽입
- 10~20장 전체 자동 업로드
- 범용 SNS 피드·추천 알고리즘
- story 댓글·좋아요
- AI가 문장·생각을 대신 생성
- 공식 계정 전용 제작 도구
- 재독 이야기 버전 관리
