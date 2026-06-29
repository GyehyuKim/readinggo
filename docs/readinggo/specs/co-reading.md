# 같이읽기 (숲) — 화면 스펙 `co-reading.md`

> **상태**: 🟢 활성. P1 완료(#987/PR #995). P2-1 = 같이 기본(opt-out) + 공개 자동합류 + 명칭 "숲"(#988, 완료). 마일스톤(함께 읽기 일정/구간) = #999 완료(§5.6·§10.7). **auto-match 추천(공개 숲 권유 — 인원순+신규 끼움, **자동입장 X**) = #997(이 PR)** — 함께 탭 추천 섹션 + 책 상세 "이 책 같이 읽는 숲" 한 줄, `byBook` 인원순 정렬 통일(§7.6·§10.8). 페이스(진도) 매칭·임베딩/ML 은 과설계로 보류. 나머지 P2(게시판·역할·파트 랭킹·리마인더)는 계속 미룬다.
> **명칭 (owner 확정 #987 후속)**: 방 단위 정식 명칭 = **"숲"**(둥지가 모인 곳). 화면 텍스트는 모두 "숲"으로 통일. **탭 라벨은 "함께" 유지**. 코드 식별자(`rooms.*` 계약·CSS `.rg-room-*`·함수명·`RG_openRoom`·내부 탭 키 `social`)는 회귀·churn 방지를 위해 **변경하지 않는다**(명칭은 화면 텍스트만). §8 참조.
> **선행 prior-art**: [`village.md`](./village.md) (⚠️ 폐기 마을, #440) 의 **재설계 부활**. 마일스톤·게시판·역할은 P2 로 미루고, 같은 책 그룹의 *핵심 루프*만 SLC 로 되살린다. 잘 만든 부분은 살리고(데이터·코드·RLS), 무거운 부분은 떼어낸다.
> **owner**: gyehyu (피드·소셜 재편 owner — [feed.md](./feed.md) 도 같은 owner). 데이터·DataStore 계약은 [backend.md §7](./backend.md), 스키마는 `supabase/schema.sql` `villages`/`village_members` (재사용).
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.
> **Stack Lock**: 새 의존성 0 — 기존 Supabase 스키마(`villages`/`village_members`)·RLS(`is_village_member` SECURITY DEFINER)·DataStore 어댑터를 재사용한다(컬럼 2개 추가만). 무단 npm 추가 금지.

---

## 1. 왜 — 소셜 기둥 재설계

현재 [피드](./feed.md)는 **수동적(passive)**이다 — 타인의 한 문장이 일방향으로 흘러갈 뿐, 머무를 이유도 돌아올 이유도 약하다. 베타 피드백이 이를 가리킨다:

- #914 "초빈이라 심심" — 혼자 읽는 느낌, 함께라는 감각 부재.
- #916 lock-in — 돌아올 강한 후크 부족(스트릭 외 사회적 묶임 없음).

**같이읽기**는 능동적이고 *경계 있는(bounded)* 그룹을 더한다: **같은 책을 읽는 사람들이 "방"에 모여 서로 진도를 보며 같이 읽는다.** 피드가 "넓게 둘러보기"라면, 방은 "좁게 같이 달리기"다. 외로움·약한 리텐션을 정면으로 친다.

### 1.1 SLC 원칙

*Simple · Lovable · Complete* — "반쯤 만든 다섯 개"보다 "다듬은 하나". 이 스펙의 P1 은 **발견 → 방 입장 퍼널 + 방 코어(만들기·참여·진척 그리드·한 문장·나가기)** 를 *complete & lovable* 하게 만들고, 마일스톤·게시판·역할·콕찌르기·랭킹·자동매칭은 P2(#988)로 **깨끗하게 미룬다**. 방에 들어온 사람이 "오늘 같이 읽는 사람들의 진도가 보이고, 내 기록이 자동으로 반영되고, 같은 책 한 문장이 모인다"까지가 P1 의 lovable 경계다.

---

## 2. IA 결정 = C (핵심 결정)

> **결정됨 (제품 owner 합의). 재논의 금지.** — 4번째 하단 탭을 추가하지 않는다. 대신 **피드 탭을 "함께"로 재편**한다.

### 2.1 결정: 피드 탭 → "함께" (2개 레이어)

하단 탭은 **홈 / 피드 / 책장** 3탭을 유지한다([README §0.5](./README.md) 용어 정본). 의도적 3탭 IA 를 흩뜨리지 않는다. 4번째 탭을 만드는 대신, 기존 **피드 탭을 "함께" 탭으로 재편**해 두 레이어를 담는다:

```
함께 탭
  ① 발견  (기존 피드 — 한 문장·사람·책 둘러보기)   ← 입구(entrance)
        │   "이 책 N명 같이 읽는 중" · "같이 읽을래?"
        ▼
  ② 방    (같이읽기 룸 — 같은 책 그룹)             ← 목적지(destination)
```

**발견 = 입구, 방 = 목적지 → 퍼널.** 책을 발견하고(① 둘러보다 끌리는 책) → "같이 읽을래?"(전환) → 방 참여(② 들어가 같이 달림) → 돌아올 이유(매일 진도·한 문장이 기다림). 피드의 수동적 발견이 *능동적 참여*로 흘러가는 단일 동선.

| 항목 | 변경 |
|---|---|
| 하단 탭 라벨 | **피드 → 함께** (내부 탭 키 `social`·`social.js` 는 코드 호환상 유지 — feed.md 선례) |
| 탭 내부 구조 | 상단 **① 발견 / ② 방** 세그먼트(또는 발견 위 "내 방" 스트립). 기본 = 발견(신규엔 입구가 먼저) |
| 발견 레이어 | **기존 피드 그대로** — 인기 책·한 문장 피드·유저 찾기([feed.md §5.7](./feed.md) 전체 보존). 여기에 방 진입점(badge/CTA)만 얹는다 |
| 방 레이어 | 새 화면 — 방 목록·만들기·참여·방 내부(§5) |

### 2.2 왜 C 인가 (A·B 기각 사유)

| 안 | 내용 | 기각 사유 |
|---|---|---|
| **A** | 피드 안에 "같이읽기" **섹션** 1개 | 발견 더미에 **묻힌다**(스크롤 하단 섹션은 안 보임). 또 "둘러보기 피드" 안에 "참여형 그룹"이 섞여 **메타포 충돌**(passive/active 혼재) |
| **B** | **4번째 하단 탭** 신설 | 의도적 3탭 IA 를 **희석**. 신규 사용자에게 탭 1개 = 인지 부담↑. 방은 피드(발견)에서 *흘러나오는* 목적지이므로 별도 1급 탭이 아니라 피드의 **하위 목적지**가 자연스럽다 |
| **C ✅** | 피드 탭을 **함께(발견+방 2레이어)**로 재편 | 탭 수 유지 + 발견→방 퍼널이 한 탭 안에서 매끄럽다. 발견이 방으로 가는 **유입구**가 되어 빈 방 문제(초기 참여자 부족)도 완화 |

---

## 3. 개념 정의

**방 = 책 1권 단위 그룹.** 같은 책을 읽는 사람들이 모여 서로 진도를 보며 같이 읽는다. (마을의 "챕터 마일스톤·마감 레이스"는 떼어냈다 — 방은 *느슨한 동행*이지 *마감 압박*이 아니다. 마일스톤은 P2.)

| 개념 | P1 정의 |
|---|---|
| 방 | `book_id` 1권 + 이름 + 공개/비공개 + (선택)정원. 멤버들이 같은 책을 각자 자기 페이스로 읽고 진도를 공유 |
| 멤버 | 방 참여자. 자기 일일 기록이 방에 **자동 반영**(별도 체크인 없음) |
| 발견 | 함께 탭 ① 레이어 — 공개 방 검색·"이 책 N명" badge·코드/링크 입력의 입구 |

방의 상태 구분(활성/완료)·완독 자동 아카이브는 **P1 미포함**(마일스톤이 있어야 "완료"가 정의됨 → P2).

---

## 4. 함께 탭 — 발견 + 방 레이어

### 4.1 함께 탭 전체 구조

```
┌─────────────────────────────────────────┐
│ 👥 함께                            🔍    │  ← 상단(유저 찾기 = 기존 피드)
├─────────────────────────────────────────┤
│  [ ① 발견 ]   [ ② 방 ]                   │  ← 세그먼트 (기본=발견)
├─────────────────────────────────────────┤
│  (선택 탭의 스크롤 영역)                 │
└─────────────────────────────────────────┘
```

- **발견 탭** = 기존 피드 화면 그대로([feed.md §5.7](./feed.md)) + 방 진입점(§4.4) 추가.
- **방 탭** = 같이읽기 룸 목록·만들기·참여(§4.2).
- 세그먼트 기본값 = **발견**(신규/게스트는 입구가 먼저 보여야 한다). 단 **참여 중인 방이 1개 이상이면** 방 탭에 미읽음/오늘 진척 신호를 줄 수 있다(P1 단순: 숫자 배지 없이 목록만).

### 4.2 방 목록 화면 (② 방 탭)

```
┌─────────────────────────────────────────┐
│  ┌──────────────────────┐  ┌──────────┐ │
│  │  🔍 방 찾기            │  │ + 만들기 │ │
│  └──────────────────────┘  └──────────┘ │
├─────────────────────────────────────────┤
│  참여 중인 방 (1)                        │
│  ┌───────────────────────────────────┐  │
│  │ [표지] 《사피엔스》 같이 읽어요    │  │
│  │        6명 · 오늘 4명 읽음 ●●●●○○  │  │
│  │        평균 진도 38%               │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  이 책 같이 읽는 방  (내 활성책 기준)    │
│  ┌───────────────────────────────────┐  │
│  │《사피엔스》 KAIST 독서             │  │
│  │ 12명 · 평균 21%        [참여하기]  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

| 요소 | 규칙 |
|---|---|
| CTA 우선순위 | **방 찾기 = Primary(솔리드)**, **만들기 = Secondary(토널/아웃라인)** — [DESIGN.md](../DESIGN.md) 버튼 위계 ([village.md](./village.md) §5.5.1 선례) |
| 참여 중인 방 카드 | 표지 · 방 이름 · 인원 · **오늘 불빛(●●●●○○ = 오늘 읽은 멤버 수)** · 평균 진도% |
| 추천 숲 | **내 활성책을 같이 읽는 공개 숲**(권유 카드 — 탭하면 미리보기 → 입장, **강제 join 아님**). 정렬 = **멤버 인원순 desc**(동률 최신순) + **갓 생긴 숲 1개 끼움**(rich-get-richer 완화, §7.6). 비참여자에겐 숲 이름·인원·평균만. 없으면 섹션 미노출 |
| 빈 상태 | 숲 아이콘 배지(Feather 모노라인) + "아직 들어간 숲이 없어요 · 같은 책 읽는 사람들과 같이 읽어볼까요?" + **숲 찾기 + 만들기 버튼** (#1056: 상단 액션바와 중복되던 1차 "숲 찾기 →" 버튼 제거 → 빈 카드 하나에 찾기+만들기 통합, DESIGN.md "1차 버튼 1개"). 상단 액션바(찾기·만들기)는 들어간 숲이 **있을 때만** 노출 |

### 4.3 방 찾기 — 하단 시트

마을의 "코드 입력 + 책으로 검색" 2탭 패턴을 **계승**하되 라벨만 방으로. 추가로 **초대 링크 붙여넣기**를 명시(토큰 URL).

```
┌─────────────────────────────────────────┐
│  방 찾기                           [×]   │
├─────────────────────────────────────────┤
│  [🔐 코드·링크]  │  [🌐 책으로 검색]     │
├─────────────────────────────────────────┤
│  ── 🔐 코드·링크 ──                      │
│  [ 초대 코드 또는 링크 붙여넣기      ]   │
│              [참여하기]                  │
│  ── 🌐 책으로 검색 ──                   │
│  [🔍 책 제목 · 저자 · ISBN 검색...   ]   │
│  ┌───────────────────────────────────┐  │
│  │ KAIST 독서  12명 · 21%  [참여하기] │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**책으로 검색** = 공개 방만 노출. **코드·링크** = 공개·비공개 모두(토큰/코드 직접 조회 — 전체 스캔 없음). 비공개 방이 비밀번호를 걸었으면 미리보기에서 비밀번호 입력(§4.5).

### 4.4 발견(① 피드)·책 상세에서 방으로 — 진입점

방의 유입은 **발견에서 흘러나온다**. "이 책을 같이 읽는 방이 있다"를 발견 맥락에 심어 *passive 발견 → active 참여*로 전환한다.

| 진입점 | 표시 | 동작 |
|---|---|---|
| 책 상세(`BookInfoModal`) | **"📖 이 책 N명 같이 읽는 중"** badge (숲 ≥ 1, 인원 ≥ 1 일 때만) | 탭 → 그 책의 공개 숲 / 없으면 badge 미노출 |
| 책 상세(`BookDetailModal` 책장) | **"🌳 이 책 같이 읽는 숲"** 추천 한 줄(`BookCoReadRow`, **그 책 공개 숲 ≥ 1 일 때만**, §7.6) | 탭 → 상세 닫고 추천 상위(인원 많은) 숲 입장. 공개 숲 0 이면 줄 자체 미노출 |
| 인기 책·피드 카드 책 | (badge 동일 규칙) | 동일 — 책 상세 경유 통일([feed.md](./feed.md) §5.7 책 상세 단일화 원칙) |
| 함께 탭 숲 목록 | "이 책 같이 읽는 숲" 추천 섹션(메인 노출 위치, §7.6) | 인원순+신규 끼움 권유 카드 — 탭하면 미리보기 → 입장 |
| 방 탭 상단 | "🔐 코드·링크" 입력 | §4.3 시트 |

> **추천은 권유, 자동입장 아님**(§7.6): 위 진입점·추천 섹션은 모두 "이 숲 어때요?" 권유 — 탭해야 입장(미리보기 경유). 등록 시 자동합류(§7.5 `rgAutoJoinPublicRoom`)와 **별개**다. **홈(둥지)에는 추천을 노출하지 않는다**(함께 탭 + 책 상세만).
>
> 카운트 노출 완화: **N ≥ 2 일 때만 "N명"** 노출(1명이면 badge 만, [feed.md](./feed.md) 인기 책 starters 선례와 동일 정신 — 1명짜리 과노출 방지). 빈/비-UUID 책 id·게스트는 badge 생략.

### 4.5 방 미리보기 (참여 전)

코드·링크·검색에서 방을 고르면 참여 전 미리보기. 비공개+비밀번호면 여기서 입력.

```
┌─────────────────────────────────────────┐
│  방 발견!                          [×]   │
├─────────────────────────────────────────┤
│  [표지]  《사피엔스》 같이 읽어요         │
│          만든 사람: @yunji               │
│          인원: 6 / 10명                  │
│          평균 진도: 38%                  │
├─────────────────────────────────────────┤
│  🔒 비밀번호  [ ________ ]   (비공개+PW만)│
├─────────────────────────────────────────┤
│  [취소]                  [참여하기]      │
└─────────────────────────────────────────┘
```

**엣지 케이스**:

| 상황 | 처리 |
|---|---|
| 코드/링크 형식 오류 | `"방을 찾을 수 없어요. 코드나 링크를 다시 확인해주세요."` |
| 이미 참여 중 | `[참여 중]` 비활성 버튼 |
| 비밀번호 틀림 | `"비밀번호가 맞지 않아요."` (참여 버튼 비활성 유지) |
| 정원 초과(capacity 설정 시) | `[정원 마감]` 비활성 버튼 |
| 공개 방 검색 결과 없음 | `"이 책을 같이 읽는 공개 방이 없어요. 직접 만들어볼까요? [방 만들기 →]"` |

---

## 5. 방 코어

### 5.1 방 만들기 플로우

| 단계 | 입력 |
|---|---|
| 책 선택 | 내 책장 또는 검색에서 1권 (`book_id`) |
| 방 이름 | 필수 |
| 공개 설정 | **공개**(책으로 검색 노출) / **비공개**(초대 링크·코드, 선택적 비밀번호) |
| 정원 | 선택 — 기본 제한 없음. 설정 시 최소 2명 (기존 `capacity` 컬럼 재사용) |
| 비밀번호 | 선택 — 비공개 방에 한해 설정 가능. **bcrypt 해시 + 서버 RPC 검증**(`password_hash`, 클라 비노출 — §6.4, #996) |

> **만든 사람(생성자)**: 방 생성자 자동 기록(`created_by`). P1 에서 생성자에게 별도 *권한*은 없다(역할·공동관리자·강퇴는 P2). 단 방 삭제는 생성자만(어댑터 `delete` 가 `created_by` 가드 — §6.3).
> **마일스톤(`village_parts`) 미사용**: P1 방 만들기에 챕터·마감 입력 단계 **없음**. 테이블은 존재하나 쓰지 않는다(P2 마일스톤에서 활성화).

### 5.2 접근 제어 (제품 owner 명시 요구)

> **결정됨.** 모든 방은 `invite_token` 을 갖는다. 공개 방은 책으로 검색되고, 비공개 방은 **초대 링크(토큰 URL) 또는 비밀번호**로만 들어온다.

| 공개 설정 | 발견 | 입장 경로 |
|---|---|---|
| **공개(public)** | ✅ 책(제목/저자/ISBN)으로 검색 노출 | 검색 → 참여 / 초대 링크·코드도 가능 |
| **비공개(private)** | ❌ 검색 비노출 | **초대 링크(토큰 URL)** OR **비밀번호** (둘 중 하나로 입장) |

- **`invite_token`** — 모든 방이 보유(공개·비공개 공통). 토큰 URL(예: `rgo.app/r/<token>`) 으로 직접 입장 미리보기. 기존 `invite_code`(6자리)는 사람이 부르기 쉬운 코드로 **병행 유지**(둘 다 같은 방을 가리킴).
- **`password`** — 비공개 방이 선택적으로 설정. 링크 없이도 코드+비밀번호로 입장 가능하게 하는 옵션. nullable.
- 비공개 방은 "링크를 받았거나(token) 비밀번호를 아는(password)" 둘 중 하나면 입장. 둘 다 요구하지 않는다.

### 5.3 방 내부 화면

마을의 3탭(멤버·한 문장·게시판)에서 **게시판을 떼고 2영역**으로 단순화. 헤더는 1줄(마감·파트 압박 제거).

```
┌─────────────────────────────────────────┐
│ ←  《사피엔스》 같이 읽어요        [⚙️]  │
├─────────────────────────────────────────┤
│  6명 · 오늘 4명 읽음 · 평균 진도 38%     │  ← 1줄 요약
├─────────────────────────────────────────┤
│   👥 멤버 진척    │   📖 한 문장          │  ← sticky 2탭
├─────────────────────────────────────────┤
│  (탭 영역)                               │
└─────────────────────────────────────────┘
```

#### 5.3.1 👥 멤버 진척 그리드

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  🏰    ● │  │  🪺    ● │  │  🪹    ○ │  ← 둥지 stage + 오늘 불빛(●/○)
│  yunji   │  │   kim    │  │   lee    │
│ 진도 75% │  │ 진도 50% │  │ 진도 3%  │
└──────────┘  └──────────┘  └──────────┘
```

| 카드 요소 | 규칙 |
|---|---|
| 둥지 이모지 | 방 지정 책의 진척 단계 ([nest.md §5.2](./nest.md) 단계표 — SSOT) |
| 오늘 불빛 (●/○) | **오늘 어떤 책이든 기록하면 ●** (스트릭과 동일 기준, [systems.md §6.1](./systems.md)). 방 진도%는 방 지정 책 기록만 반영 |
| 진척률 | `진도 XX%` = `읽은 페이지 / 책 전체 페이지 × 100` (완독 = 100%) |
| 정렬 | 진척률 내림차순(단순 표시 정렬일 뿐 — **랭킹/순위 번호 아님**, 경쟁 요소는 P2). 동률은 먼저 참여 순 |
| 카드 탭 | 해당 멤버 프로필로 이동(`RG_openProfile` — "아이디 보이는 곳은 프로필로", [feed.md](./feed.md) 선례) |

> **자동 반영**: 멤버의 평범한 일일 기록(페이지·한 문장)이 방에 그대로 반영된다 — **방 전용 체크인 없음**. 어댑터 `members()` 가 `user_books.current_page`·오늘 `reading_sessions`·최근 `sentences` 를 조인해 카드를 만든다(이미 구현됨, §6.2).
> **콕찌르기(🪱)·순위·콕 P1 제외** — 불 꺼진(○) 멤버 독려, 순위 번호, 랭킹은 P2(#988). P1 그리드는 *보여주기*만(같이 읽는 감각) — 찌르기/경쟁은 뒤로.

#### 5.3.2 📖 한 문장 (방 단위)

방 지정 책의 한 문장 모음. nest 의 "같은 책 타인 한 문장"을 **방 범위로 좁힌다**.

```
┌─────────────────────────────────────────┐
│ 오늘 4명 기록                            │
│ ──────────────────────────────────────  │
│ 🏰 yunji · p.245                         │
│ "새는 알에서 나오려고 투쟁한다."   ❤️ 3   │
│                                         │
│ 🪺 lee · p.112                           │
│ "역사는 필연이지만 그 순간엔 우연."  ❤️ 1  │
└─────────────────────────────────────────┘
```

| 항목 | 규칙 |
|---|---|
| 범위 | **방 지정 책의 한 문장만** 노출(다른 책 문장 제외) |
| 카드 | **공용 `SentenceCard` + `SentenceActions`** 단일 경유([feed.md](./feed.md) §5.7 SSOT, align_v7 불변식). 타인 문장 = ❤️ 좋아요만, 내 문장 = 공개범위·좋아요·수정·삭제 |
| 스포일러 | [feed.md §5.7.1](./feed.md) 페이지 블라인드 + `visibility` 동일 규칙 적용(전 영역 동일) |
| 작성자 탭 | 닉네임 → 프로필(`RG_openProfile`) |
| 나간 뒤 | 남긴 한 문장은 유지(`sentences` 는 방과 독립 — 책·유저 소유) |

### 5.4 방 나가기

"탈퇴" 대신 **나가기**. 이력(한 문장)은 보존.

| 진입 | 동작 |
|---|---|
| 헤더 [⚙️] → [나가기] | `village_members` 에서 제거. 멤버 그리드에서 사라짐. 남긴 한 문장은 유지(책·유저 소유라 독립). 다시 참여 가능 |

> 생성자 나가기·권한 이양은 P1 단순화: 생성자도 나갈 수 있다(방은 멤버 0 이어도 즉시 삭제하지 않음 — P1 은 가비지 컬렉션 미정의, P2 에서 다룸). 강퇴·역할은 P2.

### 5.5 방 설정 (헤더 ⚙️)

| 기능 | 규칙 |
|---|---|
| 초대 링크 복사 | `rgo.app/r/<invite_token>` |
| 초대 코드 복사 | 6자리(`invite_code` 병행) |
| 나가기 | 누구나 |

> 정원 수정·공개 전환·비밀번호 변경·멤버 관리(강퇴·역할)는 **P2**. P1 설정은 *공유 + 나가기*까지.

### 5.6 마일스톤 — 함께 읽기 일정/구간 (#999, P2 마일스톤)

> **결정됨 (#999).** 숲에 **공동 읽기 일정(구간)** 을 얹어 "같이 완독 챌린지"로 만든다. 별도 마감 압박 강제(레이스)는 아니고, *이번 구간이 어디고 누가 따라오는지*를 보여주는 느슨한 동행 + 가벼운 응원. `village_parts`(마을 유산) 활성화 — **새 테이블 없음**.

**구조**: 숲 내부(`RoomModal`, §5.3)에 **3번째 탭 "🗓️ 일정"** 추가(멤버 진척·한 문장과 일관). 한 문장·그리드와 같은 카드 위계.

| 영역 | 누구 | 동작 |
|---|---|---|
| **일정 설정/편집** | **host = `villages.created_by`만** (별도 역할 테이블 없음 — created_by=host 단순화) | 구간(part) 목록 작성·편집. 각 part = **제목 + 목표페이지(`end_page`) + 마감(`due_date`)**. 예: "1주차 ~120p (6/30)". `RoomScheduleEditor` 시트(구간 행 추가/수정/삭제 → `setParts` 전체 교체). 멤버는 read-only |
| **이번 구간 (활성 구간)** | 전원 | **날짜 기준 가장 임박한 미완 구간** = 마감(`due_date`)이 오늘 이후인 첫 구간(마감 없으면 그 첫 구간, 다 지났으면 마지막). 하이라이트 카드 — 제목·목표페이지·`D-N`/오늘마감/N일지남 |
| **멤버 위치** | 전원 | 멤버별 진도(그 숲 책 `user_books.current_page`, §5.3.1 진척 그리드가 이미 계산) vs 활성 구간 `end_page` → **완료**(≥목표) / **온트랙**(≥목표 80%) / **뒤처짐**(<80%). 자유 구간(목표 없음)은 항상 온트랙 |
| **함께 진도 집계** | 전원 | "N명 중 M명 이번 구간 완료" + 진행바 |
| **응원** | 전원 | **뒤처진 멤버**에 가벼운 응원 버튼 — 기존 `pokes`(콕찌르기) 재사용(`DataStore.pokes.send`). 로컬/게스트는 어댑터 no-op(표면 일치, 새 테이블 없음). 자기 자신은 응원 대상 제외 |
| **빈/콜드스타트** | 분기 | 일정 없는 숲 → **host**엔 "일정 만들기" CTA, **멤버**엔 "아직 일정 없음 — 숲을 만든 사람이 정하면 보여요" 안내 |

> **마일스톤 잔여(이 PR 범위 밖, 계속 미룸)**: ① **파트 랭킹 리더보드**(구간별 순위·경쟁) ② **host 외 역할**(공동관리자·강퇴·권한 이양) ③ **알림/리마인더 고도화**(마감 임박 푸시 등). 이들은 §7 "마일스톤 잔여"로 남긴다. 이 PR 은 *host 일정 설정 + 이번 구간 + 멤버 위치 + 집계 + 가벼운 응원 + 빈상태*까지.

---

## 6. 데이터 모델

> **핵심: 기존 마을 스키마를 재사용한다.** 새 테이블을 만들지 않는다 — `villages`/`village_members`/`is_village_member` RLS 가 그대로 방의 뼈대다. P1 은 컬럼 2개 추가만.

### 6.1 스키마 (재사용 + 컬럼 2개)

기존 `public.villages`(`supabase/schema.sql`)에 추가:

```sql
-- co-reading P1: 비밀번호(선택) + 토큰 URL 초대 (기존 villages 재사용)
alter table public.villages add column if not exists invite_token  text unique;  -- 모든 방, 토큰 URL 입장
-- 비밀번호 = bcrypt 해시 + 서버 RPC 검증 (#996, 35_room_password_hash.sql §6.4). 평문 컬럼 제거됨.
alter table public.villages add column if not exists password_hash text;          -- bcrypt 해시, 클라 read 차단(REVOKE)
alter table public.villages add column if not exists has_password  boolean not null default false;  -- 비번여부 플래그(비-비밀)
```

| 테이블/컬럼 | P1 사용 | 비고 |
|---|---|---|
| `villages` (id, book_id, name, visibility, invite_code, capacity, created_by) | ✅ | 마을 = 방. `name`·`visibility`(public/private)·`capacity`(정원)·`invite_code`(6자리) 그대로 |
| `villages.password_hash` (#996) | ✅ | nullable. 비공개 방 선택 비밀번호 **bcrypt 해시**(§6.4). 클라 read 차단(REVOKE). 구 평문 `password` 제거 |
| `villages.has_password` (#996) | ✅ | boolean(비-비밀). 비번 걸렸나 — 미리보기 입력칸 노출 판단(§4.5·§6.4) |
| `villages.invite_token` (신규) | ✅ | unique. 모든 방의 토큰 URL 입장(§5.2) |
| `village_members` (village_id, user_id, joined_at) | ✅ | 방 멤버십 그대로 |
| `village_parts` (id, village_id, part_order, title, end_page, due_date) | ✅ **마일스톤 활성화(#999)** | host(`villages.created_by`)가 구간(part) 목록 작성·편집(§5.6). 기존 컬럼 그대로 — 새 컬럼·새 테이블 없음. RLS `vparts_sel`(멤버/공개 read)·`vparts_mod`(host write)도 기존 정의 재사용(`schema.sql`) |
| `village_topics`/`village_opinions` (게시판) | ❌ P1 미사용 | **P2 게시판** |
| `is_village_member(uuid)` SECURITY DEFINER | ✅ | RLS 순환 방지 헬퍼 — `villages_sel`/`vmembers_sel` 정책 그대로 재사용(`schema.sql` RLS 블록) |

> **RLS**: `villages_sel`(public OR 생성자 OR `is_village_member`) · `vmembers_sel`(본인·같은 방·공개 방 멤버 조회)는 그대로. `invite_token`·`has_password` 는 컬럼이라 변경 불필요. **두 가지 예외:** ⑴ `password_hash` — `revoke select (password_hash)` 로 클라 read 차단, 검증은 SECURITY DEFINER RPC(`room_verify_password`)만(§6.4, #996). ⑵ **`vmembers_mod` 변경(#1022)** — `for all`(본인 행 insert/delete) → **`for delete`(본인 탈퇴)만**. 클라 직접 `village_members` insert 가 비번·정원 우회 경로였으므로 INSERT 자격을 회수하고, 멤버십 생성은 **SECURITY DEFINER RPC `room_join`/`room_create_membership`** 경유만(서버가 visibility·비번·정원 검증 후 insert — §6.3·§6.4, `36_room_join_rpc.sql`).

### 6.2 DataStore 계약 — `rooms.*` (구 `villages.*` 부활·rename)

> **결정**: 폐기된 `villages.*` 어댑터를 **`rooms.*` 로 rename·부활**한다. 시그니처는 P1 범위로 슬림화하되, 구현은 기존 `datastore-supabase.js` `villages` 블록을 재사용(메서드 이름만 방 용어로). local·supabase 어댑터 동일 시그니처([backend.md §7.2](./backend.md) DataStore 계약).

```
rooms.create({ bookId, name, visibility, capacity?, password? }) → Room   // invite_token·invite_code 자동 생성
rooms.join(roomId, { password? })       → true                            // 정원·비밀번호 검증
rooms.leave(roomId)                      → true
rooms.byBook(bookId, { limit? })         → Room[]                          // 공개 방, 책으로 검색/badge 카운트
rooms.myRooms()                          → Room[]                          // 참여 중인 방(구 listMine)
rooms.get(roomId)                        → Room
rooms.members(roomId)                    → MemberProgress[]                // 진도·오늘불빛·최근 한 문장 (구현 존재)
rooms.findByToken(token)                 → Room | null                     // 토큰 URL 입장 미리보기
rooms.findByCode(code)                   → Room | null                     // 6자리 코드 입장 미리보기

// 마일스톤(#999, §5.6) — village_parts. 멤버 read, host(created_by) write. 양 어댑터 대칭.
rooms.listParts(roomId)                  → Part[]                          // part_order 오름차순 [{id,village_id,part_order,title,end_page,due_date}]
rooms.setParts(roomId, parts[])          → Part[]                          // host 가 구간 목록 전체 교체(빈배열=삭제). part_order 1..N 재부여

// P2-1(§7.5) 같이읽기 기본 모드 — 클라 측 디바이스 플래그(consent 선례, 양 어댑터 대칭).
coReadMode.get()                         → 'together' | 'solo'             // 기본 'together'
coReadMode.set('together' | 'solo')      → 'together' | 'solo'             // 정규화 후 저장
```

> **모드 플래그가 왜 `rooms.*` 가 아니라 별도 `coReadMode` 인가**: 서버 상태가 아니라 *디바이스 설정*(이 기기에서 새 책을 공개로 열지)이라 `consent` 와 같은 위치·형태. 피처 파일 직접 `localStorage` 금지(align_v7 §S1) 준수 위해 어댑터에 둔다.

| 신 메서드(`rooms.*`) | 구 메서드(`villages.*`) | 변경 |
|---|---|---|
| `create` | `create` | `parts` 인자 제거(P1 마일스톤 없음), `password` 인자 추가(→ `room_set_password` RPC 로 **bcrypt 해시 저장**, #996), `invite_token` 생성 추가, **멤버 등록을 `room_create_membership` RPC 로**(직접 insert 제거, #1022) |
| `join` | `join` | 입장 **권한 서버측 강제**(#1022) — `room_join` RPC 호출(직접 `village_members` upsert 제거). 비번·정원을 서버가 최종 검증(내부 `room_verify_password` #996). errcode → 친화 메시지 |
| `leave`/`get`/`members` | 동일 | 시그니처 동일(재사용) |
| `byBook` | `listPublic` 확장 | 책 필터 검색(제목/저자/ISBN) — `listPublic` 에 book 필터 추가 |
| `myRooms` | `listMine` | rename |
| `findByToken` | (신규) | `invite_token` eq 조회(`findByCode` 와 동형) |
| `findByCode` | `findByCode` | 유지 |
| `listParts`/`setParts` | (신규, #999) | `village_parts` read/write. host(`created_by`) 가 일정 편집. RLS `vparts_mod` 가 host 가드 |
| ~~`delete`/`update`/`invite`/`listTopics`/`addTopic`/...~~ | 게시판·관리 | **P2** (P1 계약에서 제외 — 코드 잔존 가능하나 스펙 비노출) |

- **Phase 0(local)**: 타 사용자 부재 → `members` 는 나 1명, `byBook`/`myRooms` 는 로컬 방 목록. `listParts`/`setParts` 는 방 객체 `_parts` 인라인 배열(supabase `village_parts` 표면 일치). 표면 일치만 보장([backend.md](./backend.md) §7.2).
- **book_id 해소**: 로컬 책 id(`b104` 등)는 어댑터가 Supabase `books` UUID 로 upsert·해소(기존 `create` 로직 재사용).

### 6.3 입장 검증 위치 (#1022 — 서버측 강제)

> **결정·구현됨 (#1022, CSO HIGH · OWASP A01).** 입장(멤버십) 권한은 **서버가 최종**이다. 이전엔
> 정원·비밀번호를 클라(어댑터 JS)가 검사한 뒤 `village_members` 를 **직접 insert/upsert** 했는데,
> RLS(`vmembers_mod`)가 `user_id = auth.uid()` 만 봐서 join UI/검증을 건너뛴 직접
> `POST /rest/v1/village_members` 로 **비번·정원·visibility 우회 입장**이 가능했다. 이제 클라 직접
> insert 는 RLS 로 거부되고, 멤버십 생성은 **SECURITY DEFINER RPC `room_join`** 경유만 — 함수
> 안에서 서버가 검증한 뒤에만 행을 만든다(§6.4 표 참고).

| 검증 | 위치 (서버 = 최종 강제) |
|---|---|
| 정원(capacity) | **`room_join` RPC(서버)** — 현재 멤버수 ≥ capacity 면 `raise exception 'room is full'` → 어댑터가 `"정원이 마감되었습니다."`. 클라 카운트 미리보기는 UX 힌트일 뿐 |
| 비밀번호(password) | **`room_join` RPC(서버)** — 내부에서 `room_verify_password`(#996, bcrypt) 호출, 불일치면 `raise exception` → `"비밀번호가 맞지 않아요."`. 미리보기(§4.5)는 입력칸 노출 판단(`has_password`)만 |
| 토큰/코드 유효성 | `findByToken`/`findByCode` (없으면 null → "방을 찾을 수 없어요") |
| 멤버십 생성(insert) | **`room_join` / `room_create_membership` SECURITY DEFINER RPC 만** — 클라 직접 `village_members` insert 는 RLS(`vmembers_mod` = **delete(본인 탈퇴)만**)로 거부. `36_room_join_rpc.sql` |
| 열람권 | RLS(`is_village_member`) — 멤버 행이 곧 접근권. 그 행은 위 RPC 경유로만 생김 |

### 6.4 보안 메모 — 비밀번호 해시화 + 서버측 검증 (#996, 평문 후속)

> **결정·구현됨 (#996).** P1 의 평문 `password` 컬럼을 **bcrypt 해시 + 서버측 검증**으로 격상한다. 클라이언트에 해시·평문 모두 노출 금지 — 검증은 서버(Supabase RPC)에서만.

| 항목 | 방식 |
|---|---|
| 저장 | `villages.password_hash`(`text`) = `crypt(password, gen_salt('bf'))`(pgcrypto, **bcrypt**). 구 평문 `password` 컬럼은 **제거**(`35_room_password_hash.sql` 마이그레이션이 기존 평문→해시 1회 변환 후 drop). |
| 해시 노출 차단 | `revoke select (password_hash) on villages from anon, authenticated` — 해시 컬럼은 **클라가 read 불가**. 어댑터 select 도 `password_hash` 미포함(컬럼 명시, `*` 금지). |
| 비번여부 플래그 | `villages.has_password`(`boolean`, 비-비밀) — 미리보기에서 입력칸 노출 여부 판단용(해시 없이도 "비번 걸림"은 알아야 함). 클라 read 허용. |
| 설정/해제 (host) | `room_set_password(room_id, password)` — **SECURITY DEFINER** RPC, `created_by = auth.uid()`(host) 가드. 빈 값이면 해제(NULL). 해시 저장 + `has_password` 갱신. |
| 비번 검증 | `room_verify_password(room_id, password)` — **SECURITY DEFINER** RPC, `crypt(input, stored) = stored` 로 서버 비교, **boolean 만 반환**(해시 비노출). 비번 없는 방은 항상 `true`(입장 자유). |
| **입장 강제 (#1022)** | `room_join(room_id, password)` — **SECURITY DEFINER** RPC. 함수 안에서 ①방 존재 ②`room_verify_password`=true ③`count(village_members) < capacity` 를 검증한 **뒤에만** `insert into village_members(... auth.uid()) on conflict do nothing`. 실패는 `raise exception`(errcode 로 비번/정원/없는 방 구분). 생성자 등록은 `room_create_membership(room_id)`(`created_by=auth.uid()` 가드). |
| **직접 insert 차단 (#1022)** | `vmembers_mod` 를 `for all` → **`for delete`(본인 탈퇴)만** 으로 좁힘 → 클라 직접 `village_members` insert/upsert 거부. 멤버십은 위 두 RPC(정의자 권한 RLS 우회) 경유만. `36_room_join_rpc.sql`. |
| 어댑터 (supabase) | `rooms.create` 는 평문 insert 안 함 — 방 생성 후 `room_set_password` RPC 로 해시 저장, **멤버 등록도 `room_create_membership` RPC**(직접 insert 제거). `rooms.join` 은 `password` select·직접 upsert 제거 → **`room_join` RPC** 호출(서버가 비번·정원 최종 검증). |
| 어댑터 (local, Phase 0) | 서버 부재 → 평문 비교 불가피(한계 명시). 저장 레코드엔 평문 유지하되 **반환 표면에선 `password` 제거 + `has_password` 만 노출**(supabase 표면 일치). 멤버십 강제는 로컬(단일 사용자)이라 무의미. |

- `invite_token` 은 추측 불가한 충분 길이(예: 22+ 문자) 랜덤. unique 충돌 시 재시도(기존 `invite_code` 5회 재시도 패턴 재사용).
- **마이그레이션 수동 적용 전제**: `35_room_password_hash.sql`(pgcrypto 확장·`password_hash`/`has_password` 컬럼·REVOKE·RPC 2개)은 Supabase Dashboard SQL Editor 또는 Management API 로 **사람이 1회 실행**해야 한다(코드 머지 ≠ DB 적용). `migrations_applied.py` 는 컬럼/테이블만 검사하므로 RPC·REVOKE 는 적용 후 수동 확인.

---

## 7. SLC 범위 — P1 vs P2

> **P1 = #987(완료, PR #995) · P2-1 = #988(완료) · 마일스톤 = #999(이 PR).** P1 은 *발견→숲 퍼널 + 숲 코어*. P2-1 은 *같이 기본(opt-out) + 공개 자동합류*(§7.5) + *명칭 "숲" 확정*(§8). **#999(이 PR)** 는 *함께 읽기 일정(마일스톤)*(§5.6) — host 일정 설정 + 이번 구간 + 멤버 위치 + 집계 + 가벼운 응원. 나머지 P2(게시판·역할·auto-match 풀·파트 랭킹·리마인더)는 계속 미룬다.

| 기능 | P1 (#987) | P2-1 (#988) | #999 (이 PR) | P2 잔여 | 비고 |
|---|---|---|---|---|---|
| 함께 탭 재편(발견+숲 2레이어) | ✅ | | | | IA 결정 C(§2) |
| 숲 만들기(책·이름·공개/비공개·정원) | ✅ | | | | §5.1 |
| 참여·나가기 | ✅ | | | | §5.1·5.4 |
| 접근 제어(공개 검색 / 비공개 토큰·비밀번호) | ✅ | | | | §5.2 |
| 발견(공개 숲 책 검색·"N명" badge·코드/링크) | ✅ | | | | §4.4 |
| 멤버 진척 그리드(진도%·오늘불빛·둥지) | ✅ | | | | §5.3.1 |
| 숲 한 문장 모음(숲 지정 책) | ✅ | | | | §5.3.2 |
| 진척 자동 반영(별도 체크인 없음) | ✅ | | | | §5.3.1 |
| **명칭 "숲" 확정**(화면 텍스트, 탭 "함께" 유지) | | ✅ | | | §8 (owner 결정) |
| **책 등록 기본 = 같이+공개(opt-out 토글)** | | ✅ | | | §7.5 — 등록 글루 + 토글 |
| **공개 숲 자동합류**(byBook→join, 없으면 create) | | ✅ | | | §7.5 — P1 `rooms.*` 재사용 |
| **마일스톤: host 일정 설정(구간 제목·목표페이지·마감)** | | | ✅ | | §5.6 — `village_parts` 활성화·`setParts` |
| **마일스톤: 이번 구간(날짜 기준 활성 구간 하이라이트)** | | | ✅ | | §5.6 |
| **마일스톤: 멤버 위치(완료/온트랙/뒤처짐) + 집계** | | | ✅ | | §5.6 — 진척 그리드 진도 재사용 |
| **마일스톤: 뒤처진 멤버 응원**(`pokes` 재사용) | | | ✅ | | §5.6 — 새 테이블 없음 |
| 마일스톤: 파트 랭킹 리더보드(구간별 순위) | | | | ✅ | 경쟁 요소 — 마일스톤 잔여 |
| 마일스톤: 알림/리마인더 고도화(마감 임박 푸시) | | | | ✅ | 마일스톤 잔여 |
| **auto-match 추천(공개 숲 권유 — 인원순+신규 끼움)** | | | | ✅(#997) | §7.6 — 함께 탭 + 책 상세, 추천만(자동입장 X) |
| auto-match: 페이스(진도대) 매칭·임베딩/ML | | | | ✅ | 규모상 과설계 — 보류(후속) |
| 게시판(주제·의견) | | | | ✅ | `village_topics`/`village_opinions` |
| 역할(공동관리자·강퇴·권한 이양) | | | | ✅ | 마일스톤 잔여(host 외 역할) |
| 콕찌르기(🪱) 숲 내부 일반 | | | | ✅ | (응원은 #999 에서 뒤처진 멤버 한정 도입) |
| 순위 번호·랭킹·완독 레이스 | | | | ✅ | P1 그리드는 표시 정렬만, 경쟁 X |
| 숲 상태(활성/완료)·완독 자동 아카이브 | | | | ✅ | 마일스톤 의존 |

### 7.5 P2-1 결정 — "같이가 기본(opt-out) + 공개 자동합류" (#988)

> **결정됨 (제품 owner).** 사용자 의도: *"혼자라고 하면 그냥 아무것도 아니잖아. 함께 설정해두고 공개로 열면 알아서 붙어서 읽는다."* → **만남을 기본값으로.** P1 의 보류 사유(분기 UX·자동매칭 비자명)를 **"같이+공개 자동합류"만 먼저** 떼어 구체화한다. auto-match 풀(추천 기준·매칭 알고리즘)은 여전히 P2 잔여.

**모드 (클라 측 경량 플래그 — `rg_coread_mode`, consent 패턴)**: `'together'`(기본=같이+공개) · `'solo'`(혼자). 게스트/로컬/Supabase 어디서나 동일 동작.

| 모드 | 동작 | 프라이버시 |
|---|---|---|
| **같이+공개 (기본)** | 책을 *읽는 중*으로 등록(읽기 시작)하면 그 책의 **공개 숲에 자동 합류** — `rooms.byBook(bookId)` 로 기존 공개 숲을 찾아 있으면 `join`(인원 많은 곳 우선), 없으면 `rooms.create({visibility:'public'})`. = "알아서 붙어서 읽는다." | 그 책 숲에서 "읽는 중"이 보인다 |
| **혼자 (opt-out)** | 토글로 전환. 숲 합류 안 함, 조용히 읽음. 등록 전·후 모두 전환 가능 | 비공개(노출 없음) |
| **같이+비공개** | P1 수동 경로(토큰/비밀번호 숲, §5.1·§4.3) 재사용 — P2 가 새로 만들지 않음 | 초대받은 사람만 |

**토글 (되돌릴 수 있게, 명확히)**:
- **숲 탭 상단 상주**(`CoReadModeToggle`). "공개로 같이 읽기" ↔ "혼자 읽기". 켜짐 = 등록 시 자동합류, 꺼짐 = 합류 안 함. **갱신(#1056)**: **홈(둥지) 첫 등록 빈 상태에서는 토글 제거** — 책도 없는 신규 유저에게 "숲/공개"는 일러 온보딩을 흐린다(첫인상 단순화). opt-out 기본값은 숲 탭 토글로 동일 설정 가능하고 등록 후 책 상세/숲에서도 전환된다. 토글 아이콘도 이모지(🌳/🔒)→Feather 모노라인(나무/자물쇠, 탭바 결).
- 토글은 **프라이버시 트레이드오프를 그 자리에서 안내**한다("새 책은 같은 책 공개 숲에 자동으로 함께해요 · 읽는 중이 보여요"). 기본 공개의 비용을 사용자가 인지하게 하는 게 결정의 일부.
- 읽는 중 노출이 싫어지면: 토글을 *혼자*로 + 해당 숲에서 *나가기*(P1 ⚙️→나가기). (이미 합류한 숲을 토글만으로 자동 탈퇴시키진 않는다 — 명시적 나가기 유지.)

**제약 (이 PR)**:
- **반드시 P1 `rooms.*` 계약만 재사용**(`byBook`·`join`·`create`·`myRooms`). 새 저장소 직접호출·새 테이블 **없음**. P2-1 의 본체는 *등록 시점 글루(app.js `handleSearchSelectBook`) + 토글 UI(co-reading.js) + CSS*.
- 자동합류는 **fire-and-forget** — 실패해도 책 등록 자체는 막지 않는다(조용히).
- **로그인 유저만 자동합류**(#1035 P2): 게스트(미로그인)는 자동합류·"함께했어요" 토스트를 **모두 skip** 한다. together 가 기본이라 게스트가 책을 등록하면 로컬 어댑터가 **아무도 없는 1인 로컬 숲**을 만들고 "🌳 …같이 읽는 숲에 함께했어요" 토스트를 띄워, 실제로는 혼자인데 모임에 든 듯한 오해를 줬다. 호출부(app.js `handleSearchSelectBook`)가 call-time 에 세션(`RG_SB.currentUser()`)을 확인해 미로그인이면 헬퍼를 부르지 않는다(콜백 stale-closure 회피). 등록 자체는 막지 않는다. 교차 사용자 합류는 여전히 Supabase 로그인 의존.
- 중복 숲 방지: 같은 책 공개 숲에 이미 들어가 있으면(`myRooms` 교차 확인) 새로 만들지 않는다(멱등).

> **auto-match 추천 후속 = #997(§7.6, 구현됨)**: "같이/혼자" 분기는 위 토글로, **능동 추천(공개 숲 권유)** 은 §7.6 으로 해소. **페이스(진도대) 매칭·임베딩/ML** 은 규모상 과설계라 **보류**(후속).

### 7.6 P2 결정 — 공개 숲 auto-match 추천 (#997)

> **결정됨 (제품 owner).** §7.5 자동합류는 "그 책의 공개 숲에 붙는다"까지. 이를 능동 **추천**으로 확장한다 — 단 **추천만, 자동입장은 안 한다.** 추천은 "이 숲 어때요?" **권유 카드(탭하면 미리보기 → 입장)** 이지 강제 join 이 아니다(등록 시 자동합류 §7.5 와 별개). **페이스(진도) 매칭·임베딩/ML 은 규모상 과설계라 이번 범위 밖(보류).**

**노출 위치** (홈=둥지에는 노출 안 함):

| 위치 | 무엇 | 비고 |
|---|---|---|
| **함께 탭 숲 목록 추천 섹션 (메인)** | 내 활성책을 같이 읽는 공개 숲 권유 카드(`RoomsView`) | 탭 → `RoomPreviewSheet` 미리보기 → 입장 |
| **책 상세 "이 책 같이 읽는 숲" 한 줄** | `BookCoReadRow` — 그 책 공개 숲 ≥ 1 일 때만(`BookDetailModal`) | 탭 → 상세 닫고 추천 상위 숲 입장. 공개 숲 0 이면 줄 미노출 |

**랭킹 (`rgRankRecommendedRooms`)** — 자동합류·추천·badge 가 제각각이던 정렬을 **하나로 통일**:

1. **멤버 인원수 desc** — 사람 있는 숲을 위로(빈 숲보다 동행 가능성↑). 동률은 **최신 created_at**.
2. **갓 생긴 숲 1개 끼움** — 후보 중 가장 최근 생긴 숲을 결과에 **반드시 포함**(인원순에서 limit 밖으로 밀렸어도 마지막 자리를 양보해 끼운다). 인기 숲만 비대해지는 **rich-get-richer 완화**.
3. 이 통일된 정렬을 어댑터 `rooms.byBook` 자체에도 반영(`created_at desc`만 → **인원순 desc, 동률 최신**). 자동합류(§7.5 `rgAutoJoinPublicRoom`)·badge(§4.4)·추천이 같은 순서를 본다.

**제약 (이 PR)**:
- **P1/P2-1 `rooms.*` 계약만 재사용**(`byBook`·`myRooms`). 새 저장소 직접호출·새 테이블·새 컬럼 **없음**. 본체는 *랭킹 헬퍼 + `RoomsView` 추천 섹션 + `BookCoReadRow` + CSS + `byBook` 정렬*.
- **자동입장 금지**: 추천은 탭해야 입장(미리보기 경유). 등록 시 자동합류(`rgAutoJoinPublicRoom`, §7.5)는 이 PR 에서 **건드리지 않는다**(별개 동선).
- 게스트/로컬은 어댑터가 로컬 숲만 다루므로 표면만 일치(교차 사용자 추천은 Supabase 로그인 의존, §10.6 동일).

> **보류(이번 X)**: 페이스(진도대) 매칭 — 멤버 진도 분포로 "내 속도와 맞는 숲" 추천. 임베딩·ML 기반 매칭. 둘 다 현재 규모(공개 숲 소수)에선 과설계라 후속 이슈로.

---

## 8. 이름 (확정)

> **방 단위 정식 명칭 = "숲" (확정, owner #987 후속).** 메타포 계보: 마을은 "둥지(nest)가 모인 것"이었다 → 많은 둥지가 사는 곳 = **"숲"**. 서사: 둥지(내 개인 홈)에서 나와 같은 책의 "숲"으로 모인다. **화면에 보이는 텍스트는 모두 "숲"** 으로 통일(방 만들기→숲 만들기, 방 찾기→숲 찾기 등). **탭 라벨은 "함께" 유지**(변경 금지). placeholder "방" 폐기.
>
> **본문 표기 규약**: §1–6 의 설계 산문에 남은 "방"(P1 작성 시 placeholder)은 모두 **"숲"으로 읽는다**(정식 명칭 = 숲, 위 확정). 산문 일괄 치환은 churn·회귀 위험이 커 화면 텍스트(코드)와 §7.5·§8·§10 만 "숲"으로 갱신했고, §1–6 placeholder 는 이 규약으로 해소한다(구현은 화면 텍스트 기준).

| 항목 | 상태 |
|---|---|
| 탭 라벨 | **"함께"** — 확정(변경 금지) |
| 방 단위 명칭 | **"숲"** — 확정. 화면 텍스트 전부 "숲" |
| 내부 탭 키 | `social` 유지(코드 호환) |
| 코드 식별자 | `rooms.*`·CSS `.rg-room-*`·함수명(`RoomsView`/`RoomModal`/`rgRoomNestEmoji`)·`RG_openRoom` **변경 안 함**(회귀·churn 방지). 명칭 변경은 화면 텍스트만 |

---

## 9. 미해결 (open decisions)

| # | 안건 | 상태 |
|---|---|---|
| 1 | 방 단위 정식 명칭 | ✅ **확정 = "숲"**(§8, #987 후속) |
| 2 | 탭 라벨 "함께" vs "같이" | ✅ **확정 = "함께"**(§8) |
| 3 | `password` 저장 방식(평문/해시/서버검증) | ✅ **해소 = bcrypt 해시 + 서버 RPC 검증**(§6.4, #996). 평문 컬럼 제거, 해시 클라 비노출 |
| 3b | 입장 권한 강제 위치(클라 vs 서버) | ✅ **해소 = 서버측**(§6.3, #1022 CSO HIGH). 클라 직접 `village_members` insert 회수(`vmembers_mod` = delete만), 멤버십은 `room_join`/`room_create_membership` SECURITY DEFINER RPC 경유만 |
| 4 | 멤버 0 숲 가비지 컬렉션 | 보류 — §5.4, P2 |
| 5 | "혼자/같이" 분기 + auto-match | ◐ **분기 = 해소**(§7.5, #988) · **추천(공개 숲 권유 — 인원순+신규 끼움, 자동입장 X) = 해소**(§7.6, #997). **페이스(진도대) 매칭·임베딩/ML**만 보류(과설계, 후속) |
| 6 | 숲 탭 미읽음/오늘 신호 배지 | 보류 — §4.1, P1 미적용(목록만), P2 검토 |
| 7 | 마일스톤(함께 읽기 일정/구간) | ◐ **코어 = 구현**(§5.6 host 일정 + 이번 구간 + 멤버 위치 + 집계 + 응원, #999, 이 PR). **파트 랭킹·host 외 역할·리마인더**만 마일스톤 잔여 |
| 8 | 활성 구간 판정 기준 | ✅ **확정 = 날짜 기준**(마감 ≥ 오늘인 첫 구간; 마감 없으면 그 첫 구간, 다 지났으면 마지막). §5.6. *진도 기준*(완료된 다음 구간)은 멤버마다 달라 "공동 이번 구간" 메타포와 안 맞아 기각 |

---

## 10. 구현 상태 (as-built)

> 스펙↔구현 동기화 (CONTRIBUTING §4.1). 이 절은 코드 PR과 함께 갱신된다.
> 10.1–10.3 = **P1**(#987, PR #995). 10.4 = **명칭 "숲" 확정**. 10.5 = **P2-1 같이 기본 + 공개 자동합류**(#988). 10.6 = 잔여. 10.7 = **마일스톤 — 함께 읽기 일정/구간**(#999). 10.8 = **auto-match 추천 — 공개 숲 권유**(#997, 이 PR).

### 10.1 마이그레이션

`docs/readinggo/supabase/34_co_reading_rooms.sql` — `villages.password`(nullable) + `villages.invite_token`(unique) 컬럼 2개 추가 + `invite_token` 부분 인덱스. 기존 `villages`/`village_members`/RLS 그대로 재사용(병렬 테이블·새 RLS 신설 없음, §6.1). `schema.sql` 통합 정의에도 반영. **적용 = 사람(또는 Management API)이 라이브 DB에 실행** — `migrations_applied.py` 가 적용 여부를 검사(코드 머지≠DB 적용).

`docs/readinggo/supabase/35_room_password_hash.sql` (#996) — 비밀번호 평문 → **bcrypt 해시 + 서버측 검증** 격상(§6.4). pgcrypto 확장 + `villages.password_hash`(해시)·`has_password`(플래그) 컬럼 + `revoke select (password_hash)`(클라 read 차단) + RPC 2개(`room_set_password` host-only, `room_verify_password` boolean). 기존 평문 `password` 는 해시로 1회 변환 후 컬럼 drop. **수동 1회 적용 필수**(Dashboard SQL Editor/Management API). `migrations_applied.py` 는 컬럼/테이블만 검사 — RPC·REVOKE 는 적용 후 수동 확인.

`docs/readinggo/supabase/36_room_join_rpc.sql` (#1022, CSO HIGH) — 입장 권한 **서버측 강제**(§6.3). SECURITY DEFINER RPC 2개(`room_join(room_id, password)` = 방존재·비번·정원 검증 후에만 멤버 insert; `room_create_membership(room_id)` = 생성자 host 가드 자기등록) + RLS `vmembers_mod` 를 `for all` → **`for delete`(본인 탈퇴)만** 으로 좁혀 클라 직접 `village_members` insert/upsert 차단. `room_verify_password`(#35)에 의존하므로 **35 를 먼저 적용**한 뒤 36 을 **수동 1회 적용**(Dashboard/Management API). `migrations_applied.py` 는 컬럼/테이블만 검사 — RPC·정책 변경은 적용 후 수동 확인. (둘 다 미적용 시 `migrations` CI 가 빨간불 — 의도된 "적용 필요" 신호, #633.)

### 10.2 DataStore 계약 `rooms.*` (양 어댑터 대칭)

`js/datastore.js`(localStorage) · `js/datastore-supabase.js`(supabase) 양쪽에 동일 시그니처 구현(§6.2):

`create({bookId,name,visibility,capacity?,password?})` · `join(roomId,{password?})` · `leave(roomId)` · `byBook(bookId,{limit?})` · `myRooms()` · `get(roomId)` · `members(roomId)` · `findByToken(token)` · `findByCode(code)` · **`listParts(roomId)` · `setParts(roomId,parts[])`**(마일스톤 #999, §10.7).

- `invite_token` = 26자 랜덤(crypto, §6.4). `invite_code` 6자리 병행. UNIQUE 충돌 5회 재시도.
- `password` = **bcrypt 해시 + 서버측 검증**(#996, §6.4). supabase: `create` 후 `room_set_password` RPC 로 해시 저장, `join` 은 `room_verify_password` RPC(boolean)로 검증(평문·해시 클라 비노출). local(Phase 0): 서버 부재로 평문 비교 불가피하되 반환 표면은 `has_password` 만(평문 제거 — supabase 표면 일치).
- supabase `rooms.*` 는 폐기 `villages.*` 구현 재사용(rename·slim, 게시판 메서드는 P1 계약에서 제외). `parts` 는 #999 에서 `village_parts` 로 활성화(§10.7). 구 `villages.*` 블록은 잔존(데드, 호환).
- **`pokes`** — 마일스톤 응원용. supabase 는 기존 `pokes.send(toUserId)`, local 은 no-op 어댑터 추가(대칭, 새 테이블 없음).
- local 어댑터: 타 사용자 부재 → `members` 는 나 1명, `byBook`/`myRooms` 는 `rg_rooms_v1` 키 로컬 방. 표면 일치만 보장.

### 10.3 UI

- `js/co-reading.js` — `RoomsView`(숲 탭 §4.2: 참여 중·추천·찾기/만들기) · `FindRoomSheet`(§4.3) · `CreateRoomSheet`(§5.1) · `RoomPreviewSheet`(§4.5) · `RoomModal`(§5.3: 멤버 진척 그리드 + 한 문장 2탭 + ⚙️ 공유/나가기). `window.RoomsView`/`window.RoomModal` 노출.
- `js/social.js` — 피드 탭을 **'함께'** 셸로 재편(§2.1): 상단 세그먼트 **① 발견 / ② 숲**, 기본=발견. 발견 = 기존 피드 그대로(`DiscoverLayer`, feed.md §5.7 보존), 숲 = `RoomsView`. 내부 탭 키 `social` 유지.
- `js/app.js` — 하단 탭 라벨 **함께**(피드→함께, P1). `window.RG_openRoom(roomId)` 등록 + `RoomModal` 포털.
- `js/book-info-modal.js` — "📖 이 책 N명 같이 읽는 중" badge(§4.4, N≥2 일 때만 카운트) → 숲 진입.
- `index.html` — `.rg-btn-primary`/`.rg-btn-tonal`(DESIGN.md 버튼 위계: 1차 솔리드/2차 tonal, ghost 금지) + `.rg-room-*` + `.rg-coread-*` 클래스.
- `render-smoke.mjs` — 탭 라벨(함께) 검증. 탭은 "함께"라 명칭 변경 무관.
- **멤버 그리드 둥지 이모지** = 숲 책 진척% 5구간 매핑(🌿🪹🪺🐣🏰, `NEST_STAGES` 이모지 재사용, `rgRoomNestEmoji`). 오늘 불빛(●/○) = 오늘 어떤 책이든 기록(스트릭 동일 기준).
- **방 UI 아이콘 rgIcon 통일(#1062)** — `RoomModal` 설정 메뉴·탭·세그먼트의 반쯤 변환된 기능 이모지(🔢→hash·🚪→logout·👥→users·🗓→calendar·🌐→globe·🔐/🔒→lock)를 `rgIcon` 모노라인으로 통일(`icons.js` `RG_ICONS` 에 hash·logout·users·calendar·lock·globe 6개 추가, Feather 지오메트리). 둥지 단계(🌿🪹🪺🐣🏰)·🌳숲·💪응원·비밀번호 `placeholder` 🔒(텍스트 장식, SVG 불가)는 KEEP — `tests/spec-align/design_lint.py` denylist 동반 갱신.

### 10.4 명칭 "숲" 확정 (이 PR, §8)

- **화면 텍스트 전부 "방" → "숲"**: `js/co-reading.js`(숲 만들기/찾기/발견 버튼·헤더·토스트·에러·빈상태·섹션) · `js/social.js`(세그먼트 `② 숲`). 탭 라벨 "함께"는 유지.
- **코드 식별자는 불변**: `rooms.*` 계약·CSS `.rg-room-*`·함수명(`RoomsView`/`RoomModal`/`rgRoomNestEmoji`/`FindRoomSheet`…)·`RG_openRoom`·내부 탭 키 `social` 그대로(회귀·churn 방지).
- badge 카피("📖 이 책 N명 같이 읽는 중")는 "방" 단어를 안 써 변경 불필요.

### 10.5 P2-1 — 같이 기본(opt-out) + 공개 자동합류 (이 PR, §7.5)

- `js/datastore.js` · `js/datastore-supabase.js` — `coReadMode.get()/set()` 어댑터 추가(양 대칭, `consent` 선례. `rg_coread_mode` 키, 기본 `together`). 피처 파일 직접 localStorage 금지(align_v7 §S1) 준수.
- `js/co-reading.js`:
  - `rgCoReadMode()`/`rgSetCoReadMode()` — `DataStore.coReadMode.*` 경유(어댑터). `window.RG_coReadMode`/`RG_setCoReadMode` alias + `rg:coread-mode-changed` 이벤트로 토글 동기화.
  - `rgAutoJoinPublicRoom(book)` — together 모드 시 `rooms.byBook`→없으면 `rooms.create({visibility:'public'})`. `myRooms` 교차 확인으로 멱등(중복 숲 방지). `window.RG_autoJoinPublicRoom`.
  - `CoReadModeToggle` — 2차 tonal 카드 + 스위치(ghost 금지). 프라이버시 트레이드오프 안내문 포함. `window.CoReadModeToggle`.
- `js/app.js` — `handleSearchSelectBook`(읽는중 등록 단일 퍼널)에서 등록 성공 후 `RG_autoJoinPublicRoom` **fire-and-forget**(solo·실패는 no-op, 등록 안 막음). 합류 시 토스트. **#1035 P2: 로그인 유저만** — call-time 에 `RG_SB.currentUser()` 로 세션 확인, 게스트(미로그인)면 자동합류·토스트 skip(유령 1인 로컬 숲·오해 토스트 방지, §7.5).
- `js/nest.js` — 홈 빈 상태(첫 등록 전)에 `CoReadModeToggle` 노출(등록 전 기본 선택).
- `js/co-reading.js` `RoomsView` 상단 상주 토글 + `RG_roomsChanged`/`rg:rooms-changed` 수신해 자동합류·나가기 후 목록 갱신.
- `index.html` — `.rg-coread-mode*`/`.rg-coread-switch`/`.rg-coread-knob` CSS.
- **검증**(로컬 게스트, render-smoke + 브라우저 JS): together 자동 create 공개 숲 ✅ · 기존 공개 숲 있으면 join(새로 안 만듦) ✅ · 멱등(같은 책 2회 호출 1개) ✅ · solo no-op ✅ · 토글 together↔solo 되돌림·스위치 반영 ✅.

### 10.6 잔여 (정직 표기)

| 항목 | 상태 |
|---|---|
| 책으로 숲 검색(§4.3) | ✅ 구현. 단 **공개 숲 카탈로그 검색은 Supabase 실데이터 의존** — 게스트/로컬은 로컬 숲만 노출(표면만). 실 로그인 교차 사용자 검증 권장 |
| 공개 자동합류 교차 사용자 | ✅ 로직 동작(로컬 검증). 단 **타 사용자의 공개 숲에 실제로 붙는 건 Supabase 로그인 의존** — 게스트/로컬은 자기 로컬 숲만(표면 일치). |
| auto-match 풀(추천·매칭 기준) | ❌ **P2 잔여(#988)** — 매칭 풀·기준 설계 비자명. 이 PR은 "같이/혼자 분기 + 공개 자동합류"까지 |
| 숲 미리보기 capacity 'N/M' | ✅ 인원 카운트는 `village_members(count)` 임베드 의존(supabase) |
| `password` 해시화 | ✅ **구현(#996)** — bcrypt 해시 + 서버 RPC 검증(§6.4). 마이그레이션 `35_room_password_hash.sql` 수동 적용 필요 |

> 위 잔여는 대부분 *기능 누락*이 아니라 **실데이터(Supabase 로그인) 의존 표면** — 핵심 루프(만들기·참여·접근제어·진척 그리드·한 문장·나가기·**자동합류·모드 토글**)는 양 어댑터에서 동작.

### 10.7 마일스톤 — 함께 읽기 일정/구간 (이 PR, #999, §5.6)

- **마이그레이션 = 없음(불필요).** `village_parts` 테이블(id·village_id·part_order·title·end_page·due_date)·인덱스(`idx_vparts_village_order`)·RLS(`vparts_sel` 멤버/공개 read, `vparts_mod` host write)는 **이미 `schema.sql` 에 마을 유산으로 존재**. 라이브 DB(project `cttllwwkaddghqttyhkg`)에서 Management API 로 컬럼·RLS 실측 확인 완료(컬럼·정책 모두 spec 과 일치). 새 컬럼·새 테이블·새 RLS **없음** — 활성화만.
- **DataStore 계약**(양 어댑터 대칭, §6.2):
  - `js/datastore-supabase.js` `rooms.listParts(roomId)`(`village_parts` select, part_order asc) · `rooms.setParts(roomId, parts[])`(기존 parts delete 후 새로 insert = 전체 교체; RLS `vparts_mod` 가 host 가드). 빈 텍스트·빈 값 행은 필터.
  - `js/datastore.js`(local) — 방 객체 `_parts` 인라인 배열로 동일 표면. `created_by` 가드(로컬 host='me' 폴백). `pokes`(send/listReceived) no-op 어댑터 추가(supabase pokes 와 대칭, 응원용).
- **UI** `js/co-reading.js`:
  - `RoomModal` 에 **3번째 탭 "🗓️ 일정"** 추가(멤버 진척·한 문장과 일관, §5.3).
  - `RoomSchedule` — 이번 구간 하이라이트 + 멤버 위치(완료/온트랙/뒤처짐) + "N명 중 M명 완료" 진행바 + 전체 구간 목록(활성 하이라이트) + (host)편집/(member·뒤처짐)응원. 빈/콜드스타트 분기(host=만들기 CTA, member=안내).
  - `RoomScheduleEditor` 시트 — 구간 행(제목·목표페이지`number`·마감`date`) 추가/삭제/수정 → `setParts` 저장. host 만 진입.
  - 헬퍼: `rgActivePartIndex`(날짜 기준 활성 구간) · `rgMemberPartStatus`(완료/온트랙≥80%/뒤처짐) · `rgDaysUntil`/`rgDueLabel`(D-N). `window.RoomSchedule`/`rgActivePartIndex`/`rgMemberPartStatus` 노출.
  - host 판정 = `room.created_by === ((RG_ME&&RG_ME.id)||'me')` (로컬/게스트 생성자도 host 로 인식).
- **응원** = `DataStore.pokes.send(userId)` 재사용(뒤처진 멤버, 자기 자신 제외). 로컬/게스트는 no-op 이어도 토스트로 따뜻한 피드백. **새 테이블 없음.**
- `index.html` — `.rg-part-*` CSS(이번 구간 카드=brand-soft tonal + brand 보더, 뒤처짐 배지=fire 계열 부드러운 경고, 응원 버튼=tonal, ghost 금지 — DESIGN.md 위계).
- **검증**(로컬 게스트, render-smoke 통과 + 브라우저 JS·DOM·computed-style):
  - `setParts`/`listParts` 라운드트립(part_order 1..N) ✅ · 전체 교체(replace) 멱등 ✅ · 빈배열=삭제 ✅.
  - 활성 구간 = 마감 ≥ 오늘인 첫 구간(과거 구간 스킵) ✅(today 6/25 기준 6/20 스킵→6/30 "2주차" D-5).
  - 멤버 위치 완료/온트랙/뒤처짐 판정 ✅ · "N명 중 M명 완료" 집계 ✅ · 전체 일정 활성 행 하이라이트 ✅.
  - host 빈상태 "일정 만들기" CTA ✅ · member 빈상태 안내 ✅ · 편집 시트 기존 parts 프리필 ✅ · computed-style DESIGN 위계(tonal·no ghost) ✅.
- **마일스톤 잔여(이 PR 범위 밖, §5.6·§7)**: 파트 랭킹 리더보드 · host 외 역할(공동관리자·강퇴·이양) · 알림/리마인더 고도화. auto-match(#997)·게시판·비번해시(#996)는 본 PR 무관.

### 10.8 auto-match 추천 — 공개 숲 권유 (이 PR, #997, §7.6)

- **마이그레이션·새 테이블·새 컬럼 = 없음.** 기존 `rooms.byBook`·`myRooms` 계약만 재사용(§7.6 제약).
- **랭킹 정렬 통일** — `js/datastore-supabase.js`·`js/datastore.js` `rooms.byBook`: `created_at desc`만 → **멤버 인원수 desc(동률 최신순)**. supabase 는 `village_members(count)` 임베드 집계라 PostgREST `.order()` 불가 → `created_at desc` 로 받아 JS 재정렬, **`limit` 은 정렬 뒤 적용**(인기-구(old)숲 누락 방지). 자동합류(§7.5)·badge(§4.4)·추천이 같은 순서.
- **UI** `js/co-reading.js`:
  - `rgRankRecommendedRooms(pool, {limit})` — 인원순 desc(동률 최신) + **갓 생긴 숲 1개 끼움**(rich-get-richer 완화 — limit 밖이면 마지막 자리 양보). `window.rgRankRecommendedRooms` 노출.
  - `RoomsView` 추천 섹션 — 합집합 dedup(내 숲 제외) → `rgRankRecommendedRooms`. **권유 카드**(`RoomListRow`, 탭 → `RoomPreviewSheet` 미리보기 → 입장). 강제 join 아님. "탭하면 미리 볼 수 있어요" 안내.
  - `BookCoReadRow({bookId, onOpen})` — 책 상세 "🌳 이 책 같이 읽는 숲" 한 줄. `rooms.byBook` 로드 후 **공개 숲 ≥ 1 일 때만** 렌더(없으면 `null` — 빈 박스 금지). 탭 → 추천 상위(인원 많은) 숲 입장. `window.BookCoReadRow` 노출.
- `js/book-detail-modal.js` — `BookDetailModal` 책 액션(교보 링크) 아래 `<window.BookCoReadRow bookId={book.id} onOpen={...상세 닫고 RG_openRoom}/>` 진입점. (`BookInfoModal` 은 기존 "📖 N명 같이 읽는 중" badge 가 §4.4 커버 — 중복 추가 안 함.)
- `index.html` — `.rg-coread-rec*` CSS(2차 tonal 권유 카드, brand-soft, ghost 금지 — DESIGN.md 위계).
- **자동입장 금지**: 등록 시 자동합류(`rgAutoJoinPublicRoom`, §7.5)는 **건드리지 않음**(별개). 홈(둥지) 추천 노출 없음.
- **검증**(로컬 게스트, build OK + 헬퍼 단위): 인원순 정렬 ✅ · 동률 최신 tie-break ✅ · 신규 끼움(limit 밖 신규가 마지막 자리 차지) ✅ · 공개 숲 0 → `BookCoReadRow` null(미노출) ✅ · `byBook` limit 정렬 후 적용 ✅.
- **보류(후속, §7.6)**: 페이스(진도대) 매칭 · 임베딩/ML — 규모상 과설계.

---

## 부록: prior-art 매핑 (마을 → 방)

[village.md](./village.md)(폐기 #440)에서 **살린 것 / 떼어낸 것**:

| 마을(village) | 방(co-reading P1) |
|---|---|
| 책 1권 단위 그룹 | ✅ 그대로 |
| 멤버 그리드(둥지·불빛·진척%) | ✅ 그대로(순위 번호만 제거) |
| 한 문장 탭(방 지정 책) | ✅ 그대로 |
| 코드·링크 초대 + 책 검색 | ✅ 그대로 + 토큰 URL·비밀번호 추가 |
| 공개/비공개 + 정원 | ✅ 그대로 |
| 마일스톤(챕터·마감) | ◐ **코어 부활 #999**(host 일정·이번 구간·멤버 위치·집계·응원, §5.6) — 파트 랭킹·역할·리마인더만 잔여 |
| 게시판(주제·의견) | ❌ → P2 |
| 역할(공동관리자·강퇴·이양) | ❌ → P2 |
| 콕찌르기·순위·완독 레이스 | ❌ → P2 |
| 방 상태(활성/완료)·자동 아카이브 | ❌ → P2(마일스톤 의존) |
