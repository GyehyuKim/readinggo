# ReadingGo Phase 0 데모 구현 스펙 — jerome 버전

> v4.1 스펙(PR #87)을 받아 구현한 Phase 0 웹 데모(`readinggo-v4.html`)에서 확정된
> 디테일을 정리한 patch 노트. **v4.1과 머지해 v4.2를 만들기 위한 입력 문서.**
>
> - 데모 파일: `docs/readinggo/index.html` (또는 별도 `readinggo-v4.html`)
> - 작성일: 2026-05-14
> - 작성자: jerome
> - 베이스 스펙: `docs/readinggo-spec.md` v4.1

---

## 0. 변경 요약 (v4.1 → v4.2 후보)

| # | 항목 | v4.1 상태 | 데모 확정값 |
|---|---|---|---|
| 1 | 폰트 시스템 | "Nunito" 명시 | **머니그라피 Rounded + Pixel** 페어링 룰로 교체 |
| 2 | 컬러 팔레트 hex | 추상적 기재 | 9개 토큰 hex 확정 |
| 3 | 3D 버튼 spec | "3D 버튼" 단어만 | `border-bottom: 5px` shadow trick + active 모션 명세 |
| 4 | 둥지 5단계 명칭 | 이모지만 정의 | 한글 명칭 5개 확정 (나뭇가지 자리 → 참새의 성) |
| 5 | The Path 노드 상태 | done/today/ghost 단어만 | 시각 명세 + bounce 애니 |
| 6 | D-3 세리머니 timing | "Confetti 18조각" | stagger 0.15s, 컬러 8종, 2.4s fall 명세 |
| 7 | 체크인 모달 UX | 페이지+문장 입력 | 바텀시트 + `[-1][+1][+10]` 3D 버튼 + 직접 입력 + 200자 limit |
| 8 | 마이크로카피 §12 | 7개 위치 | **11개 확정 카피** 추가 |
| 9 | 마을 인터랙션 | 모이 1일/1회 | 클릭 → 토스트 + sent state(회색) 시각 룰 |
| 10 | 소셜 리그 표기 | 데이터 모델만 | NPC 접미사 표기 룰 (`@nick · NPC`), 1·2·3위 컬러 |

---

## 1. 디자인 토큰 §11 보강

### 1.1 폰트 시스템

머니그라피(토스 산하 디자인스튜디오 Moneygraphy)의 두 폰트를 **역할 분리**로 사용.

```css
@font-face{
  font-family: 'Moneygraphy Rounded';
  src: url('fonts/Moneygraphy-Rounded.otf') format('opentype');
  font-weight: 400 900;
  font-display: swap;
}
@font-face{
  font-family: 'Moneygraphy Pixel';
  src: url('fonts/Moneygraphy-Pixel.otf') format('opentype');
  font-weight: 400 900;
  font-display: swap;
}
body{
  font-family: 'Moneygraphy Rounded','Noto Sans KR',sans-serif;
  letter-spacing: -0.2px;
}
```

| 용도 | 폰트 | 비고 |
|---|---|---|
| 본문 / 헤더 / 버튼 / 모든 한글 카피 | **Moneygraphy Rounded** | `letter-spacing: -0.2px` |
| 숫자 / 게임 같은 라벨 / 메타 | **Moneygraphy Pixel** | `letter-spacing: 0.5~1.5px`, `font-weight` 강제 변경 X (단일 굵기 폰트) |
| Fallback 한글 | Noto Sans KR | 폰트 로딩 실패 대비 |

**왜 두 폰트로 나눴나** — Rounded만 쓰면 평평하고, Pixel만 쓰면 가독성↓.
듀오링고/토스 캐릭터 페이지 모범처럼 **본문은 부드럽게, 숫자는 게임처럼** 분리할 때
"말랑함 + 귀여움" 두 마리 토끼.

**Pixel 적용 위치 (선택자 단위)**

```css
.stat span:not(.ico),     /* 상단 스트릭/XP/리그 숫자 */
.path .node,              /* The Path ✓ ★ ＋ */
.book-progress-num,       /* 책 진도 126/300p */
.nest-stage,              /* LV.3 · 따뜻한 둥지 */
.page-num,                /* 모달 큰 페이지 숫자 */
.reward-card .val,        /* 보상 카드 +25 / 12일 */
.reward-card .lbl,        /* XP / STREAK / 한 문장 */
.league-rank, .league-xp, /* 리그 순위·XP */
.friend-nest .streakmini, /* 마을 🔥 64 */
.shelf-prog,              /* 서재 진도 메타 */
.sentence-card .meta {    /* 12분 전 */
  font-family: 'Moneygraphy Pixel', 'Moneygraphy Rounded', monospace;
}
```

> ⚠️ Pixel은 단일 굵기 — `font-weight: bold` 주지 말 것. 위계는 `letter-spacing`/`font-size`로만.

### 1.2 컬러 팔레트 (v4.1 데모 확정값)

```css
:root{
  /* 페이퍼 */
  --paper:        #FAF6F0;  /* 따뜻한 크림 (차가운 흰색 회피) */
  --paper-2:      #F4EFE6;
  --card:         #FFFFFF;
  --card-soft:    #FFF9F0;

  /* 잉크 */
  --ink:          #2A2D33;  /* 차콜 (로고와 동일) */
  --ink-2:        #5A5F69;
  --ink-3:        #9097A0;
  --ink-4:        #C7CCD3;
  --line:         #ECE6DA;

  /* 브랜드 (참새의 민트) */
  --brand:        #3FD17F;  /* 메인 */
  --brand-2:      #2EB867;  /* hover */
  --brand-3:      #1F8E4D;  /* 텍스트 강조 */
  --brand-soft:   #DFF6EA;  /* 배경 tint */
  --brand-tint:   #F1FBF5;  /* 더 옅은 tint */
  --brand-shadow: #1F8E4D;  /* 3D 버튼 그림자 */

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

> 🐦 참새 민트 = 브랜드 / 🔥 오렌지 = 스트릭 / ⭐ 골드 = XP 의 **3색 의미체계** 엄수.

### 1.3 3D 버튼 명세

```css
.btn-3d{
  background: var(--brand);
  color: #fff;
  font-weight: 900;
  border: none;
  border-bottom: 5px solid var(--brand-shadow);
  border-radius: 22px;
  padding: 16px 20px;
  transition: transform .08s ease, border-bottom-width .08s ease;
}
.btn-3d:active{
  transform: translateY(3px);
  border-bottom-width: 2px;
}
```

- **메인 CTA(체크인, 세리머니 다음 버튼)**: `border-bottom: 5px`
- **세컨더리(페이지 ±버튼)**: `border-bottom: 3px`
- 라운드: 메인 22px / 세컨더리 12px
- 누르면 항상 `translateY(+눌린만큼)` + `border-bottom-width` 동일량 감소 → 물리적 deflate 느낌

### 1.4 애니메이션 5종 (확정)

| 이름 | 사용처 | spec |
|---|---|---|
| `fadeUp` | 탭 전환 시 view 진입 | 0.28s ease, opacity 0→1 + translateY 8px→0 |
| `pulseDot` | CTA 버튼 안 작은 점 | 1.6s infinite, box-shadow ripple |
| `bounce` | The Path "today" 노드 | 1.4s ease-in-out infinite, ±6px |
| `slideUp` | 체크인 바텀시트 | 0.3s cubic-bezier(.2,.8,.2,1) |
| `popIn` | 세리머니 inner | 0.5s cubic-bezier(.2,.8,.2,1.2), scale 0.85→1.04→1 (overshoot) |
| `rcPop` | 보상 카드 (3개 stagger) | 0.4s ease, delay 0.15·0.30·0.45s |
| `fall` | Confetti | 2.4s cubic-bezier(.25,.5,.5,1), translateY -20px → 110vh + rotate 720deg |

---

## 2. 둥지 5단계 — 명칭 확정

| LV | 이모지 | 명칭 | 진화 조건 (제안) |
|---|---|---|---|
| 1 | 🪵 | 나뭇가지 자리 | 가입 직후 |
| 2 | 🪹 | 빈 둥지 | 누적 1일 |
| 3 | 🏠 | 따뜻한 둥지 | 누적 7일 |
| 4 | 🏡 | 다정한 집 | 누적 30일 |
| 5 | 🏰 | 참새의 성 | 누적 100일 |

진화 시 마이크로카피 (예시):

- LV2: "참새가 자리를 잡았어요!"
- LV3: "참새가 살림을 차렸어요!"
- LV4: "다정한 이웃이 되었어요!"
- LV5: "전설의 참새 성주!"

---

## 3. The Path 시각 명세

7노드(최근 7일) 지그재그 배치. 노드 상태 3종.

### 3.1 노드 상태

| 상태 | class | 외형 | 내용 |
|---|---|---|---|
| 완료 | `.done` | 민트 채움, 차콜 그림자 | `✓` |
| 오늘 | `.today` | 골드 채움, 골드 그림자, **bounce 애니** | `★` |
| 미래(고스트) | `.ghost` | 투명 + dashed border, 회색 글자 | `＋` |

```css
.path .node{
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--card);
  border: 2px solid var(--brand-soft);
  font-family: 'Moneygraphy Pixel';
}
.path .node.done{
  background: var(--brand); color: #fff;
  border-color: var(--brand-2);
  box-shadow: 0 4px 0 var(--brand-shadow);
}
.path .node.today{
  background: var(--gold); color: var(--ink);
  border-color: var(--gold-shadow);
  box-shadow: 0 4px 0 var(--gold-shadow);
  animation: bounce 1.4s ease-in-out infinite;
}
.path .node.ghost{
  background: transparent;
  border: 2px dashed var(--ink-4);
  color: var(--ink-4);
}
.path .node:nth-child(odd) { transform: translateY(-12px); }
.path .node:nth-child(even){ transform: translateY( 10px); }
```

### 3.2 점선 트랙

노드들 사이에 dashed 가로선 (반복 그라디언트, opacity 0.55).

### 3.3 체크인 완료 시 노드 상태 전이

체크인 직후:
1. 기존 `.today` 노드 → `.done`으로 변경 (✓)
2. 기존 `.ghost` 노드 → `.today`로 승격 (★, bounce 시작)

---

## 4. 체크인 모달 (D — Daily 체크인) UX 명세

### 4.1 컨테이너

- 형태: 화면 하단에서 슬라이드업하는 **바텀시트** (max-width 430px 셸 내부)
- 배경: 반투명 backdrop + blur(2px)
- 애니메이션: 0.3s cubic-bezier(.2,.8,.2,1)
- 상단 `.sheet-grip` (44×5 px 회색 알약) — 모달임을 시각적으로 알림
- 외부 클릭 / grip 드래그(추후) 시 닫힘

### 4.2 페이지 입력 영역

```
┌─────────────────────────────────┐
│ [−1]   146p   [+1]  [+10mint]   │
└─────────────────────────────────┘
       직접 입력 [_146_]
         전체 300p
