# 활동함 — 인앱 소셜 활동 계약

> **결정 (#1260, 2026-08-25)**: 좋아요·새 팔로워·콕찌르기를 다시 찾을 수 있는 **인앱 활동함**을 제공한다. 원격 푸시는 이 범위가 아니다.
> **SSOT 경계**: 화면·상태·빈 상태는 이 문서, 데이터·RPC·RLS는 [backend.md §7.0.6](./backend.md#706-활동함-읽기-모델상태-계약-1260)을 따른다. 공개 UGC 안전은 [feed.md §5.7.4](./feed.md#574-공개-ugc-안전--동의신고차단검토-1392)보다 넓게 허용할 수 없다.
> **구현 상태**: 목표 계약만 승인하는 spec-only 문서다. 런타임·DB migration·DEV/Production 적용은 후속 코드 PR과 운영 검증 전까지 미구현이다.

## 1. 목적과 범위

활동함은 사용자가 **나에게 일어난 현재 유효한 소셜 활동**을 한곳에서 확인하는 읽기 표면이다. 알림 이벤트를 별도 원장으로 복제하지 않고 기존 권위 행을 서버에서 합쳐 읽는다.

### 포함

1. 타인이 **내 문장**에 누른 좋아요
2. 나를 새로 팔로우한 사용자
3. 타인이 나에게 보낸 기존 콕찌르기
4. 목록 조회, 읽지 않음 표시, 모두 읽음 처리

### 제외

- 자기 문장에 누른 좋아요
- 내가 누른 좋아요·내가 한 팔로우·내가 보낸 콕찌르기
- 읽기방 일정·마감·운영 공지·추천·XP·스트릭 이벤트
- APNs·FCM·웹푸시, 이메일·SMS, OS 권한 요청과 기기 토큰
- 이벤트·문장·책·프로필 snapshot 또는 영구 notification row
- 개별 항목을 다시 unread로 바꾸기, 개별 삭제·보관

## 2. 권위 원천과 파생 규칙

| 종류 | 권위 행 | 포함 조건 | 원천이 바뀌면 |
|---|---|---|---|
| `clap` | `claps` + 내 `sentences` | `sentences.user_id=viewer`, `claps.from_user_id<>viewer` | unlike 또는 문장 삭제 시 즉시 사라짐 |
| `follow` | `follows` | `following_id=viewer`, `follower_id<>viewer` | unfollow 시 즉시 사라짐 |
| `poke` | `pokes` | `to_user_id=viewer`, `from_user_id<>viewer` | 원천 행 삭제 시 즉시 사라짐 |

- 조회 시점 서버 시각 기준 **최근 90일**만 포함하고 전체 후보 중 최신 **최대 100개**만 반환한다. 클라이언트 시각은 보관 경계에 사용하지 않는다.
- 정렬은 `occurred_at DESC`, 동률은 `kind`, `event_id`의 결정적 순서다. 목록을 다시 열어도 같은 원천 상태라면 순서가 흔들리지 않는다.
- 좋아요 여러 건은 각각 한 항목이다. 같은 사용자의 unfollow→follow는 기존 행이 삭제된 뒤 새 행의 새 `created_at`으로 한 항목만 생긴다.
- 별도 알림 row나 snapshot을 만들지 않는다. 항목의 배우·문장·책 정보는 **현재 행을 현재 이름과 내용으로 join한 projection**이다.
- 원천이 삭제·철회되거나 현재 권한 필터를 통과하지 못하면 읽음 상태와 무관하게 목록·미읽음 수에서 사라진다. 활동함은 과거 감사 로그가 아니다.

## 3. IA와 UI 계약

### 3.1 위치와 진입

- canonical `같이읽기` 화면의 **상단 App Header trailing action**에 라벨 있는 종 아이콘 버튼을 둔다. 제목·뒤로가기·읽기방/피드 전환을 대체하지 않는다.
- 친구 검색·읽기방 찾기·만들기 같은 layer-local 액션은 각 레이어 안에 유지한다. 활동함 때문에 기존 핵심 CTA를 숨기거나 헤더에 겹쳐 넣지 않는다.
- 버튼은 safe-area를 포함한 기존 App Header 레이아웃과 최소 44×44px 터치 영역을 사용한다. 읽지 않은 현재 항목이 있으면 작은 점과 접근성 이름 `읽지 않은 활동 N개`를 제공한다.
- 탭하면 같은 route 위의 sheet 또는 전체 높이 overlay로 `활동` 목록을 연다. 닫기와 Android system back은 overlay만 닫고 기존 같이읽기 위치·필터·스크롤을 보존한다.

### 3.2 항목 표현과 이동

공통 행은 현재 배우의 아바타·표시 이름/핸들, 종류별 문장, 상대 시각을 표시한다. actor snapshot이 아니라 현재 허용된 프로필 projection만 사용한다.

| 종류 | 기본 카피 | 추가 정보 | 탭 동작 |
|---|---|---|---|
| 좋아요 | `{actor}님이 내 문장을 좋아해요` | 현재 문장 최대 2줄, 현재 책 제목·페이지가 있으면 보조 표시 | 내 해당 문장/책 상세 |
| 팔로우 | `{actor}님이 나를 팔로우했어요` | 현재 핸들 | 허용된 사용자 프로필 |
| 콕찌르기 | `{actor}님이 콕 찔렀어요` | 죄책감·마감 압박 카피 없음 | 허용된 사용자 프로필 |

- 표시 줄 수 제한은 UI 절단일 뿐 서버가 문장 snapshot이나 별도 excerpt를 저장하지 않는다.
- 탭 직전 재조회에서 대상이 사라졌으면 존재를 암시하는 오류 대신 항목을 제거하고 `지금은 볼 수 없는 활동이에요`로 복귀한다.
- actor 전체 프로필이나 문장 원문이 현재 권한상 허용되지 않으면 generic placeholder로 잔존시키지 않고 항목 자체를 제외한다.

### 3.3 상태

- **로딩**: 기존 목록을 지우지 않는 짧은 skeleton/refresh 상태. 실패를 빈 상태로 가장하지 않는다.
- **빈 상태**: `아직 새로운 활동이 없어요.` 추천 사용자나 가짜 활동을 채우지 않는다.
- **오류**: `활동을 불러오지 못했어요. 다시 시도해주세요.`와 재시도 제공. 마지막 성공 목록이 있으면 유지하되 stale임을 표시한다.
- **게스트**: 보호 RPC를 호출하거나 로컬 가짜 활동을 만들지 않고 빈 목록과 `로그인하면 좋아요, 새 팔로워, 콕찌르기를 여기서 확인할 수 있어요.` 및 로그인 CTA를 표시한다. 헤더 미읽음 점은 0이다.

## 4. 읽음·미읽음 계약

- 활동함은 사용자별 서버 상태 `seen_through` 하나만 저장한다. 개별 원천 행에 `read`를 쓰거나 notification row를 만들지 않는다.
- 각 현재 항목은 `occurred_at > seen_through`일 때 unread다. `seen_through IS NULL`이면 보관 범위의 현재 항목을 모두 unread로 본다.
- 목록 응답은 서버가 조회에 사용한 `watermark`와 현재 `unread_count`를 함께 준다. 화면을 열었다는 이유만으로 즉시 읽음 처리하지 않는다.
- 목록이 성공적으로 화면에 렌더된 뒤 `markAllSeen(watermark)`를 호출한다. 서버는 기존 값보다 뒤로만 이동시키며, 서버 현재 시각보다 미래인 값은 거부한다.
- 마킹 중 새 활동이 생기면 전달한 watermark 이후 항목은 unread로 남아야 한다. 클라이언트의 `Date.now()` 또는 optimistic 숫자 0으로 덮지 않는다.
- 마킹 실패 시 로컬에서 점을 지우지 않는다. 재조회한 서버 `unread_count`가 헤더와 목록의 정본이다.
- unlike·unfollow·삭제·차단 등으로 unread 원천이 사라지면 다음 서버 재계산에서 unread 수도 감소할 수 있다. 이는 파생 목록의 의도된 동작이다.

## 5. 최소 응답 필드

```text
ActivityItem {
  kind: 'clap' | 'follow' | 'poke'
  eventId: uuid
  occurredAt: timestamptz
  isUnread: boolean
  actor: { id, displayName, handle, avatarUrl }
  sentence: null | { id, text, page, bookId, bookTitle }
}

ActivityInboxResult {
  items: ActivityItem[]       // 최신순, 최대 100
  unreadCount: integer        // 같은 필터를 적용한 현재 값
  seenThrough: timestamptz | null
  watermark: timestamptz      // markAllSeen에 그대로 전달
}
```

- `sentence`는 `clap`에서만 존재한다. `my_note`, 이메일, 팔로우 목록, 현재 페이지, 내부 `user_book_id`, 신고·차단·정지 사유는 반환하지 않는다.
- 배우 정보와 문장/책 정보는 현재 원천 projection이며 응답 외 별도 저장·분석 payload로 복제하지 않는다.

## 6. 서버 권한과 안전

- 목록·미읽음 수·mark-seen은 인증 사용자 전용 제한 RPC다. 클라이언트에서 `claps`·`follows`·`pokes`를 직접 합쳐 권한 필터를 대신하지 않는다.
- 모든 종류에 양방향 사용자 차단과 actor 정지를 적용한다. 좋아요에는 운영자 hidden 문장도 추가로 제외한다. 필터는 목록, count, unread 판정에 동일하게 적용한다.
- RPC는 `auth.uid()`만 viewer로 사용하며 임의 user id 인자를 받지 않는다. `SECURITY DEFINER`라면 고정 `search_path`, 스키마 한정 참조, 입력 상한, 명시적 `authenticated` grant와 `anon/public` revoke를 갖춘다.
- `activity_inbox_state` base table은 RLS를 켜고 본인 행만 `SELECT/INSERT/UPDATE`한다. 다른 사용자의 state 조회·변조와 클라이언트 `DELETE`는 허용하지 않는다.
- 활동함을 위해 기존 source table의 broad SELECT grant를 늘리지 않는다. source RLS 축소가 필요한 경우 [backend.md §7.0.3](./backend.md#703-현재-보안-갭과-전환-게이트)의 최소 지원 버전·컷오버 게이트를 별도로 따른다.

## 7. 수용기준과 검증 매트릭스

1. 타인 clap, 새 follower, inbound poke만 최신순으로 나오고 self-clap·outbound 활동은 나오지 않는다.
2. unlike·unfollow·문장/원천 삭제 후 새로고침하면 항목과 unread 수가 함께 사라진다.
3. 90일 경계의 서버 시각, 100개 상한, 동률 정렬을 고정 시각 fixture로 검증한다.
4. 목록 watermark를 mark한 직후의 신규 이벤트가 unread로 남고, 미래 watermark·타인 state 변경이 거부된다.
5. owner·actor·제3자·anonymous 역할로 목록/count/state 직접 호출을 검증한다. owner 외에는 결과 또는 존재 차이를 얻지 못한다.
6. 차단 양방향, actor 정지, hidden 문장, 삭제된 actor/문장 조합이 목록과 count에서 동일하게 제외된다.
7. actor 표시명·아바타·문장·책 제목 변경이 재조회에 반영되고 별도 snapshot row가 생기지 않는다.
8. 게스트는 네트워크 보호 RPC 없이 안전한 로그인 안내와 unread 0을 본다.
9. 같이읽기 헤더의 제목·뒤로가기·읽기방/피드 전환·layer-local CTA가 유지되고 390px/430px/desktop, safe-area, Android back을 시각·E2E 검증한다.
10. 구현 PR은 DataStore 양 어댑터 표면, migration/RPC/RLS 역할 테스트, spec-align invariant를 함께 추가하되 원격 푸시 권한·토큰·Worker route는 추가하지 않는다.
