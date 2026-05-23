# ReadingGo Spec v5

> 기준일: 2026-05-22
> 상태: **백엔드 고려 MVP 스펙** — Phase 0(웹 데모) / Phase 1(웹 풀스택) / Phase 2(앱 + 푸시)
> 작성 원칙: 이 문서만으로 시스템 구현이 가능해야 한다. 외부 문서 참조 없이 자기충족적.
> 입력 문서(아카이브): `docs/readinggo-discussion.md`, `docs/협동-기반-독서-루틴-조사.md`, `Reading_GO_Service_Planning_v1.pdf`, `docs/readinggo/COMPETITIVE-ANALYSIS.md`, `docs/readinggo/BACKLOG.md`, `docs/readinggo/iOS-PLAN.md`

---

## 0. 한 줄

> "하루 한 페이지, 한 문장에서 시작해요. 그냥 펴진 페이지 한 줄도 좋아요."

*(내부 컨셉 레퍼런스: "독서습관 앱계의 Duolingo" — 외부 노출 불가. v5 부터 게이미피케이션 세부 설계는 Duolingo 벤치마킹을 의도적으로 끊고 ReadingGo 고유 컨텍스트에서 발상.)*

---

## 0.5 v5 도달까지의 여정

이 절은 *왜 이 스펙이 이렇게 생겼는지*를 남긴다. 결정의 결과만 보면 자의적으로 보이는 항목이 많아서, 그 결정에 도달한 경로를 같이 박아둔다. 향후 누군가가 이 스펙을 뒤집고 싶을 때 *어디서부터 다시 검토해야 하는지* 를 알려주는 지도 역할.

### 0.5.1 v1 → v4.4 — 컨셉 형성

피벗 경로: 글로컬X → 기프타로 → 고시옵스 → 찍먹 → 트렌드패치노트 → **ReadingGo** (2026-05 초). 일관 가설은 *"BYOC × 게이미피케이션 × 소셜 × 한국 시장"* 의 빈자리.