```

- `−1` / `+1` / `+10` 3D 버튼 (border-bottom 3px)
- `+10`은 민트 톤으로 강조 (시원한 점프)
- 큰 페이지 숫자: `Moneygraphy Pixel`, 22px, letter-spacing 1.5px
- 직접 입력: 70px 작은 input, 포커스 시 brand 보더
- min 0, max book.total 캡

### 4.3 한 문장 입력

- textarea 84px height, max 200자, 카운터 실시간
- placeholder: **"오늘 마음에 들어온 한 문장을 그대로 옮겨 적어보세요."**
- 라벨: "오늘의 한 문장 (선택)" — **선택임을 명시**

### 4.4 제출 가드레일

- 페이지 변화량(delta) = 0 AND 한 문장도 비어있으면 → 토스트 "한 쪽도 OK! +1만 눌러봐요 🐦" + 모달 유지
- delta < 0 (이전보다 적은 페이지)이면 → 토스트로 가벼운 경고만, 제출은 허용
- 그 외에는 즉시 모달 닫고 세리머니로

### 4.5 보상 계산식 (데모 기준)

```js
const pagesAdded = Math.max(0, delta);
const xpGain = Math.max(15, Math.min(60, 15 + pagesAdded));
state.streak += 1;
state.xp += xpGain;
state.nest.progress += 14; // 100 도달 시 진화
```

> 실제 Phase 1에서는 챕터 완독 보너스, 첫 문장 작성 보너스 등 추가 검토.

---

## 5. D-3 세리머니 명세

### 5.1 트리거

체크인 제출 → 모달 close → 세리머니 fixed overlay open.

### 5.2 구성요소 (위→아래)

```
┌─────────────────────────────┐
│       오늘도 짹! 🐦         │  ← 28px Bold Rounded, popIn
│  +18쪽 읽었어요. 13일 연속! │  ← 15px Rounded, brand 강조 숫자
├─────────────────────────────┤
│   ┌─────┬─────┬─────┐       │
│   │ ⭐  │ 🔥  │ 🔖  │       │  ← 3 reward cards, stagger pop
│   │+25  │ 13일│저장됨│       │     0.15 / 0.30 / 0.45s delay
│   │ XP  │STREAK│한문장│       │
│   └─────┴─────┴─────┘       │
├─────────────────────────────┤
│ [오늘의 한 문장]            │  ← 입력 시에만 표시
│ "꿈은 결국..."               │
├─────────────────────────────┤
│ 🏡 둥지가 진화했어요!       │  ← progress 100 도달 시에만
│   따뜻한 둥지 → 다정한 집  │
├─────────────────────────────┤
│ [   내일도 짹 →   ]         │  ← 메인 3D 버튼
└─────────────────────────────┘
```

### 5.3 Confetti 18조각

```js
function fireConfetti(n=18){
  const colors = ['#3FD17F','#FFC233','#FF8A3D','#5AB5F0',
                  '#F08A9A','#B690F0','#2EB867','#FFD66B'];
  for (let i=0; i<n; i++){
    // left: random %, color: random pick
    // duration: 1.6~3s, delay: 0~0.25s
    // size: 6~14 × 10~20 px, rotate during fall
  }
}
```

- 약 3.2초 후 DOM 정리
- z-index 110, pointer-events: none

### 5.4 닫기 후 메인 갱신

`내일도 짹 →` 클릭 시:
1. 세리머니 hide
2. The Path 노드 상태 전이 (§3.3)
3. 책 진도 / 스트릭 / XP / 둥지 카드 모두 reactive 갱신
4. 리그 리스트 재렌더 (자기 XP 변동 반영)

---

## 6. 마을(Village) 탭 인터랙션

### 6.1 친구 둥지 그리드

3열 grid, 카드 1개당:

```
┌──────────────┐
│ 🪱      ●(불)│  ← 좌상단 모이 / 우상단 lights
│              │
│      🏰      │  ← 친구 현재 둥지 단계
│   @book_bear │
│    🔥 64     │  ← Pixel 폰트
└──────────────┘
```

- `.on` 클래스: lights = 골드 글로우 (`box-shadow: 0 0 8px gold, 0 0 16px gold-2`)
- `.off`: lights = `--ink-4` (회색 점)
- streak 0 인 친구는 "쉼 중" 텍스트로 회색 표시

### 6.2 모이 보내기 (🪱)

- 카드 좌상단 🪱 클릭 → 토스트 "@닉에게 🪱 모이를 보냈어요!"
- 즉시 `.sent` 클래스 부여 → opacity 0.25, cursor: default
- 새로고침 전까진 다시 못 보냄 (데모 단순화. Phase 1: pokes 테이블 + KST 자정 리셋)

### 6.3 받은 모이 섹션

하단 별도 카드. 단일 메시지 예시:
- "@book_bear가 모이를 보냈어요"  
  "오늘도 짹 한번! 같이 읽자🐦"  *12분 전*

---

## 7. 소셜(Social) 탭

### 7.1 주간 리그 카드

- 그라디언트 배경 (`--brand-tint` → `--blue-soft`)
- 헤더: 🏆 뱃지 + "민트 리그 · 이번 주" + "월요일 리셋까지 4일"
- 본인 행은 `.me` 클래스: `background: brand-tint`, `border: brand`
- 1·2·3위 rank 컬러: `--gold-shadow` / `#8E939B` / `#B17142`
- NPC 표기: 닉네임 끝에 ` · NPC` suffix

