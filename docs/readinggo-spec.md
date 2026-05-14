# ReadingGo Spec v4.4

> 기준일: 2026-05-14
> 상태: **백엔드 고려 MVP 스펙** — Phase 0(웹 데모) / Phase 1(웹 풀스택) / Phase 2(앱 + 푸시)
> 작성 원칙: 이 문서만으로 시스템 구현이 가능해야 한다. 외부 문서 참조 없이 자기충족적.
> 입력 문서(아카이브): `docs/readinggo-discussion.md`, `docs/협동-기반-독서-루틴-조사.md`, `Reading_GO_Service_Planning_v1.pdf`
> v4 → v4.1 변경: 윤지 데모(PR #86) 통합 인사이트 반영 — 마을 탭 부활, 주간 리그, 노드=세션 단위 확정, The Path 시각 명세, 디자인 토큰, 다중 책 활성화 전환
> v4.1 → v4.2 변경: jerome 데모(PR #89) 통합 인사이트 — 머니그라피 폰트 시스템, 컬러 팔레트 16토큰 확정, 둥지 5단계 한글 명칭, D-3 세리머니 timing, 마을 3열·모이 시각 룰, 소셜 리그 NPC 표기, 피드 리액션 3종, 마이크로카피 11개
> v4.2 → v4.3 변경: 데모 피드백 반영 — "듀오링고" 태그라인 제거, C-1 Top10 큐레이션 확정, D-2 문장 페이지 입력, 하루 여러 문장, 스트릭 달력, 소셜 친구 찾기, 마을 친구 상세 시트, 게시판 정의, 책 상세+교보문고 링크, 다중 책 연속성 명세, 날짜 시뮬레이터(Phase 0), 모이 방향성 미결 note
> v4.3 → v4.4 변경: 5/14 야간 팀 회의 반영 — 둥지 내서재 이동 버튼 추가, 마을 재설계 TBD, 소셜 리그 제거·신규 독서 시작러 Top3 섹션 신설·피드 전체 공개, "모이"(=한문장) 용어 확정, 짹 단일화, 책갈피 기능, 관심 책 리스트(내서재), 페이지 정보 상시 표시

---

## 0. 한 줄

> "하루 한 페이지, 한 문장에서 시작해요."

*(내부 컨셉 레퍼런스: "독서습관 앱계의 Duolingo" — 외부 노출 불가)*

---

## 1. 제품 약속

| 사용자가 얻는 것 | 제품이 책임지는 것 |
|---|---|
| 하루 1페이지 이상 읽는 습관 형성 | 듀오링고 수준의 지속성 엔진 (스트릭·방패·복귀) |
| 읽은 책의 핵심을 손에 남긴다 | "오늘의 문장" 누적 → 책 한 권의 엑기스 → Markdown export |
| 혼자가 아니라 같이 읽는다 | 단방향 팔로우 + 마을 둥지 시각화 + 박수 + NPC 동행 |

타겟: **읽고 싶은데 이어나가지 못하는 사람**. 안 읽는 사람을 끌어오는 제품 아님.

### 1.1 왜 책 / 왜 페이지

- 모두가 하고 싶어하는 행동 — "더 읽고 싶다"는 보편적 욕구
- 최소한의 정량화가 가능한 유일한 일상 카테고리 — 1페이지가 명확한 진척 단위

### 1.2 슬로건

> **"하루 한 페이지, 한 문장에서 시작해요."**

UI 상 진입 화면 헤더·로그인 화면·온보딩 카피에서 일관되게 사용.

---

## 2. 핵심 루프

```
[책 등록] (여러 권 가능, 1권을 "활성 책"으로 지정)
   ↓
[앱 밖에서 읽기 — 하루 1페이지 이상이면 충분]
   ↓
[일일 미션: 활성 책의 현재 페이지 입력 + 오늘의 문장 입력(둘 다 강제)]
   ↓
[스트릭 갱신 → XP 보상 → 참새 다음 노드로 hop]
   ↓
[마을에서 친구 둥지 불빛 ON, 소셜 피드 노출 → 박수(짝짝짝)]
   ↓
[다음날 21:00 알림. 미참여 시 23:00 긴급 알림]
```

**목표 페이지 설정 없음.** 부담을 없애는 게 핵심 — 1페이지만 읽어도 오늘은 성공.

### 2.1 핵심 체크인 트리거

**"모이" 입력 (강제, 200자 이내).** *(브랜드명: 모이. 오늘 읽은 책에서 마음에 든 한 문장을 옮겨 적은 짧은 인용구·감상. DB 내부 테이블명은 `sentences`로 유지.)*

페이지 입력만으로는 읽음을 검증할 수 없다. 한 문장을 직접 적는 행위가 (a) 읽음의 증명이며 (b) 사용자에게 누적되는 자산이 된다.

### 2.2 이탈 방어선

- **스트릭 lock-in** — 끊기지 않은 연속일이 머무를 이유
- **누적 문장 export** — 떠나도 가져갈 수 있다는 신뢰가 lock-in의 윤리적 부담 상쇄

---

## 3. Phase 구분

| Phase | 대상 | 산출물 | 백엔드 | 데이터 저장 |
|---|---|---|---|---|
| **Phase 0** | 2026-05-16 Peer Review 데모 | `docs/readinggo/index.html` 클릭 프로토타입 | **없음** | `localStorage` + 정적 TSV (`docs/readinggo/data/`) |
| **Phase 1** | MVP (웹) | 풀스택 웹앱 | **Supabase** (Auth + Postgres + pg_cron) | Postgres + Storage |
| **Phase 2** | 최종 발표 (학기말) | **Android APK** | Supabase + FCM | Postgres + 로컬 캐시 |

### Phase 0 제약

- 외부 API 호출 없음 (알라딘 키 미사용). 책 데이터는 `docs/readinggo/data/books.tsv` 정적 로드
- 인증 없음. 닉네임은 입력만 받아 localStorage 저장
- NPC 활동은 시드 데이터로 시뮬레이션 (배치 없이 미리 박힌 가짜 기록)
- 알림 없음 (브라우저 알림은 토스트 시뮬레이션)
- **다중 책 진도는 localStorage에 책별로 분리 저장** (책 전환 시 진도 초기화 금지)

### Phase 1 신규

- Supabase Auth (Google OAuth), Postgres, RLS, pg_cron 스트릭 배치
- Chrome Notification API (웹 푸시 권한)
- 클라이언트 사이드 fuzzy 검색 (Fuse.js)
- NPC 일일 활동 pg_cron 배치
- 닉네임 중복 검증 (서버), 금칙어 (LDNOOBW + 한국어 추가)
- 주간 리그 (XP 합산 개인 랭킹)

### Phase 2 신규

- Android APK (스택 미정 — React Native / Flutter / Expo)
- FCM 푸시 알림 (네이티브)
- NPC 다인·확장된 일과
- 챕터 자동 인식 (알라딘 프리미엄 또는 수동 입력 UI)
- 결제 / 방패 추가 구매 검토

---

## 4. 유저 시나리오 — 신규 가입 여정

각 단계는 화면 단위이며, **Phase 0 데모에서 모두 클릭으로 확인 가능해야 한다**.

### A. 진입 (비로그인)

- 한 페이지에 헤더 슬로건 ("하루 한 페이지, 한 문장에서 시작해요"), 중앙 CTA `시작하기`
- 슬라이드·튜토리얼 없음. Phase 2 앱 빌드 시 스플래시 로딩 동안만 철학 카피 노출
- CTA → **C** (책 등록)

### B. 사전 질문

**삭제.** 마찰 제거. 1일 1페이지 1문장이 유일한 목표.

### C. 첫 책 등록 (가입 전 가능)

**C-1. 검색 화면**

- 검색창: ISBN / 제목 / 저자 입력
- 검색 동작: 클라이언트 사이드 fuzzy 매칭 (`docs/readinggo/data/books.tsv` 위에서). Phase 1+는 동일 fuzzy를 서버 보조
  - 한글: 자모 분해 (`es-hangul`) 후 부분 일치
  - 영문: Fuse.js (Levenshtein 거리)
  - 오타·외국어 작가명 약한 일치 허용
- 결과 카드: 표지 / 제목 / 저자 / 총 페이지
- 검색어 비어있을 때 **하단 추천**:
  - 탭 1: **요즘 Top 10** (Phase 0 하드코딩 큐레이션, Phase 1+ `rank_recent` ASC)
    1. 도둑맞은 집중력 (요한 하리)
    2. 아주 작은 습관의 힘 (제임스 클리어)
    3. 채식주의자 (한강)
    4. 파친코 (이민진)
    5. 82년생 김지영 (조남주)
    6. 불편한 편의점 (김호연)
    7. 미드나잇 라이브러리 (맷 헤이그)
    8. 역행자 (자청)
    9. 세이노의 가르침 (세이노)
    10. 죽고 싶지만 떡볶이는 먹고 싶어 (백세희)
  - 탭 2: **스테디 Top 10** (Phase 0 하드코딩 큐레이션, Phase 1+ `rank_steady` ASC)
    1. 어린 왕자 (생텍쥐페리)
    2. 1984 (조지 오웰)
    3. 사피엔스 (유발 하라리)
    4. 데미안 (헤르만 헤세)
    5. 총균쇠 (재레드 다이아몬드)
    6. 코스모스 (칼 세이건)
    7. 호밀밭의 파수꾼 (J.D. 샐린저)
    8. 멋진 신세계 (올더스 헉슬리)
    9. 노인과 바다 (어니스트 헤밍웨이)
    10. 죽음의 수용소에서 (빅터 프랭클)
- 결과 없을 시 카드: "직접 등록" → C-2
- 화면 우상단 **"📚 내 서재"** 버튼 → 내서재 탭으로 즉시 이동 (이미 책이 있는 사용자가 검색 화면에서 바로 서재로 복귀 가능)

**C-2. 확인 / 직접 등록**

- 선택한 책의 표지·제목·저자·총페이지 표시
- "현재 어디까지 읽었어요?" 입력 (기본 0)
- 총 페이지: API 값 prefill, 수정 가능
- 직접 등록: 제목 / 저자 / 총 페이지 입력 (표지는 플레이스홀더)
- CTA `이 책으로 시작` → 이 책이 **활성 책**으로 지정됨 → **D**

### D. 첫 기록 (가입 전 try — sticky moment)

활성 책 기준으로 입력.

**D-1. 페이지 입력**

- 화면 중앙 큰 숫자: 현재까지 도달한 페이지 (기본 = 등록 시 입력값)
- 좌우 버튼: `[−1]` `[+1]`, 추가 `[+10]`
- 숫자 영역 탭 → 직접 입력 모달 (숫자 키패드)
- 검증: 0 ≤ 입력 ≤ 책 총 페이지, 입력 ≥ 직전 기록
- 다음 → D-2

**D-2. 오늘의 모이 입력 (필수)**

- 페이지 입력 필드 "어느 페이지에서?" (숫자, 기본값 = D-1 입력 페이지, 독립 수정 가능)
- 텍스트 영역, placeholder: "마음에 든 한 줄을 적어주세요 (최대 200자)"
- 최소 1자 최대 200자. 빈 입력 시 다음 버튼 비활성화
- 자동 임시 저장 (localStorage `pending_sentence`)
- 다음 → D-3

**D-3. 세리머니 (성공 화면)**

레이아웃 명세:

```
┌─────────────────────────────┐
│   [confetti 18조각]          │   ← 8색, stagger 0~0.25s, 2.4s fall
│                              │
│      🐦 (참새 bounce)        │   ← popIn 0.5s overshoot
│      훌륭해요!                │
│   로드맵 N번째 노드 획득!      │
│                              │
│  ┌─────┬─────┬─────┐        │   ← 보상 카드 3그리드 (rcPop stagger 0.15s)
│  │ 🔥  │ ⚡  │ ⬆️  │        │
│  │스트릭│+10XP│ hop │        │
│  └─────┴─────┴─────┘        │
│  [내일도 짹 →]               │   ← 3D 버튼
└─────────────────────────────┘
```

Confetti 명세:
- 18조각, 색상 8종: `#3FD17F #FFC233 #FF8A3D #5AB5F0 #F08A9A #B690F0 #2EB867 #FFD66B`
- `duration: 1.6~3s`, `delay: 0~0.25s random`, `size: 6~14 × 10~20px`
- 약 3.2초 후 DOM 정리, `z-index: 110`, `pointer-events: none`

- 가입 전이면 CTA `계속하려면 로그인` → **E**, 이미 로그인이면 홈 복귀

D-1, D-2 입력 모두 완료해야 D-3 진입 (= "오늘 읽기 완료").

### E. 가입

- 카피: "하루 한 페이지, 한 문장에서 시작해요. 계속 이어가려면 로그인하세요."
- 단일 버튼: `Google로 계속`
- OAuth 성공 후:
  - localStorage 임시 데이터 → Supabase 동기화
  - 닉네임 미입력 시 E-1
  - 친구 추가 화면 표시 안 함. 바로 **H** (홈)

**E-1. 닉네임 설정** (이미 입력했으면 스킵)

- 입력 필드: `@nickname`
- 규칙 표시 (입력 필드 하단 항상 노출):
  - 영소문자 / 숫자 / 한글 / 언더스코어
  - 2자 이상 16자 이하
  - 다른 사용자가 사용 중인 닉네임 불가
  - 부적절한 단어 불가
- 입력 동안 디바운스 300ms 후 `/rpc/check_handle` 호출
- 실패 시 위반 항목 명시
- 변경: 가입 후 언제든 무제한

### F. 알림 권한 요청

**진입 트리거**: 첫 기록(D-3) 완료 후 다음 진입.

- Phase 0: 토스트 시뮬레이션
- Phase 1: `Notification.requestPermission()`. 거절 시 설정에서 재시도
- Phase 2: 네이티브 푸시 표준 플로우

알림 정책:

| 항목 | 정책 |
|---|---|
| 디폴트 시간 | 21:00 (사용자 로컬 타임존) |
| 사용자 변경 | 가능. 22:00 이후로는 설정 불가 |
| 알림 문구 (일반) | "🌱 오늘의 한 페이지, 한 문장 어때요?" |
| 긴급 알림 | 미참여 + 23:00 도달 시. "🛡 오늘 한 문장만! {N}일 연속 기록이 사라지려 해요 🥺" |
| 콕찌르기 알림 (마을) | 친구가 🪱 콕찌르기를 보냈을 때 즉시. "🪱 @{nickname} 님이 오늘도 같이 읽자고 해요" |

### G. 친구 / NPC

가입 직후 자동:

- NPC 2명 자동 팔로우: `@book_bear`(책읽는곰돌이) / `@activist_raccoon`(활자라쿤)
- NPC는 UI상 일반 유저와 동일 (`users.is_npc`는 내부). 리그·마을에서 ` · NPC` suffix 표시

**NPC 풀 (Phase 0 검색 가능 4명)**:

| 핸들 | 이름 | 스테이지 | 성격 | 읽는 책 예시 |
|---|---|---|---|---|
| `@book_bear` | 책읽는곰돌이 | 3 | 따뜻한 감상 위주 | 사피엔스, 데미안, 어린왕자 |
| `@activist_raccoon` | 활자라쿤 | 4 | 분석적, 인용 중심 | 1984, 총균쇠, 코스모스 |
| `@reading_owl` | 독서올빼미 | 2 | 야간 독서, 문학 | 호밀밭의 파수꾼 |
| `@page_fox` | 한페이지여우 | 1 | 하루 한 페이지 실천 | 어린 왕자 |

상호작용 규칙:

- **소셜 피드 카드 반응 = 👏🥹🔖 3종 칩** (각 토글, 숫자 ±1)
- **마을 둥지 카드 반응 = 콕찌르기(🪱 모이 보내기) 1버튼만** (불 꺼진 친구에게만)
- 박수와 모이는 다른 행위:
  - **박수/공감/저장** = 오늘 작성된 문장 카드에 대한 반응 (소셜 피드)
  - **모이** = 오늘 아직 읽지 않은 친구에게 푸시 알림 트리거 (마을). **현재: 넛지만. 수신 효과 미결**
- 모이는 친구당 하루 1회 제한 (남발 방지)

NPC 운영:

- 진짜 책에 NPC 진도 부여, 문장은 시드 풀에서 추첨
- pg_cron 매일 자정 진도 증가 + 시드 문장 1개 게시
- NPC별 시드 책 큐 5권 → 끝나면 자동 다음 책
- LLM 호출 없음 (비용·지연 0)

### H. 홈 도착 (Day 1 상태)

기본 탭 = **둥지**.

```
┌─────────────────────────────────────┐
│ 🐦 reading[Go]    🔥 1  ⚡ +10  Lv1  │ ← 상단 바
├─────────────────────────────────────┤
│ ┌──────────────────────────────┐    │
│ │ 🪵 기초공사       20%        │    │ ← 둥지 진화 배너
│ │ ▓▓░░░░░░  사피엔스 · 5/300p  │    │   (활성 책 표지 탭 → 활성 책 전환 시트)
│ └──────────────────────────────┘    │
├─────────────────────────────────────┤
│ ─── 나의 독서 로드맵 ───              │
│         ┌──┐                         │ ← The Path
│         │✓ │  5/13 p.5               │   (세션 단위 노드)
│         └──┘                         │
│                ┌──┐                  │
│                │🐦│  ← 현재(미션)    │
│                └──┘                  │
│              [오늘 기록하기]         │
│         ┌──┐                         │
│         │ ?│  ← ghost next           │
│         └──┘                         │
├─────────────────────────────────────┤
│ [ 둥지 ·  마을  ·  소셜  ·  내서재 ]   │ ← 하단 탭
└─────────────────────────────────────┘
```

상단 바: 로고 + 🔥 스트릭 / ⚡ XP / Lv N
하단 탭(4개): **둥지 / 마을 / 소셜 / 내서재**

각 탭:

- **둥지**: 활성 책의 The Path
- **마을**: 친구 + NPC 둥지 그리드, 불빛 ON/OFF, 모이 보내기
- **소셜**: 주간 리그 + 피드(박수)
- **내서재**: 책 목록, 책 상세, Export, 설정(닉네임·알림·로그아웃)

---

## 5. 화면 스펙 상세

### 5.1 둥지 탭 — The Path

| 요소 | 동작 |
|---|---|
| 상단 바 | 🐦 로고 / 🔥 스트릭 / ⚡ XP / Lv |
| 🔥 스트릭 탭 | 탭 → 이달 달력 모달. 기록 있는 날짜에 🔥, 오늘 날짜 강조 |
| 둥지 진화 배너 | 활성 책 진척률 % + 5단계 (§5.2) + 미니 진척 바 + 책 정보 |
| The Path | 세션 1건 = 노드 1개. 지그재그 4지점 배치, 점선 커넥터 |
| 캐릭터 | 참새. 현재(다음) 노드 자리에 위치, bounce |
| CTA (미완료) | "오늘 기록하기" → 미션 모달 (D-1 페이지 → D-2 문장) |
| CTA (완료 후) | "✍️ 모이 추가" — 추가 모이 입력 가능 (페이지 + 문장만, XP 없음) |
| 내서재 이동 버튼 | 둥지 탭 상단 바 우측 "📚" 아이콘 버튼 → 내서재 탭으로 이동. 더 읽고 싶은 책을 쉽게 추가·관리하기 위한 빠른 진입 경로 |

**하루 여러 문장**:
- 하루 첫 기록: 세션 생성 + 문장 저장 + XP +10 + 스트릭 +1
- 이후 추가: 세션 재생성 없음. `sentences`에만 추가. XP/스트릭 변동 없음
- Path 노드는 세션 기준이므로 추가 문장은 기존 노드에 누적

**날짜 시뮬레이터 (Phase 0 데모 전용)**:
- 우하단 플로팅 버튼 `🗓 YYYY-MM-DD +1일`
- 탭 시 `simDate` +1일 전진. pokes 초기화 (하루 제한 리셋)
- 운영 빌드에서는 제거

**The Path 시각 명세**:

```
x 좌표 패턴(반복): 22%  →  50%  →  72%  →  50%
y 간격: 96px / 노드
노드 크기: 56×56 원
커넥터: 점선 (stroke #D7F0BF, width 5, dasharray "10 6")
완료 노드(node-done):    배경 #58CC02, 보더 #46A302, 그림자 0 4px 0 #46A302, 중앙 ✓
현재 노드(node-current): 배경 #fff, 보더 #58CC02, 외곽 ring rgba(88,204,2,0.2), 펄스 애니메이션
잠금/ghost(node-ghost):  배경 #E5E5E5, 보더 #d0d0d0, opacity 0.2, 중앙 ?
참새: 현재 노드 위 50px 자리에 bounce (1.4s ease-in-out infinite)
호버 툴팁(완료 노드): 그 세션 날짜(M/D) · 페이지(p.N) · 문장(line-clamp 2줄)
```

**노드의 단위**: 세션(reading_session) 1건 = 노드 1개. 챕터는 별도 개념(둥지 진화 배너에서 다룸).

**자동 스크롤**: 현재(또는 마지막) 노드가 보이도록 진입 시 `scrollIntoView({behavior:"smooth",block:"center"})`.

### 5.2 둥지 진화 (Dynamic Stage) — 5단계

활성 책 진척률(`current_page / total_pages * 100`)에 따라:

| 진척률 | 이모지 | 단계명 | 색상 | 배경색 |
|---|---|---|---|---|
| 0~20% | 🪵 | 나뭇가지 자리 | #AFAFAF | #f3f4f6 |
| 21~50% | 🪹 | 빈 둥지 | #F59E0B | #FEF3C7 |
| 51~80% | 🏠 | 따뜻한 둥지 | #58CC02 | #F0FDF4 |
| 81~99% | 🏡 | 다정한 집 | #1CB0F6 | #EFF6FF |
| 100% | 🏰 | 참새의 성 | #CE82FF | #FAF5FF |

진화 시 마이크로카피:

| 전환 | 카피 |
|---|---|
| LV1→2 | "참새가 자리를 잡았어요!" |
| LV2→3 | "참새가 살림을 차렸어요!" |
| LV3→4 | "다정한 이웃이 되었어요!" |
| LV4→5 | "전설의 참새 성주!" |

**완독 시(100%)**: §5.4 D-3에 별도 "완독 세리머니" 모달 (🏰 + 완독 배지 + Confetti).

### 5.3 활성 책 전환

여러 책을 동시에 읽을 수 있으나, **항상 한 권이 "활성 책"**.

- 활성 책 = 둥지 탭의 The Path가 그리는 책
- 둥지 진화 배너의 책 표지/제목 탭 → **활성 책 전환 시트** 슬라이드업
- 시트 내용: 내 책장의 책 목록(읽는 중만), 각 카드에 표지·제목·진척
- 카드 탭 → 활성 책 변경, 시트 닫힘, The Path 해당 책의 세션들로 재구성
- **각 책의 세션·진척·문장은 독립적으로 보존됨** (책 전환 시 데이터 초기화 금지)
- 데이터: `users.active_user_book_id` (§7.3)

### 5.4 일일 미션 — §4 D 참조

추가:
- 하루 1세션. 같은 날 재진입 시 "오늘은 이미 완료했어요" + 추가 문장 입력 옵션(서브 액션, 스트릭 영향 없음)
- 자정 직전(23:55+) 입력은 그 날짜로 카운트. UTC 15:00 배치가 다음 KST 자정에 정산

### 5.5 마을 탭 — 리딩 빌리지

> **⚠️ TBD** — 5/14 야간 팀 회의에서 마을 탭 전체 설계 재검토 결정. 게시판 존치·다중 빌리지·콕찌르기 알림 효과 등 미결. 아래 명세는 v4.3 기준 참고용. v4.5에서 확정 예정.

친구+NPC 둥지를 그리드로 시각화.

```
┌─────────────────────────────────────────────┐
│ 🏘️ 리딩 빌리지                               │
│ 💡 불빛 ON = 오늘 읽음 · 🪱 모이 = 독려 알림  │
├─────────────────────────────────────────────┤
│ ┌────────┐  ┌────────┐  ┌────────┐          │
│ │🪱   ●  │  │🪱   ○  │  │🪱   ●  │  ← 3열 그리드
│ │  🏰    │  │  🏠    │  │  🪹    │
│ │@book_  │  │@gyehyu │  │@seung- │
│ │bear    │  │        │  │won     │
│ │ 🔥 64  │  │ 🔥 21  │  │ 🔥 0   │  ← Pixel 폰트
│ └────────┘  └────────┘  └────────┘
└─────────────────────────────────────────────┘
```

| 요소 | 규칙 |
|---|---|
| 둥지 아이콘 | 친구의 활성 책 진척 단계의 이모지 (§5.2) |
| 불빛 (●/○) | 오늘 세션 완료 → 골드 글로우 (`box-shadow: 0 0 8px gold`). 미완료 → `--ink-4` 회색 점 |
| 닉네임 | `@handle` |
| 스트릭 미니 | `🔥 N` (Pixel 폰트). streak 0이면 "쉼 중" 회색 텍스트 |
| 인용 1줄 | 오늘 작성한 문장 (없으면 미표시) |
| 액션 | 불빛 ON: "읽는 중" 배지 / 불빛 OFF: 카드 좌상단 🪱 클릭 → 토스트 |

**모이 보내기**:
- 카드 좌상단 🪱 클릭 → 토스트 `"@{handle}에게 🪱 모이를 보냈어요!"`
- 즉시 `.sent` 클래스 부여 → `opacity: 0.25`, `cursor: default`
- 새로고침 전까지 재전송 불가 (Phase 1: `pokes` 테이블 + KST 자정 리셋)
- NPC에게는 모이 못 보냄 (항상 자정 이후 곧 불빛 ON되니 자연스럽게 불가)
- **현재 정의**: 넛지(독려 알림)만. 수령자 효과 없음
- **방향성 미결**: 모이 N개 수신 → 방패 +1 등 게임 메카닉 연계 가능. Phase 1 설계 시 결정

**받은 모이 섹션** (하단 별도 카드):
- "@{handle}가 모이를 보냈어요" + "오늘도 짹 한번! 같이 읽자🐦" + 시간 표기

**친구 상세 시트**:
- 마을 카드 탭 → 바텀시트
- 표시: 닉네임, 스테이지, NPC 여부, bio, 읽고 있는 책 리스트 (칩), 오늘의 문장
- 책 칩 탭 → §5.8 책 상세 페이지

**마을 게시판**:
- 마을 주민(친구+NPC)이 올리는 자유 감상 게시글
- 소셜 피드(문장 공유)와 차이: 게시판은 자유 텍스트, 피드는 sentences 테이블 기반
- Phase 0: NPC 시드 게시글 3개 하드코딩. Phase 1: 텍스트 입력 → 저장

### 5.6 소셜 탭

```
┌─────────────────────────────────────┐
│ 👥 소셜                              │
├─────────────────────────────────────┤
│ ┌──────────────────────────────┐    │
│ │ 📚 이번 주 새로 시작한 책     │    │   ← 신규 독서 시작러 Top3
│ │  1위  사피엔스      23명 시작 │    │
│ │  2위  데미안        18명 시작 │    │
│ │  3위  어린왕자      15명 시작 │    │
│ └──────────────────────────────┘    │
├─────────────────────────────────────┤
│ ┌──────────────────────────────┐    │
│ │ 🐦 @계휴 · 어린왕자 · p.72   │  🔖│   ← 모이 피드 (전체 공개)
│ │ "별은 아름답다, 모래들이..."  │    │
│ │ [짹 3]                       │    │
│ └──────────────────────────────┘    │
│ (스크롤 다운 → 모든 사람들의 모이)    │
└─────────────────────────────────────┘
```

**이번 주 신규 독서 시작러 Top3**:

| 요소 | 규칙 |
|---|---|
| 집계 | 이번 주(월~일) 신규 `user_books` 생성 기준, 가장 많이 등록된 책 상위 3권 |
| 표시 | 순위 + 책 제목 + "N명 시작" |
| Phase 0 | 하드코딩 시드 데이터 |
| Phase 1+ | 주간 집계 쿼리 (`user_books.started_at >= date_trunc('week', now())` GROUP BY book_id) |

**모이 피드**:

| 섹션 | 규칙 |
|---|---|
| 범위 | **전체 사용자** (`sentences.is_private=false`) — 친구 필터 없음. 모든 사람들의 모이가 시간순으로 노출 |
| 카드 구성 | 아바타 + 닉 + 책 제목 탭(→ 책 상세) + **페이지 정보** (`p.N`) + 모이 텍스트 + 리액션 |
| 모이 텍스트 스타일 | Rounded 폰트 + `--brand-soft` 좌측 보더 |
| 리액션 | **짹 1종** (좋아요, 숫자 ±1 토글). v4.3까지의 👏🥹🔖 3종 칩 제거 |
| 책갈피 | 카드 우측 상단 🔖 버튼 → 관심 문장 저장 (`sentence_bookmarks`, §7.3). 저장 시 아이콘 활성화 |
| 책 자세히 보기 | 카드 내 책 제목 탭 → §5.7 책 상세 페이지 진입 |
| 관심 책 추가 | 책 상세 페이지 내 "관심 책에 추가" → 내서재 관심 책 목록(§5.7)에 저장 |
| 페이지 정보 | 모이 카드에 항상 표시 (`p.N` 형식, Pixel 폰트) |
| 본인 카드 | 짹·책갈피 비활성 |
| 비공개 | `sentences.is_private=true`인 모이는 피드·마을 모두 노출 안 함 |
| 빈 상태 | "아직 모이가 없어요. 오늘의 모이를 남겨보세요 🐦" |

**친구 찾기**:
- 헤더 우측 "🔍 친구 찾기" 버튼 → 인라인 패널 토글
- @닉네임 검색 입력 → `NPC_SEARCH_USERS` 풀에서 실시간 필터
- Phase 0 검색 가능 NPC: `@book_bear`, `@activist_raccoon`, `@reading_owl`, `@page_fox`
- "팔로우" 버튼 → `state.friends`에 추가, 마을 그리드에 즉시 반영
- 이미 팔로우한 경우 "팔로잉 ✓" 비활성 표시
- Phase 1+: `users` 테이블 검색, 맞팔 요청 플로우

### 5.7 내서재 탭

```
┌─────────────────────────────────────┐
│ 📚 내 서재         [⚙️ 설정]          │
├─────────────────────────────────────┤
│ ┌──────────────────────────────┐    │
│ │ 📖 현재 읽는 중              │    │
│ │ 사피엔스 · 5/300p            │    │
│ └──────────────────────────────┘    │
├─────────────────────────────────────┤
│ [검색창]                             │   ← 책장 내 검색
│                                      │
│ ┌──────────────────────────────┐    │
│ │ 📖 어린왕자 · 72/160p · 진행중│    │
│ └──────────────────────────────┘    │
│ ┌──────────────────────────────┐    │
│ │ 📗 데미안 · 228/228p · 완독  │    │
│ └──────────────────────────────┘    │
│ [+ 책 추가하기]                      │
└─────────────────────────────────────┘
```

- 책 카드 탭 → **책 상세** 화면
- "현재 읽는 중" 카드 탭 → §5.3 활성 책 전환 시트
- ⚙️ 설정 → 닉네임 변경, 알림 시간, 로그아웃

**책 상세 / Export**:
- 표지·제목·저자·진척 바
- 오늘의 문장 타임라인 (날짜 desc, 페이지 / 문장)
- **교보문고 구매 링크**: `https://search.kyobobook.co.kr/search?keyword={isbn}` (ISBN 없으면 제목 검색)
  - 버튼 텍스트: "교보문고에서 보기 →" (외부 탭 오픈)
  - Phase 1+: 어필리에이트 파라미터 추가 (`?source=readinggo&...`) — 별도 계약 필요
- Export 버튼 → Markdown 다운로드
  - 포맷:
    ```
    # {책 제목} — {저자}

    ## YYYY-MM-DD (p.{page})
    > {문장}
    ```
- 책 삭제: 길게 누름 → 확인 모달. 누적 기록은 보존 (soft delete)

**관심 책 리스트**:

```
📚 내 서재
├─ 읽는 중 (N권)
├─ 완독 (N권)
└─ 관심 책 (N권)   ← 신규
    ┌──────────────────────────────┐
    │ 📖 사피엔스  유발 하라리       │
    │ [교보문고에서 보기 →]  [삭제] │
    └──────────────────────────────┘
```

- 소셜 피드 모이 카드 → 책 상세 → "관심 책에 추가" 버튼 탭 시 저장 (`wish_books`, §7.3)
- 내서재 탭에서 "관심 책" 섹션으로 접근 가능
- 카드: 표지 + 제목 + 저자 + 교보문고 링크 + "지금 읽기 시작" 버튼(→ 책 등록 C-2로 연결)
- Phase 0: `state.wishBooks` 배열로 localStorage 저장

**책갈피(관심 문장)**:
- 소셜 피드에서 🔖 탭 시 `sentence_bookmarks` 에 저장 (§7.3)
- 내서재 탭 설정 패널 또는 별도 "책갈피" 섹션에서 조회 가능 (Phase 1+ 정식 UI 설계)
- Phase 0: `state.bookmarks` 배열로 localStorage 저장

**친구 책 → 책 상세 진입**:
- 마을 친구 상세 시트의 "읽고 있는 책" 칩 탭 → 동일 책 상세 페이지
- 해당 책의 표지·저자·설명 + 교보문고 링크 + "관심 책에 추가" 버튼 표시 (내 기록 타임라인 없음)

### 5.8 닉네임 규칙 — §4 E-1 참조

서버 검증 (Phase 1+):

```
정규식: ^[a-z0-9가-힣_]{2,16}$
금칙어: LDNOOBW (https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words)
        + docs/readinggo/data/banned_ko.txt (한국어 큐레이션)
중복: users.handle UNIQUE 인덱스
변경: 무제한, 횟수 제한 없음
```

---

## 6. 시스템 로직

### 6.1 스트릭

| 항목 | 규칙 |
|---|---|
| 갱신 조건 | "오늘의 문장" 1개 이상 + 페이지 입력 1회 (= ReadingSession 1행 생성) |
| 갱신 시점 | 입력 즉시 `streak.current += 1`, `last_check_in_date = today` |
| 미참여 정산 | pg_cron (UTC 15:00 = KST 00:00) |
| 활성 책 무관 | 어느 책에 기록하든 1세션 = 스트릭 +1 (책별 스트릭 아님, 사용자 단위) |

### 6.2 방패 (Shield)

| 항목 | 규칙 |
|---|---|
| 초기 보유 | 0개 |
| 최초 지급 | 첫 7일 연속 스트릭 달성 시 +1 |
| 보충 규칙 | 방패 1개 소모 후 7일 뒤 +1 |
| 최대 보유 | 3개 |
| 자동 적용 | 미참여 → 방패 1개 소모, 스트릭 유지. 0개면 스트릭 0 리셋 |
| 결제 구매 | Phase 2 이후 검토 |

배치(pg_cron, UTC 15:00):

```sql
select cron.schedule(
  'streak-shield-daily',
  '0 15 * * *',
  $$
    update streak
    set
      shields_remaining = case when shields_remaining > 0 then shields_remaining - 1 else 0 end,
      current = case when shields_remaining > 0 then current else 0 end
    where last_check_in_date < current_date - interval '1 day';

    update streak s
    set shields_remaining = least(s.shields_remaining + 1, 3)
    from shield_log l
    where l.user_id = s.user_id
      and l.consumed_at <= now() - interval '7 days'
      and l.refunded = false;

    update shield_log set refunded = true
    where consumed_at <= now() - interval '7 days' and refunded = false;

    update streak
    set shields_remaining = least(shields_remaining + 1, 3),
        first_shield_granted = true
    where current >= 7 and first_shield_granted = false;
  $$
);
```

### 6.3 XP / 배지

| 행동 | XP |
|---|---|
| 일일 미션 완료 | +10 |
| 챕터 완료 (해당 시) | +50 |
| 책 완독 | +200 |
| 박수 받음 (일일 +20 상한) | +5 |
| 7일 스트릭 | +100 + 배지 |
| 30일 스트릭 | +500 + 배지 |

레벨 계산: `level = floor(sqrt(xp / 100)) + 1` (Phase 1 시점 재조정 가능).

### 6.4 NPC 운영 — pg_cron 배치

`npc_sentence_seeds(npc_id, text)` NPC별 60~100개 시드.

배치(매일 KST 00:00, streak 배치와 묶음):

```sql
-- NPC 진도 증가
update user_books ub
set current_page = least(current_page + u.daily_pace, b.total_pages)
from users u, books b
where ub.user_id = u.id and ub.book_id = b.id and u.is_npc = true;

-- 시드 문장 추첨 후 sentences insert
insert into sentences (user_id, user_book_id, text, page, created_at)
select u.id, ub.id,
       (select text from npc_sentence_seeds s where s.npc_id = u.id order by random() limit 1),
       ub.current_page, now()
from users u join user_books ub on ub.user_id = u.id
where u.is_npc = true;

-- NPC 랜덤 박수 (오늘 활동한 실유저 일부)
insert into claps (from_user_id, to_session_id)
select npc.id, s.id
from users npc, reading_sessions s
where npc.is_npc = true and s.session_date = current_date and s.user_id <> npc.id
order by random()
limit 5;
```

NPC 페르소나:

| 핸들 | 표시명 | daily_pace | 시드 책 큐 | 톤 |
|---|---|---|---|---|
| `@book_bear` | 책읽는곰돌이 | 5p | 사피엔스, 데미안, 어린왕자, … | 따뜻함, 짧은 감상 |
| `@activist_raccoon` | 활자라쿤 | 12p | 1984, 총균쇠, 코스모스, … | 분석적, 인용 위주 |

### 6.5 주간 리그

> **소셜 탭 UI에서 제거** (v4.4, 5/14 회의). 로직 및 DB는 Phase 1에서 유지하되 화면 노출 안 함. 향후 재노출 여부 별도 결정.

| 항목 | 규칙 |
|---|---|
| 집계 단위 | 본인 + 팔로잉 + NPC |
| 점수 | 그 주(월~일) XP 누적 |
| 리셋 | 매주 월 00:00 KST (pg_cron) — 표시는 시작 시점부터 0 |
| 표시 | 소셜 탭 상단 카드. 상위 N명(N=10) + 본인은 항상 강조 표시 |
| 배지 | 🥇🥈🥉 1~3위, 4위 이하 숫자. 본인 row 배경 #F0FDF4 |

집계 쿼리 예시:

```sql
select u.id, u.handle, u.display_name,
       coalesce(sum(rs.xp_earned), 0) as week_xp
from users u
left join reading_sessions rs
  on rs.user_id = u.id
  and rs.session_date >= date_trunc('week', current_date)
where u.id in (
    select following_id from follows where follower_id = $me
  ) or u.id = $me or u.is_npc = true
group by u.id
order by week_xp desc
limit 10;
```

---

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
  text          text                 -- 200자 이내 (클라이언트 검증)
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
```

### 7.5 RLS 정책 (요약)

- `users`: 본인 row update. 다른 유저 select 가능 (피드용 공개 정보)
- `sentences`: `is_private=true`면 본인만 select. 그 외 모두 select. insert는 본인만
- `reading_sessions`, `streak`, `user_books`: insert/update 본인. select 모두
- `follows`: follower_id가 본인인 행만 insert/delete
- `claps`: from_user_id가 본인인 행만 insert
- `pokes`: from_user_id가 본인인 행만 insert. to_user_id가 본인이면 select (수신 확인용)

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

## 8. 미결 → 확정 사항

| 이슈 | 결정 |
|---|---|
| "오늘의 문장" 강제/선택 | 강제 |
| 페이지 입력 UI | `[−1]` `[+1]` `[+10]` + 숫자 직접 입력 |
| 오늘의 문장 글자 수 | 최대 200자, TEXT |
| 사전 질문 | 전부 제거 |
| 초기 방패 | 0개. 첫 7일 +1. 사용 후 7일 보충. 최대 3 |
| 챕터 미정의 책 | 페이지 20%씩 5단계 (둥지 진화) |
| 피드 카드 반응 | 👏🥹🔖 3종 칩 (각 토글, 숫자 ±1) |
| 마을 둥지 카드 반응 | 콕찌르기(🪱 모이) 1버튼, 친구당 일 1회 |
| NPC 운영 | pg_cron + 시드 풀, LLM 없음 |
| NPC 핸들 | `@book_bear`, `@activist_raccoon` |
| 닉네임 변경 | 무제한 |
| 닉네임 규칙 | `^[a-z0-9가-힣_]{2,16}$` + 중복 X + 금칙어 |
| 알림 디폴트 | 21:00, 22:00 이후 설정 차단, 23:00 긴급 |
| 알라딘 API | Phase 0/1 미사용. 정적 파일 |
| 책 검색 | 클라이언트 fuzzy (Fuse.js + 자모 분해) |
| 노드의 단위 | 세션 1건 = 노드 1개 |
| 하단 탭 구성 | 둥지 / 마을 / 소셜 / 내서재 (4탭) |
| 주간 리그 | Phase 1부터. 본인+팔로잉+NPC, 주간 XP, 월요일 00:00 KST 리셋 |
| 다중 책 진도 | `user_books` 단위 독립 저장. `users.active_user_book_id`로 활성 책 지정 |
| 활성 책 전환 UI | 둥지 탭 진화 배너 탭 → 슬라이드업 시트 |
| 다중 책 스트릭 연속성 | 스트릭 = 책 무관, 유저 단위. 어떤 책이든 오늘 세션 1개 이상이면 +1. Path는 활성 책 1권만 표시 |
| 하루 여러 문장 | 첫 기록 = 세션+XP+스트릭. 이후 "문장 추가" = sentences만 추가, 세션/XP/스트릭 변동 없음 |
| 문장 페이지 입력 | D-2 및 홈 문장 추가 모달에 "어느 페이지에서?" 숫자 입력 (기본값 = 현재 세션 페이지) |
| C-1 Top10 | Phase 0 하드코딩 큐레이션 (요즘 10종 / 스테디 10종 고정). Phase 1+ DB rank 칼럼으로 교체 |
| 책 상세 구매 링크 | 교보문고 ISBN 검색 URL. Phase 1+ 어필리에이트 파라미터 추가 |
| 콕찌르기(🪱) 수신 효과 | **미결** — 현재는 넛지 전송만. Phase 1 설계 시 방패 연계 여부 결정 (구 "모이 수신 효과") |
| "모이" 용어 | 오늘 읽은 책에서 옮겨 적은 짧은 인용구·감상의 앱 내 브랜드명. DB 테이블명은 `sentences` 유지 |
| 소셜 리그 | 소셜 탭에서 제거 (5/14 회의). `league` 로직은 Phase 1 유지하되 소셜 탭 UI에서 노출 안 함 |
| 소셜 피드 범위 | 친구 필터 없음. 전체 사용자의 공개 모이 피드 노출 |
| 피드 리액션 | 짹(좋아요) 1종 + 책갈피(🔖) 분리. v4.3까지의 👏🥹🔖 3종 칩 폐기 |
| 관심 책 리스트 | 내서재 내 별도 섹션. 소셜 피드 책 상세에서 "관심 책에 추가" 로 저장. DB: `wish_books` |
| 책갈피 | 소셜 피드 모이 카드 우측 상단 🔖 → 관심 문장 저장. DB: `sentence_bookmarks` |
| 마을 탭 설계 | **TBD** — v4.5에서 확정 |
| 외부 노출 슬로건 | "하루 한 페이지, 한 문장에서 시작해요." (내부 Duolingo 레퍼런스 외부 비노출) |
| DB | 관계형 + `users.settings` JSONB |
| Phase 분리 | 0 데모 / 1 Supabase 웹 / 2 Android+FCM |

---

## 9. Phase 0 데모 시나리오 (#58, 2026-05-16)

4분 클릭 시연. 데이터는 localStorage + 정적 TSV.

| 시간 | 화면 | 동작 |
|---|---|---|
| 0:00 | A 진입 | 슬로건 "하루 한 페이지, 한 문장에서 시작해요.", `시작하기` |
| 0:15 | C-1 검색 | 요즘 Top10 탭 표시 → "사피" 입력 → 사피엔스 fuzzy 매칭 |
| 0:30 | C-2 확인 | 표지 확인, 현재 페이지 0 |
| 0:45 | D-1 페이지 | `[+10]` → 10p |
| 1:00 | D-2 문장 | 페이지 입력(p.10) + "역사는 픽션이 만든 질서다" |
| 1:15 | D-3 세리머니 | Confetti 8색, 보상 카드, "내일도 짹 →" CTA |
| 1:30 | H 둥지 | 둥지 진화 배너 + The Path 노드 1개 + 🔥 탭 → 달력 |
| 1:50 | 둥지 "문장 추가" | "✍️ 문장 추가" → 두 번째 문장 입력 |
| 2:05 | 날짜 이동 | 우하단 🗓 버튼으로 +1일 → Path 새 노드 가능 상태 |
| 2:20 | 마을 탭 | 3열 그리드. 카드 탭 → 친구 상세 시트 (책, 문장) |
| 2:35 | 소셜 탭 | 민트 리그 + 피드 👏🥹🔖 칩. "친구 찾기" → @reading_owl 팔로우 |
| 2:50 | 내서재 | 책 추가, 두 번째 책 등록 후 활성 책 전환 시연 |
| 3:10 | 책 상세 | 문장 타임라인 + "교보문고에서 보기 →" 링크 |
| 3:30 | 마무리 | 슬로건 |

---

## 10. 오픈 태스크

| # | 항목 | Phase |
|---|---|---|
| 1 | `docs/readinggo/index.html` Phase 0 데모 (이 스펙대로) | 0 |
| 2 | 책 100권 데이터 cover_url 보강 + TSV 정리 | 0 |
| 3 | NPC 시드 문장 2명 × 60개 작성 | 0 |
| 4 | 디자인 토큰 적용 (§11) | 0 |
| 5 | Supabase 프로젝트 셋업, 7.3 스키마 마이그레이션 | 1 |
| 6 | Google OAuth 연동 | 1 |
| 7 | pg_cron 스트릭/방패/NPC/리그 배치 | 1 |
| 8 | Chrome Notification 알림 | 1 |
| 9 | 닉네임 RPC + 금칙어 사전 | 1 |
| 10 | 주간 리그 쿼리·캐시 | 1 |
| 11 | Android APK 빌드 스택 결정 | 2 |
| 12 | FCM 푸시 | 2 |

---

## 11. 디자인 토큰

### 11.1 폰트 시스템

머니그라피(토스 산하 Moneygraphy) 두 폰트를 **역할 분리**로 사용.

```css
@font-face {
  font-family: 'Moneygraphy Rounded';
  src: url('fonts/Moneygraphy-Rounded.otf') format('opentype');
  font-display: swap;
}
@font-face {
  font-family: 'Moneygraphy Pixel';
  src: url('fonts/Moneygraphy-Pixel.otf') format('opentype');
  font-display: swap;
}
body { font-family: 'Moneygraphy Rounded', 'Noto Sans KR', sans-serif; letter-spacing: -0.2px; }
```

| 용도 | 폰트 | 비고 |
|---|---|---|
| 본문 / 헤더 / 버튼 / 한글 카피 | **Moneygraphy Rounded** | `letter-spacing: -0.2px` |
| 숫자 / 게임 라벨 / 뱃지 / 메타 | **Moneygraphy Pixel** | `letter-spacing: 0.5~1.5px`. `font-weight` 변경 불가 (단일 굵기) |
| Fallback 한글 | Noto Sans KR | 폰트 로딩 실패 대비 |

Pixel 폰트 적용 대상 (선택자 단위):
```css
/* 스트릭/XP 숫자, The Path 노드 심볼, 책 진도 숫자, 페이지 입력 큰 숫자,
   보상 카드 수치, 리그 순위·XP, 마을 스트릭 미니, 서재 진도 메타, 피드 시간 */
.stat-num, .path .node, .book-progress-num, .page-num, .reward-card .val,
.league-rank, .league-xp, .friend-streaknum, .shelf-prog, .sentence-meta {
  font-family: 'Moneygraphy Pixel', 'Moneygraphy Rounded', monospace;
}
```

파일 위치: `docs/readinggo/fonts/Moneygraphy-Rounded.otf`, `Moneygraphy-Pixel.otf` (한글 11,449 글리프 풀세트).

### 11.2 컬러 팔레트

**3색 의미체계**: 참새 민트(브랜드) / 불꽃 오렌지(스트릭) / 골드(XP) 엄수.

```css
:root {
  /* 페이퍼 */
  --paper:        #FAF6F0;   /* 따뜻한 크림 */
  --paper-2:      #F4EFE6;
  --card:         #FFFFFF;
  --card-soft:    #FFF9F0;

  /* 잉크 */
  --ink:          #2A2D33;
  --ink-2:        #5A5F69;
  --ink-3:        #9097A0;
  --ink-4:        #C7CCD3;
  --line:         #ECE6DA;

  /* 브랜드 (참새 민트) */
  --brand:        #3FD17F;
  --brand-2:      #2EB867;   /* hover */
  --brand-3:      #1F8E4D;   /* 텍스트 강조 */
  --brand-soft:   #DFF6EA;
  --brand-tint:   #F1FBF5;
  --brand-shadow: #1F8E4D;   /* 3D 버튼 그림자 */

  /* 스트릭 (불꽃) */
  --fire:         #FF8A3D;
  --fire-shadow:  #D8651F;
  --fire-soft:    #FFE6D4;

  /* XP (골드) */
  --gold:         #FFC233;
  --gold-shadow:  #C8901C;
  --gold-soft:    #FFF1C7;

  /* 보조 */
  --blue:         #5AB5F0;
  --rose:         #F08A9A;
  --violet:       #B690F0;
}
```

### 11.3 3D 버튼 명세

```css
.btn-3d {
  background: var(--brand);
  color: #fff;
  font-weight: 900;
  border: none;
  border-bottom: 5px solid var(--brand-shadow);
  border-radius: 22px;
  padding: 16px 20px;
  transition: transform .08s ease, border-bottom-width .08s ease;
}
.btn-3d:active { transform: translateY(3px); border-bottom-width: 2px; }
```

- 메인 CTA (체크인, 세리머니 다음): `border-bottom: 5px`, `border-radius: 22px`
- 세컨더리 (±1 버튼): `border-bottom: 3px`, `border-radius: 12px`
- 누르면 `translateY(+눌린만큼)` + `border-bottom-width` 동일량 감소 (물리적 deflate)

### 11.4 애니메이션 명세

| 이름 | 사용처 | spec |
|---|---|---|
| `fadeUp` | 탭 전환 view 진입 | 0.28s ease, opacity 0→1 + translateY 8px→0 |
| `bounce` | The Path "today" 노드, 참새 | 1.4s ease-in-out infinite, ±6px |
| `pulseDot` | CTA 버튼 내 점 | 1.6s infinite, box-shadow ripple |
| `slideUp` | 체크인 바텀시트 | 0.3s cubic-bezier(.2,.8,.2,1) |
| `popIn` | 세리머니 inner | 0.5s cubic-bezier(.2,.8,.2,1.2), scale 0.85→1.04→1 (overshoot) |
| `rcPop` | 보상 카드 3개 | 0.4s ease, delay 0.15 / 0.30 / 0.45s stagger |
| `fall` | Confetti | 2.4s cubic-bezier(.25,.5,.5,1), translateY -20px → 110vh + rotate 720deg |
| `ping` | 마을 불빛 ON | 1.2s ease-out infinite, box-shadow ripple |

참새 SVG: `Sparrow` 컴포넌트 (색상 #C49A4A 본체 + #8B6234 날개 + #E8D5A3 배). 윤지 PR #86 자산 재사용.

---

## 12. 빈 상태 / 마이크로카피

| # | 위치 | 카피 |
|---|---|---|
| 1 | 메인 CTA | "오늘의 한 쪽, 짹 하기" |
| 2 | CTA 아래 nudge | "한 쪽이라도 읽으면 🔥 N일 연속 유지! 작은 호흡도 충분해요." |
| 3 | 체크인 모달 헤더 | "오늘의 짹 🐦" |
| 4 | 체크인 모달 서브 | "한 쪽도 충분해요. 어디까지 읽으셨어요?" |
| 5 | 문장 입력 placeholder | "오늘 마음에 들어온 한 문장을 그대로 옮겨 적어보세요." |
| 6 | 문장 입력 helper | "한 쪽만 읽어도 출석은 인정됩니다. 끊기는 게 더 어려워요!" |
| 7 | 가드레일 토스트 | "한 쪽도 OK! +1만 눌러봐요 🐦" |
| 8 | 둥지 카드 진화 | "참새가 살림을 차렸어요!" |
| 9 | 둥지 hint | "3일 더 읽으면 🏡 다정한 집으로!" |
| 10 | 마을 헤더 | "오늘 불 켜진 친구에게 🪱 모이를 보내봐요." |
| 11 | 세리머니 CTA | "내일도 짹 →" |
| — | 마을 게시판 빈 상태 | "첫 글을 남겨보세요 ✍️" |
| — | 소셜 피드 빈 상태 | "아직 모이가 없어요. 오늘의 모이를 남겨보세요 🐦" |
| — | 책장 빈 상태 | "첫 책을 등록해보세요 📚" |
| — | 책 상세 문장 없음 | "오늘의 문장을 첫 페이지에 남겨보세요" |
| — | 검색 결과 0건 | "찾으시는 책이 없나요? 직접 등록할 수 있어요" |
| — | 미션 완료 후 재진입 | "✍️ 문장 추가" 버튼으로 계속 기록 가능 |
| — | 친구 찾기 결과 없음 | "해당 닉네임의 친구가 없어요" |
| — | 책 상세 구매 링크 | "교보문고에서 보기 →" |
| — | 방패 0 + 스트릭 리셋 | "괜찮아요. 오늘부터 다시 1일차예요 🌱" |
| — | 관심 책 추가 토스트 | "관심 책에 담았어요 📚" |
| — | 책갈피 저장 토스트 | "모이를 책갈피했어요 🔖" |
| — | 관심 책 리스트 빈 상태 | "마음에 드는 책을 발견하면 담아두세요" |
| — | 소셜 신규 시작러 섹션 헤더 | "이번 주 새로 시작한 책" |

---

*v4.3 · 2026-05-14 · 데모 피드백 반영 (슬로건 정리·Top10 큐레이션·D-2 페이지입력·하루다문장·스트릭달력·소셜친구찾기·마을친구상세·게시판정의·책상세+교보링크·다중책연속성·모이방향미결·날짜시뮬레이터)*

*v4.4 · 2026-05-15 · 5/14 야간 팀 회의 반영 (둥지내서재버튼·마을TBD·소셜리그제거·신규시작러Top3·모이용어확정·짹단일화·책갈피·관심책리스트·피드전체공개)*