스펙 진화: v1 (5/13) → 데모 v4.2 (5/16 #58 Peer Review) → v4.3 (5/16 데모 피드백) → v4.4 (5/14 야간 팀 회의, 모이 용어·소셜 재설계·마을 TBD).

이 시점까지 데모는 *시각적으로 그럴듯* 한 수준에 도달. 그러나 사용자가 *왜 끊기지 않고 매일 들어와야 하는지* 의 코어 메카닉이 검증되지 않음.

### 0.5.2 2026-05-21 — 경쟁자 지도화 (`COMPETITIVE-ANALYSIS.md`)

미니맥 세션에서 국내 9 + 해외 7 = 16개 독서·소셜 앱 정밀 분석. 핵심 발견:

| 발견 | 의미 |
|---|---|
| **북모리** (국내 250~500만 DL, 평점 4.78)가 *의도적으로* 소셜·게이미를 배제 | 우리 진입 공간을 만들어준 장본인. 시장 빈자리는 부재가 아니라 *설계된 부재* |
| **Bookly** 글로벌 슬로건 *"like Duolingo, but for reading"* | 컨셉 정면 충돌. 단 한국 미진출 + 소셜 부재 + 한국어 미지원이 우리 차별점 |
| **Fable** (3M 사용자, 100K+ 북클럽) | 소셜 독서의 글로벌 표준. 한국 미진출. 단점은 클럽 *가입* 부담 — 우리는 *가입 없는 자동 그룹화* 로 차별 |
| **리더스** (국내 인스타형 소셜) | 한국에서 가장 가까운 소셜 경쟁자. 게이미피케이션은 약함 |
| **"한 문장 강제 입력" 메커니즘은 어디에도 없음** | 우리 고유 wedge. BYOC 한계(콘텐츠 검증 불가)를 우회하는 유일한 *읽음의 증명* 형태 |

좌표 확정: 고-게이미 × 고-소셜 × 한국 × 1페이지 원칙. 그 자리는 비어있다.

### 0.5.3 2026-05-22 — 마찰 분해와 결정 (이 v5)

본인(계휴)이 직접 북모리로 연속일 시도하다 *실패*한 자체 데이터로 시작:

> *"실물 책을 들고 다니는 게 쉽지 않더라고. 하루 한 번만 하면 되는 듀오링고만 해도 힘든데."*

이 한 줄에서 v5의 모든 결정이 파생됨. *우리 자신도 못 쓰는 앱은 아무도 못 쓴다.*

**사용자 저항을 5층으로 분해**:

| 층 | 마찰 종류 | 본질 |
|---|---|---|
| 1 | 물리적 | 책을 꺼내야 함 (외출·이동 중 어려움) |
| 2 | 전사 | 한 문장을 타이핑해야 함 |
| 3 | 결정 | "오늘의 문장 뭘 고르지?" 망설임 |
| 4 | 깜빡 | 오늘 안에 못 함 |
| 5 | 초기 습관 | 첫 1~2주 (가장 위험) |

**층별 해소 메카닉 검토 → 결정**:

- 층 1·2 (물리·전사) — OCR / 음성 받아쓰기로 풀 수 있지만 *외부 API 비용*. **학기 범위 기각**. 대신 카피·UX 차원에서 부담을 줄이는 쪽으로 전환.
- 층 3 (결정) — *"그냥 펴진 페이지 한 줄도 좋다"* 카피로 결정 부담 자체를 없앰. 북마크는 별도 기능(v4.4 이미 있음)으로 *읽을 때 따로 모으게* 함.
- 층 4 (깜빡) — 자정 컷오프 유지. *"새벽 3-4시에 펼쳐서 쓸 유저였으면 이전에 했음"* 본인 통찰. 23:00 긴급 알림 카피 강화 ("30초만 — 한 줄만"). 방패 자동 적용(사용자 결정 불필요).
- 층 5 (초기 습관) — 핵심 영역. v4.4의 *첫 7일 자동방패 1개* 는 *"아무 보상 없이 일주일은 별로"* 라 부족. **운영자 짹** 채택.

### 0.5.4 운영자 짹 — Y Combinator 패턴

핵심 인사이트는 *"내가 운영자로서 짹을 보낸다면?"* 라는 본인 발상.

이건 Y Combinator의 *do things that don't scale* 의 ReadingGo 변종. 학기 데모 N≤20 에서는 1인당 7개 짹 × 20명 = 140개 응답이 1주일에 실제 가능. NPC 시뮬레이션이 줄 수 없는 *"내 한 문장을 누가 진짜 봤다"* 라는 첫 경험을 직접 만들어 줌. 가장 외로운 첫 주에 진짜 사람이 응답한다는 단순한 사실이 가장 강한 보호막.

자동화 점진 계획은 별도 안건으로 보존(§13).

### 0.5.5 도파민 보상의 정성

*"입력 직후 0.5초 안에 confetti + XP + 친구 박수 미리보기"* — 메카닉만 있으면 안 됨. **진짜 기분 좋게 정성껏 설계**해야 함. 현재 v4.4 세리머니는 시각적으로 충분하지만, v5에선 *친구 짹 = +1 XP* 를 추가해 **XP를 사회적 화폐로 느끼게** 한다. XP 자체의 destination·소진 메커니즘은 별도 안건(§13).

### 0.5.6 별도 안건으로 분리한 것

- **XP destination** — 모은 XP를 무엇에 쓰는지·왜 모으는지·소진되는지. 현재 v5도 누적 + 레벨업뿐. *Duolingo 벤치마킹 금지* 제약 하에 독립 발상 필요. (§13)
- **T2 mini (같은 책 자동 패널)** — `COMPETITIVE-ANALYSIS.md §7` 옵션 C 채택 결정 완료. 세부 설계 시 **좀비 사용자 처리** 가 핵심 우려 — 같은 책으로 묶었는데 묶인 사용자들이 다 읽지 않고 있으면 새로 들어온 사용자가 *유령의 집* 을 보게 됨. (§13)
- **운영자 짹 자동화 점진 계획** — N 증가 시 어떻게 자동화로 전환할지. 학기 후. (§13)

### 0.5.7 의도적 기각 (보존)

채택 안 한 항목과 그 이유를 §14에 기록. 미래에 누가 다시 제안할 때 *이미 검토하고 기각한 이유* 를 보여주기 위함.

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
> 보조 카피: *"그냥 펴진 페이지 한 줄도 좋아요."*

UI 상 진입 화면 헤더·로그인 화면·온보딩 카피에서 일관되게 사용. v5부터 모이 입력 화면 하단에는 *결정 마찰 제거* 를 위해 보조 카피 항상 표시.

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

**v5에서 재정의**: 기존 Phase 0(정적 웹) → Phase 1(Supabase 웹) → Phase 2(Capacitor 앱) 의 *2번 작업* 모델 폐기. **처음부터 Capacitor 단일 코드베이스**로 진행. 같은 `src/`가 `npm run dev`(웹 미리보기), `npm run build`(Netlify 배포), `npx cap run ios/android`(시뮬레이터·실기기)에 모두 사용됨.

| Phase | 대상 | 산출물 | 백엔드 | 데이터 저장 |
|---|---|---|---|---|
| **Phase 0** | Capacitor 셸 + 기본 데모 | Vite + Capacitor + React, Netlify 웹 배포 + iOS/Android 시뮬레이터 빌드 | **없음** | `localStorage` (Preferences plugin) + 정적 TSV |
| **Phase 1** | MVP — Supabase 연동 | 풀스택 웹앱 + 모바일 동시. 운영자 짹·푸시·Annual Rewind 골격 | **Supabase** (Auth + Postgres + pg_cron) | Postgres + Storage |
| **Phase 2** | 학기말 발표 — 앱스토어 출시 | iOS App Store + Google Play. OCR · 위젯 · 자동 백업 | Supabase + FCM + APNs | Postgres + 로컬 캐시 |
| **Phase 3** | 학기 후 지속 개발 | 컬렉션·자유 노트 별도 타입(검토)·음성 받아쓰기·챕터 자동 인식·수익 모델 검토 | 동일 | 동일 |

### 스택 결정 (v5 확정)

| 항목 | 선택 |
|---|---|
| 빌드 도구 | **Vite** (React+Babel CDN 폐기) |
| 모바일 wrap | **Capacitor** (Cordova 아님, RN 아님). 사유: `docs/readinggo/iOS-PLAN.md` |
| 네이티브 OCR (Phase 2+) | `@capacitor-mlkit/text-recognition` (Android ML Kit + iOS ML Kit). 디바이스 내장, **비용 0**, 한국어 지원 |
| 음성 받아쓰기 (Phase 3) | `@capacitor-community/speech-recognition` (iOS Speech + Android SpeechRecognizer). **비용 0** |
| 백엔드 | Supabase (Phase 1+) |
| 푸시 | APNs (iOS) + FCM (Android), Capacitor Push Notifications plugin (Phase 2+) |
| 호스팅 | Netlify (Vite 빌드 산출물) |

### Phase 0 제약 (Capacitor 환경)

- 외부 API 호출 없음. 책 데이터는 `docs/readinggo/data/books.tsv` 정적 로드
- 인증 없음. 닉네임은 입력만 받아 Preferences plugin (`localStorage` 호환) 저장
- NPC 활동은 시드 데이터로 시뮬레이션
- 알림 없음 (시뮬레이션 토스트)
- 다중 책 진도는 책별 분리 저장 (책 전환 시 진도 초기화 금지)
- **iOS Safari WKWebView 호환 검증**: Vite 전환 직후 iOS 시뮬레이터에서 데모 동등 동작 확인 필수
- **Safe Area + Keyboard 처리** Phase 0 단계에서 박아둠 (`@capacitor/keyboard` + safe-area-inset CSS)

### Phase 1 신규

- Supabase Auth (Google OAuth), Postgres, RLS, pg_cron 배치
- Chrome Notification API (웹 푸시 권한) + Capacitor Push Notifications (모바일 푸시)
- 클라이언트 사이드 fuzzy 검색 (Fuse.js)
- NPC 일일 활동 pg_cron 배치
- 닉네임 중복 검증 (서버), 금칙어 (LDNOOBW + 한국어 추가)
- 주간 리그 (XP 합산 개인 랭킹) — *소셜 탭 UI 노출은 v4.4 결정에 따라 보류*
- **운영자 짹 대시보드** (`/operator`) §5.6
- **Annual Rewind 골격** — 12월에 활성화될 연말 회고 화면 (`docs/readinggo/ROADMAP.md` 참조)

### Phase 2 신규

- **iOS App Store + Google Play 정식 출시** — `docs/readinggo/iOS-PLAN.md` 의 단계화된 출시 계획
- **OCR — `@capacitor-mlkit/text-recognition`** (v5 §14 기각 결정 부분 해제: 네이티브 환경 + 디바이스 내장 = 비용 0)
- **위젯** (iOS WidgetKit + Android Glance) — 오늘의 모이 / 무작위 모이 / 스트릭
- **자동 백업** — Google Drive (Android) + iCloud (iOS). 낮은 우선순위
- FCM + APNs 푸시
- NPC 다인·확장된 일과
- 챕터 자동 인식 후보 (알라딘 프리미엄 또는 사용자 OCR 결과 기반)

### Phase 3 신규 (학기 후 지속)

- Rich Text 자유 노트 — 별도 타입 신설 여부 (§13.5 안건)
- 음성 받아쓰기 (`@capacitor-community/speech-recognition`)
- 컬렉션 / 시리즈
- 태그별 통계 심화
- 챕터 자동 인식 본격화
- **수익 모델 검토** — 구독·광고·결제. 학기 후 별도 안건 (§13.6)
- T2 mini (같은 책 자동 패널) §13.2 본 설계 진입

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

**C-2. 확인 / 직접 등록 + 오늘의 모이 입력**

한 화면에서 책 등록과 첫 기록을 모두 완료.

- 상단: 선택한 책의 표지·제목·저자 표시 (직접 등록 시 제목·저자·총페이지 입력 폼)
- "현재까지 읽은 페이지" 숫자 입력 (기본 0)
- **구분선**
- "오늘의 모이 🐦" 섹션:
  - "어느 페이지에서?" 숫자 입력 (기본값 = 현재 페이지)
  - 텍스트 영역, placeholder: "마음에 든 한 줄을 적어주세요 (최대 200자)"
  - **하단 안내 (v5 신설)**: *"그냥 펴진 페이지 한 줄도 좋아요. 좋은 문장을 고를 필요 없어요."* — 결정 마찰 제거 카피
  - 문자 수 카운터. 최소 1자 이상이어야 CTA 활성
- 자동 임시 저장 (localStorage `rg_pending_sentence`)
- CTA `이 책으로 시작` → 이 책이 **활성 책**으로 지정됨 → **D-3**

### D. 세리머니

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

- 가입 전이면 CTA `Google로 계속` (로그인 직행, 별도 랜딩 페이지 없음), 이미 로그인이면 홈 복귀

### E. 가입

- 별도 랜딩 화면 없음. D-3 세리머니 CTA가 직접 OAuth 트리거
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
| 긴급 알림 (v5 강화) | 미참여 + 23:00 도달 시. **"🛡 30초만 — 한 줄만! {N}일 연속 기록이 사라지려 해요 🥺"** — 시간 비용 명시 카피로 마찰 진입장벽 낮춤 |
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

**v5 신설 — 첫 7일 가속 모드** (첫 책에 한함):

| 가입 후 일자 | 단계 트리거 |
|---|---|
| D1 | 🪵 (시작 시) |
| D3 | 🪹 (페이지 무관, 3일 연속 입력 시) |
| D7 | 🏠 (7일 연속 입력 시) |

- 첫 책에 한해 일자 기반 가속. 8일차 이후는 페이지 기반 정상 진화 표로 복귀.
- 가속 진화 시 confetti + 운영자 졸업 짹(§5.6.5) 동시 트리거.
- 첫 책 = `user_books` 의 가장 오래된 `started_at`. 두 번째 책부터는 페이지 기반만 적용.

가속 모드 도입 이유: 첫 일주일에 *시각적 변화* 가 자주 터져야 사용자가 "내 행동이 *집을 짓고 있다*"라고 느낌. 페이지만 기준으로 하면 책에 따라 첫 주에 진화 변화가 전혀 없을 수 있음 (총 페이지 600쪽 책 = 3일에 5쪽 읽어도 1% 미만).

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
- 책 칩 탭 → §5.8 책 상세 페이지 (내서재 탭)

**마을 게시판**:
- 마을 주민(친구+NPC)이 올리는 자유 감상 게시글
- 소셜 피드(문장 공유)와 차이: 게시판은 자유 텍스트, 피드는 sentences 테이블 기반
- Phase 0: NPC 시드 게시글 3개 하드코딩. Phase 1: 텍스트 입력 → 저장

### 5.6 운영자 짹 (Operator) — v5 신설

첫 7일 보호의 *주축* 메커니즘. NPC 시뮬레이션이 아니라 *실제 사람(운영자)* 이 사용자가 막 입력한 모이에 짹/박수로 응답.

#### 5.6.1 운영자 정의

- `users.is_operator` bool 컬럼 신설 (`is_npc` 와 구분)
- 운영자 = 학기 데모 기간 동안 계휴 본인 + 팀원(승원·윤지) 중 권한 부여된 계정
- UI 표식: 닉네임 옆 **✨** 이모지 (NPC 의 ` · NPC` suffix 와 다른 표식)
- 일반 사용자 마을 그리드·소셜 피드에서는 *조금 더 자주 등장하는 친숙한 친구* 처럼 보이는 정도. 운영진이라는 사실은 굳이 강조 안 함

#### 5.6.2 운영자 짹 스케줄 (첫 7일)

| 일자 | 트리거 | 내용 |
|---|---|---|
| D1 | 첫 모이 입력 직후 (자동 큐잉) | 환영 짹 — *"시작이 가장 어려운 부분이었어요. 내일도 한 줄 기다릴게요."* |
| D2~D6 | 매일 사용자 모이 작성 시 운영자 대시보드에 알림 | 사용자 한 문장을 *진짜로 읽고* 짧은 응답 짹 작성. 응답 시간 24h 이내 목표 |
| D7 | 7일 연속 도달 시 자동 큐잉 | 졸업 짹 — *"일주일을 채웠어요. 여기서부터가 진짜 ReadingGo예요."* 둥지 진화 🏠 트리거와 동시 |
| 미참여일 | 운영자 짹 일시정지 (스트릭 끊김 시) | 첫 복귀일에 부드러운 환영 짹 1회 — *"다시 펼쳐주셔서 고마워요"* |

#### 5.6.3 운영자 대시보드 (Phase 1+)

별도 화면 `/operator` (운영자 권한 사용자만 접근):

- 미응답 큐: 최근 입력된 사용자 모이 중 운영자 짹이 아직 안 달린 것
- 각 항목에 사용자 닉네임·책·페이지·모이 텍스트·가입 후 일수 표시
- "응답" 버튼 → 미니 작성 폼 (200자) → 즉시 짹 발송
- 빠른 응답 템플릿 5개 (환영·격려·공감·인용 호응·졸업)

Phase 0: 시드 응답 5개 하드코딩, 사용자가 첫 입력하면 0.5초 지연 후 자동으로 받은 짹 토스트.

#### 5.6.4 데이터 모델 (§7.3 확장)

- `users.is_operator` bool DEFAULT false
- `operator_replies` 테이블:
  - `id`, `to_sentence_id`, `from_user_id`(운영자), `text`, `created_at`
- 일반 짹(`claps`)과 분리. 운영자 응답은 카드 UI에서 *별도 영역* 으로 두드러지게 표시

#### 5.6.5 자동화 점진 계획 (§13 안건)

학기 데모 N≤20 에서는 수동. 사용자 증가 시 자동화로 점진 전환 — 구체 임계값·UX는 학기 후 결정. 리스트만 §13에 보존.

#### 5.6.6 운영자 짹 vs NPC

|  | 운영자 짹 | NPC |
|---|---|---|
| 응답 시점 | 사용자 모이 *내용을 읽고* 24h 이내 | 자정 배치, 임의 추첨 |
| 응답 텍스트 | *사용자 한 문장에 맞춤* | 사전 시드 풀에서 추첨 |
| 등장 빈도 | 첫 7일은 매일 1회 이상 보장 | 자율적 |
| 사용자 인식 | "사람이 진짜 봤다" | "활동 중인 친구가 있다" |
| 표식 | ✨ | NPC suffix |

---

### 5.7 소셜 탭

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
| 책 자세히 보기 | 카드 내 책 제목 탭 → §5.8 책 상세 페이지 진입 |
| 관심 책 추가 | 책 상세 페이지 내 "관심 책에 추가" → 내서재 관심 책 목록(§5.8)에 저장 |
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

### 5.8 내서재 탭

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

### 5.9 닉네임 규칙 — §4 E-1 참조

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

> **v5 위상 변경**: 첫 7일 보호의 *주축* 은 §5.6 운영자 짹으로 이전. 방패는 *보조 안전망* 으로 위상 조정. 메카닉 자체는 v4.4 유지.

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
| **친구 짹 받음 (v5 신설)** | **+1** |
| 7일 스트릭 | +100 + 배지 |
| 30일 스트릭 | +500 + 배지 |

레벨 계산: `level = floor(sqrt(xp / 100)) + 1` (Phase 1 시점 재조정 가능).

**v5 — XP 의미 변경**:

친구 짹 = +1 XP 는 *작은 화폐* 처럼 느끼게 하는 의도. 사용자가 입력 직후 받는 짹들이 *눈에 보이는 보상* 으로 누적된다는 즉시 보상 회로. 박수(+5) 와는 별개 — 짹은 빈도가 높으니 단가는 낮게.

**XP destination — 미해결 (§13)**:

현재 v5도 XP는 *누적 숫자 + 레벨업* 뿐. 무엇에 쓰는지·왜 모으는지·소진되는지는 미정. 이 결정은 *Duolingo 벤치마킹 금지* 제약 하에 별도 세션에서 독립 발상 필요 (§13).

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
| **v5 — 결정 마찰 카피** | 모이 입력 화면 하단에 "그냥 펴진 페이지 한 줄도 좋아요. 좋은 문장을 고를 필요 없어요." 상시 표시 |
| **v5 — 첫 7일 보호 주축** | §5.6 운영자 짹 (Y Combinator do-things-that-don't-scale 패턴) |
| **v5 — 첫 7일 둥지 진화 가속** | 첫 책에 한해 D1/D3/D7 일자 트리거로 🪵→🪹→🏠 진화. 8일차+는 페이지 기반 |
| **v5 — 친구 짹 = +1 XP** | XP를 *사회적 화폐* 로 감각시키는 즉시 보상 메카닉 |
| **v5 — 컷오프** | 자정 KST 유지. 새벽 3-4시 유예 채택 안 함 (사용자 행동 모순) |
| **v5 — 알림 카피 강화** | 23:00 긴급 알림 카피에 "30초만 — 한 줄만" 강조 추가 |
| **v5 — 외부 API** | OCR / 음성 받아쓰기 등 *비용 발생 외부 API* 학기 범위 전체 기각 (§14) |
| **v5 — Duolingo 벤치마킹** | 게이미피케이션 세부 설계 시 의도적으로 인용 끊고 ReadingGo 고유 컨텍스트에서 발상 (§14) |
| **v5 — 운영자 정의** | `users.is_operator` 신설. ✨ 표식. NPC와 분리 |
| **v5 — XP destination** | 미해결, 별도 안건으로 보존 (§13) |
| **v5 — T2 mini (같은 책 자동 패널)** | `COMPETITIVE-ANALYSIS.md §7` 옵션 C 채택 결정 완료. 세부 설계는 §13 |
| **v5 — T2 좀비 사용자 처리** | 핵심 우려사항. 활동 N일 내 사용자만 패널에 노출, 휴면 사용자는 hibernation. N 임계값 미정 |
| **v5.1 — Phase 재정의** | Capacitor 처음부터 단일 코드베이스. Phase 0/1/2/3 모두 같은 `src/` 위에서 진행 |
| **v5.1 — 모이 확장 필드 (`sentences.my_note`)** | 짧은 한 문장 강제(`text`) 유지 + *내 감상* 선택 필드(`my_note`) 분리. Rich Text 자유 노트 별도 타입은 §13.5 학기 후 결정 |
| **v5.1 — 챕터 ID 자동 매핑** | `sentences.chapter_id` 신설. 모이 작성 시 페이지로 챕터 자동 식별 (`books_toc.csv` 기준) |
| **v5.1 — 북모리 전체 벤치마크 + 단계 로드맵** | `docs/readinggo/ROADMAP.md` 신설. 북모리 모든 피쳐 × Phase × 우선순위 매트릭스 |
| **v5.1 — 모이 → 이미지 카드 공유 채택** | Phase 1 P1. 북모리의 바이럴 루프 |
| **v5.1 — 태그 시스템 채택** | 모이·책 양쪽. Phase 1 P1 |
| **v5.1 — 바코드 스캔 책 등록 채택** | Phase 1 P1. `@capacitor-mlkit/barcode-scanning` |
| **v5.1 — 책 메타데이터 자동 채움 채택** | 알라딘 OpenAPI 무료. Phase 1 P1 |
| **v5.1 — 무작위 모이 회상 채택** | Phase 1 P1. 홈 카드 → Phase 2 위젯 확장 |
| **v5.1 — Annual Rewind 채택** | Phase 1 골격 → Phase 2 본 화면. 12월 활성화 |
| **v5.1 — 위젯·자동백업·다크모드·PIN 채택** | Phase 2 P1~P2 |
| **v5.1 — 수익 모델 검토** | 학기 후 별도 안건 (§13.6) |
| **v5.1 — Rich Text 자유 노트** | *별도 타입 신설은 보류*. 모이 확장 필드(`my_note`)로 흡수. 별도 타입 채택 여부는 학기 후 (§13.5) |

---

## 9. Phase 0 데모 시나리오 (#58, 2026-05-16)

4분 클릭 시연. 데이터는 localStorage + 정적 TSV.

| 시간 | 화면 | 동작 |
|---|---|---|
| 0:00 | A 진입 | 슬로건 "하루 한 페이지, 한 문장에서 시작해요.", `시작하기` |
| 0:15 | C-1 검색 | 요즘 Top10 탭 표시 → "사피" 입력 → 사피엔스 fuzzy 매칭 |
| 0:30 | C-2 확인+모이 | 표지 확인, 현재 페이지 10 입력, 모이 페이지 10 + "역사는 픽션이 만든 질서다" 입력 |
| 1:00 | D-3 세리머니 | Confetti 8색, 보상 카드, "Google로 계속" CTA |
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
| 5 | 모이 입력 화면 결정 마찰 카피 박기 ("그냥 펴진 페이지 한 줄도 좋아요") | 0 |
| 6 | 첫 7일 둥지 진화 가속 로직 (`docs/readinggo/js/nest.js`) | 0 |
| 7 | 운영자 짹 Phase 0 시드 — 시드 응답 5개 하드코딩, 자동 토스트 | 0 |
| 8 | 친구 짹 → +1 XP 적립 로직 (`docs/readinggo/js/social.js`) | 0 |
| 9 | 23:00 긴급 알림 카피 강화 ("30초만 — 한 줄만") | 0 |
| 10 | Supabase 프로젝트 셋업, 7.3 스키마 마이그레이션 (operator_replies 포함) | 1 |
| 11 | Google OAuth 연동 | 1 |
| 12 | pg_cron 스트릭/방패/NPC/리그 배치 | 1 |
| 13 | 운영자 대시보드 `/operator` 화면 + 미응답 큐 | 1 |
| 14 | `users.is_operator` 권한 부여 (Supabase admin) | 1 |
| 15 | Chrome Notification 알림 | 1 |
| 16 | 닉네임 RPC + 금칙어 사전 | 1 |
| 17 | 주간 리그 쿼리·캐시 | 1 |
| 18 | T2 mini (같은 책 자동 패널) 설계 확정 — §13 안건 (학기 후) | 1+ |
| 19 | XP destination 설계 — §13 안건 (학기 후) | 1+ |
| 20 | iOS + Android Capacitor 빌드 (`docs/readinggo/iOS-PLAN.md`) | 2 |
| 21 | FCM 푸시 + APNs | 2 |

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
| — | 모이 입력 결정 마찰 (v5) | "그냥 펴진 페이지 한 줄도 좋아요. 좋은 문장을 고를 필요 없어요." |
| — | 23:00 긴급 알림 (v5 강화) | "🛡 30초만 — 한 줄만! {N}일 연속 기록이 사라지려 해요 🥺" |
| — | D1 운영자 환영 짹 (v5) | "시작이 가장 어려운 부분이었어요. 내일도 한 줄 기다릴게요. — 운영자 ✨" |
| — | D7 운영자 졸업 짹 (v5) | "일주일을 채웠어요. 여기서부터가 진짜 ReadingGo예요. — 운영자 ✨" |
| — | 운영자 컴백 짹 (v5) | "다시 펼쳐주셔서 고마워요. 한 줄부터 다시 시작해요. — 운영자 ✨" |
| — | 친구 짹 받음 토스트 (v5) | "@{handle}의 짹! ⚡ +1" |
| — | 첫 책 D3 진화 (v5) | "참새가 둥지를 짓기 시작했어요. 3일째예요!" |
| — | 첫 책 D7 진화 (v5) | "참새가 집을 완성했어요. 일주일을 채우셨어요!" |

---

## 13. 미해결 안건 (학기 후 또는 별도 세션)

이 절은 v5에서 *의도적으로 미해결로 보존* 한 안건. 각 항목은 "왜 지금 결정 안 했는지" 와 "다음에 어떻게 시작할지" 를 명시.

### 13.1 XP destination — 모은 XP를 무엇에 쓰는가

**현재 상태**: 누적 + 레벨업뿐. 사용자에게 *왜 XP를 모으는지* 의 답이 없음.

**제약**: Duolingo 벤치마킹 금지 (사용자 명시). 젬·하트·weekend amulet 같은 패턴 인용 없이 독립 발상.

**시작 질문**:
- ReadingGo XP는 *책 읽기* 라는 행위에서 발생하는데, *책과 무관한 곳* 에 써야 의미가 있나, 아니면 *책 행동을 더 풍부하게 하는 곳* 에 써야 하나?
- XP는 *소진되는 자원* 인가 *영속 누적되는 신분* 인가?
- 친구 짹 = +1 XP 가 *화폐* 라면 *상점* 이 있어야 하는데, ReadingGo의 상점에는 무엇이 진열되어야 하나?

**별도 세션에서 다룸**. 학기 데모는 *누적만* 으로 진행 가능.

### 13.2 T2 mini — 같은 책 자동 패널

**채택 결정 완료** (`COMPETITIVE-ANALYSIS.md §7`, 옵션 C). 같은 책을 읽는 사람들의 자동 그룹 패널을 책 상세 페이지에 추가.

**핵심 우려 — 좀비 사용자 처리**:

> "같은 책으로 묶어주는 거 아주 중요함. 그리고 그 책 선정해서 읽는 사람들이 좀비가 되어 있지 않게. 시작하고 안 읽고 있거나, 앱을 지우거나 하는 경우들이 다수 있을 터라." (2026-05-22, 본인)

좀비가 패널에 남으면:
- 새 사용자가 같은 책 패널 진입 → "활동 없는 사람들" → 위축
- T2가 *소셜 자석* 이 아니라 *유령의 집* 이 됨

**미정 디테일**:
- 활동 N일 임계값 (7일 / 14일 후보)
- 휴면 사용자 hibernation UI (목록에서 제거 vs 회색 처리 vs 별도 섹션)
- 같은 책 패널 진입 후의 상호작용 (단순 목록인가, 그들의 짹·진척이 보이는가, 짹 주고받을 수 있는가)
- 패널이 비어있을 때(혼자만 읽는 책)의 폴백 UX

**학기 후 별도 세션**.

### 13.3 운영자 짹 자동화 점진 계획

**채택 결정 완료** (§5.6). 학기 데모 N≤20 에서는 100% 수동.

**점진 자동화 후보 (리스트만)**:

| 단계 | 사용자 N | 운영자 작업 | 자동화 부분 |
|---|---|---|---|
| 1 | ≤20 | 100% 수동 — 모든 짹 운영자가 작성 | 없음 |
| 2 | ≤100 | D1/D7 수동, D2~D6는 NPC 시드 짹 라이브러리 확장 | 시드 풀에서 사용자 모이 키워드 기반 매칭 추천 |
| 3 | ≤500 | 운영자가 AI 응답 후보 중 1초 컷 선택 (반자동) | LLM이 사용자 모이 읽고 3개 응답 후보 생성 |
| 4 | ≥500 | 샘플 모니터링·품질 가드 | AI 완전 자동, 운영자는 *재미있어 보이는* 사용자에게만 수동 짹 |

**미정**:
- 각 단계 임계값의 구체 숫자
- 시드 라이브러리 규모와 카테고리
- AI 응답 품질 가드 (브랜드 일관성, 부적절 응답 차단)
- 운영자 작업이 *0에 수렴* 하는 게 목표인가, *영속적인 한 줄* 인가의 철학적 결정

**학기 후 별도 세션**.

### 13.4 마을 탭 전체 재설계

v4.4에서 *TBD* 로 둔 안건 (§5.5). v5에서도 *TBD* 유지. 마을의 본질(시각화·게시판·콕찌르기 알림 효과)을 §13.2 T2 mini 와 함께 묶어 재설계 필요.

### 13.5 Rich Text 자유 노트 — 별도 타입 신설 여부

**현재 상태 (v5.1)**: 별도 타입 신설 *보류*. 모이의 `my_note` 확장 필드로 *내 감상* 흡수. 짧은 한 문장 강제(`text`) 와 자유 메모(`my_note`)가 한 객체에 묶임.

**문제 제기**: 북모리는 *짧은 인용구* 와 *긴 자유 노트* 를 별도 타입으로 분리. ReadingGo도 동일 분리가 필요한가?

**찬성 측 논리**:
- 책에 대한 *긴 감상문·서평* 은 모이 단위로 풀리지 않음
- 사용자가 *지금 모이* 와 *나중에 길게 정리한 글* 을 구분하고 싶을 수 있음
- 북모리 데이터로 검증된 유저 행동 패턴

**반대 측 논리**:
- 모이 *짧은 한 문장 강제* 가 ReadingGo wedge. 자유 노트 추가하면 *모이 강제성 희석* 위험
- 데이터 모델 복잡도 ↑
- `my_note` 필드만으로 80% 케이스 커버 가능

**학기 후 별도 세션**. 사용 데이터(`my_note` 길이 분포, 사용 빈도) 로 의사결정.

### 13.6 수익 모델 — 학기 후 별도 안건

**현재 상태**: 학기 데모 = 전체 무료. 광고 없음.

**미정 디테일**:
- 영원 무료 (학생 프로젝트 정체성) vs 구독 BM (북모리·Bookly 패턴) vs 광고 BM (북모리 무료 게이트 패턴)
- 사용자 N 임계값, 운영 비용 발생 시점, 법인화 의향
- ReadingGo의 *어떤 가치* 를 유료로 묶을지 (OCR 무제한? 통계 확장? 광고 제거?)

**학기 끝나야 의사결정 가능 변수가 드러남**.

---

## 14. 의도적 기각 결정 (보존)

미래에 같은 제안이 다시 올라올 때 *이미 검토하고 기각한 이유* 를 보여주기 위한 절. 기각 결정은 가역적이며, 상황(예: 무료 OCR API 등장, 사용자 N 폭증) 변화 시 재검토 가능.

| 항목 | 검토 시점 | 기각 사유 | 재검토 트리거 |
|---|---|---|---|
| **OCR — 웹 환경** (Tesseract.js / Cloud Vision API) | 2026-05-22 | 라이브러리 무게(Tesseract.js 4MB+, 한국어 정확도) 또는 외부 API 비용 | — (Phase 0/1 웹 환경 한정 영구 기각). Capacitor 네이티브로 우회 |
| **OCR — 네이티브** (Capacitor + ML Kit/Vision) | 2026-05-22 → **2026-05-23 채택** | (이전 기각 사유: 학기 범위 비용) | **Capacitor 처음부터 진행 결정으로 비용 0 확인. Phase 2 P1로 채택 (§3, ROADMAP)** |
| **음성 받아쓰기 — 웹** (Web Speech API) | 2026-05-22 | 브라우저별 지원 불일치, Chrome은 사실상 외부 API | — |
| **음성 받아쓰기 — 네이티브** (Capacitor) | 2026-05-23 | (이전 기각 사유 해제) | **Phase 3 채택 — `@capacitor-community/speech-recognition`** |
| **글자 수 미니멈 도입** | 2026-05-22 | 어차피 미설정. 마찰 늘림 | 입력 품질 문제 발생 시 |
| **Duolingo 세부 메카닉 인용** | 2026-05-22 | 독립 발상 요구 (사용자 명시) | — (영속 제약) |
| **짹마다 다른 색 confetti** | 2026-05-22 | 재미 요소지만 우선순위 낮음 | v6 시각 디테일 라운드 |
| **첫 7일 XP 더블** | 2026-05-22 | "XP가 뭔지 의미가 모호한데 두 배 줘봤자 감 안 옴" — 본인 | XP destination 결정(§13.1) 후 재검토 |
| **새벽 3-4시 컷오프 유예** | 2026-05-22 | "그 시간에 책 펴서 쓸 유저였으면 이전에 했음" 사용자 행동 모순 | 데이터로 새벽 활동 사용자 클러스터 확인 시 |
| **사전 질문 (가입 전)** | v4 | 마찰 제거 | — |
| **소셜 탭 주간 리그 노출** | v4.4 (5/14 회의) | 강조점 분산 | 사용자 인터뷰에서 *경쟁 자극* 요구 명시 시 |
| **`B. 사전 질문` 화면** | v4 | 1일 1페이지 1문장이 유일 목표 | — |

---

*v5.1 · gyehyu/readinggo-spec-v5 — Capacitor 처음부터 / 모이 확장 필드 / 북모리 전체 벤치마크 채택 (2026-05-23)*

**연관 문서**:
- `docs/readinggo/ROADMAP.md` — 북모리 전체 피쳐 × Phase × 우선순위 매트릭스
- `docs/readinggo/iOS-PLAN.md` — Capacitor 출시 계획 (v5.1 기준 재작성됨)
- `docs/readinggo/BACKLOG.md` — 피어리뷰·구현 누락·v3 cut-line 트리아지
- `docs/readinggo/COMPETITIVE-ANALYSIS.md` — 경쟁자 분석 (북모리·Bookly·Fable 등 16개)