### 7.2 한 문장 피드

- 카드 1개당: 아바타 + 닉 + 책 메타(`달러구트 꿈 백화점 · 156p`) + 인용구 + 리액션 칩 3종 (👏 🥹 🔖)
- 칩 클릭 → toggle active + 숫자 ±1 반영
- 인용구는 Rounded 폰트 + brand-soft 좌측 보더

---

## 8. 내서재(Library) 탭

- 책 1권 = 1행, 표지 38×52px + 제목 + 진도 메타
- 활성 책에 `.active` 클래스 + "읽는 중" 알약 (brand color)
- 행 클릭 → 활성 책 전환 + 토스트 "OO을(를) 활성 책으로 설정 🐦"
- 하단 "+ 새 책 추가하기" 점선 dashed 3D 버튼

---

## 9. 마이크로카피 §12 보강 (11개 확정)

| # | 위치 | 카피 |
|---|---|---|
| 1 | 메인 CTA | 오늘의 한 쪽, 짹 하기 |
| 2 | CTA 아래 nudge | 한 쪽이라도 읽으면 🔥 12일 연속 유지! 작은 호흡도 충분해요. |
| 3 | 모달 헤더 | 오늘의 짹 🐦 |
| 4 | 모달 서브 | 한 쪽도 충분해요. 어디까지 읽으셨어요? |
| 5 | 한 문장 placeholder | 오늘 마음에 들어온 한 문장을 그대로 옮겨 적어보세요. |
| 6 | 제출 helper | 한 쪽만 읽어도 출석은 인정됩니다. 끊기는 게 더 어려워요! |
| 7 | 가드레일 토스트 | 한 쪽도 OK! +1만 눌러봐요 🐦 |
| 8 | 둥지 카드 | 참새가 살림을 차렸어요! |
| 9 | 둥지 hint | 3일 더 읽으면 🏡 다정한 집으로! |
| 10 | 마을 헤더 | 오늘 불 켜진 친구에게 🪱 모이를 보내봐요. |
| 11 | 세리머니 다음 CTA | 내일도 짹 → |

---

## 10. 데이터 mock 구조 (Phase 0 localStorage 후보)

```js
const state = {
  user: { id: 'jerome', nick: 'jerome', avatar: '🐦' },

  book: {
    id: 1, title: "달러구트 꿈 백화점", author: "이미예",
    genre: "소설", cur: 126, total: 300,
    cover: "linear-gradient(135deg,#F4D9A8,#E8B473)"
  },

  // active_user_book_id 패턴 — books 배열 + active id
  books: [/* ... 4권 */],
  activeBookId: 1,

  streak: 12,
  xp: 340,

  nest: {
    lv: 3, name: "따뜻한 둥지", emoji: "🏠", progress: 62,
    nextEmoji: "🏡", nextName: "다정한 집"
  },

  // 7일치 The Path
  path: [
    { date: '5/7',  status: 'done',  pages: 14 },
    { date: '5/8',  status: 'done',  pages: 22 },
    /* ... */
    { date: '5/13', status: 'today', pages: 0  },
    { date: '5/14', status: 'ghost', pages: 0  },
  ],

  league: [
    { rank:1, name:"@book_bear · NPC",        avatar:"🐻", xp:920 },
    { rank:2, name:"@quiet_rabbit",           avatar:"🐰", xp:740 },
    { rank:3, name:"@curious_fox",            avatar:"🦊", xp:510 },
    { rank:4, name:"나 (jerome)",             avatar:"🐦", xp:340, me:true },
    { rank:5, name:"@activist_raccoon · NPC", avatar:"🦝", xp:280 },
  ],

  village: [
    { name:"book_bear", nest:"🏰", on:true,  streak:64, sent:false },
    /* ... 6명 */
  ],
};
```

---

## 11. 머지 시 v4.1 → v4.2 권장 액션

1. **§11 디자인 토큰** 섹션을 본 문서 §1 내용으로 **전면 교체**
2. **§5 둥지** 섹션에 **§2 5단계 명칭 표** 삽입
3. **§The Path** 시각 명세를 **§3** 내용으로 보강
4. **§D 체크인** 섹션에 **§4** 인터랙션 명세 흡수
5. **§D-3 세리머니** 섹션에 **§5** timing/구성 명세 흡수
6. **§마을** 섹션에 **§6** 인터랙션 룰 추가
7. **§12 빈 상태/마이크로카피** 표에 **§9** 11개 카피 머지 (중복 정리)
8. **§부록** 으로 **§10** mock 데이터 구조 추가 (Phase 0 reference)

---

## 12. 데모 동작 캡처 (참고)

- `둥지` 진입 화면 (default tab)
- `체크인` 모달 (페이지 +20 + 한 문장 입력)
- `D-3 세리머니` (Confetti + 보상 3카드 + 한 문장 미리보기)
- `마을` 탭 (친구 6명 그리드, 불빛 ON/OFF)
- `소셜` 탭 (민트 리그 본인 강조 + 한 문장 피드)

---

## 부록 A. 폰트 파일 배치

```
docs/readinggo/
├── index.html
├── data/
│   └── books.tsv
└── fonts/
    ├── Moneygraphy-Rounded.otf   (541 KB)
    └── Moneygraphy-Pixel.otf     (375 KB)
```

> 두 폰트 모두 한글 11,449 글리프 풀세트 포함 확인 (fontTools cmap 검증).
> 이모지는 시스템 폰트로 fallback (정상 동작).
