# 디자인 토큰 + 빈 상태 / 마이크로카피

> **Split from** `docs/2. specifications/_archive/readinggo-spec.md` v6 (2026-05-28 분할). 원 위치: §11, §12. 변경 이력은 git log 참조.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.

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

**통일 원칙 (v7.4, #323)**: 인라인 스타일에서 폰트를 **하드코딩하지 않는다** — 본문은 `font-family` 미지정(= body 상속) 또는 `'inherit'`, 숫자/코드만 `'Moneygraphy Pixel', monospace`. `'Nunito'`·생짜 `'monospace'` 등 비브랜드 폰트 금지. (onboarding.js·town.js 잔재 정리 완료)

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

참새 마스코트: 온보딩·소개 화면은 **🐦 이모지**(`sparrow-bounce` 애니메이션)로 표현한다. (#527 — 코드에 머지된 적 없는 `Sparrow` SVG 컴포넌트 참조를 제거하고 ScreenJacky(#502)와 통일. SVG 자산 재도입은 별도 디자인 결정.) 둥지 단계 시각화는 NEST_STAGES 이모지(🪵🪹🏠🏡🏰) 사용.

### 11.5 반응형 내비게이션 (v8.1, #466)

- 하단 탭바는 **플로팅 "필(Pill)" 스타일**을 적용한다.
- **레이아웃**: `bottom: calc(12px + env(safe-area-inset-bottom))`, `left: 12px`, `right: 12px`.
- **디자인**: `border-radius: 999px`, `box-shadow: 0 6px 20px rgba(0,0,0,.12)`. 기존 `border-top`과 `backdrop-filter: blur`는 제거하고 깔끔한 부유감을 준다.
- **그리드**: [README.md §0.5](./README.md#05-용어-사전-v7--정본)에 정의된 **현재 노출 탭 수만큼 전체 너비를 균등 분할**한다. 탭이 3개면 3열이며, 빈 탭처럼 보이는 여백을 만들지 않는다.
- 활성 표시와 터치 영역은 각 탭의 균등 분할 영역 전체를 기준으로 유지한다.

### 11.6 데스크톱 프레이밍 (#615)

모바일 우선 컬럼(`.app`, `max-width: 430px`)을 넓은 화면에서 '빈 여백에 떠 있는 좁은 띠'가 아니라 **의도된 무대 위의 중앙 카드**로 보이게 한다.

- **중앙 카드 (구현 완료)**: 데스크톱(`@media (min-width: 800px)`)에서 `.app`은 `border-radius: 36px` + 부드러운 그림자 + 1px 테두리, `height: min(920px, 100vh − 64px)`로 카드화한다.
- **배경 연출 (#615)**: 카드 양옆 여백이 의도된 배경이 되도록 `.stage`에 **브랜드 톤 레이어드 그라데이션**을 깐다 — 크림 베이스(`--paper-2`, 카드의 `--paper`보다 살짝 진해 카드가 떠 보임) + 상단 그린 글로우 + 코너 골드/그린 글로우. **은은한 radial 페이드만** 쓰고 하드 블롭·플로팅 도형·웨이브 디바이더는 금지(AI 슬롭 회피).
- **모바일(<800px)은 변경 없음** — 풀블리드 단일 컬럼 유지.

### 11.7 터치 타깃 / 히트영역 (v8.4, #613)

모바일 우선 앱 — **모든 인터랙티브 요소의 히트영역 ≥ 44×44px**(Apple HIG / WCAG 2.5.5 권장). 시각 크기는 그대로 두고 **히트영역만 분리 확장**한다(투명 패딩 / `min-width`·`min-height` / `::before` 확장).

| 요소 | 실측(390×844) | 조치 |
|---|---|---|
| 삭제 아이콘 (파괴적) | 9×13 | **최우선** — 투명 히트영역 44×44, 시각 아이콘 유지 |
| 좋아요(❤️) 아이콘 | 19×14 | `::before` 확장 44×44 |
| 페이지 스테퍼 −/+ | 38×38 | `min-width/height: 44px` |
| 캐러셀 화살표 | 32×32 | 패딩으로 44×44 |
| 설정 기어 / 검색 | 32×26 / 43×36 | 패딩으로 44×44 |

- 구현 패턴(권장): `position: relative` + `::before { content:''; position:absolute; inset:-Npx; }` 로 시각 변형 없이 탭 영역만 확장.
- 인접 타깃 간 **간격 ≥ 8px**(오탭 방지, 특히 파괴적 액션).
- CSS 한정·저위험. 점검: 디자인 리뷰 시 DevTools 히트영역 측정.

### 11.8 구조 라벨 아이콘 — SVG vs 이모지 역할 분리 (v8.4, #617)

**원칙**: **구조적·반복 라벨**(섹션 헤더·내비·기능 버튼)은 **일관된 인라인 SVG 아이콘셋**으로, **이모지는 성격 포인트**(감정·마스코트·일회성 강조)로 한정한다. 주 아이콘이 전부 이모지면 템플릿 인상 + OS별 렌더 편차가 생긴다.

| 구분 | 표현 | 예 |
|---|---|---|
| 구조 라벨 (헤더·내비·기능) | **인라인 SVG** (`currentColor`, 20–24px) | 오늘의 독서 / 한 문장 남기기 / 이 책 / 인기 책 섹션 헤더 |
| 성격 포인트 (감정·마스코트) | 이모지 유지 | 🐦 참새, 🔥 스트릭 수치, 세리머니 강조 |

- 적용 범위: 섹션 헤더 이모지(🔥/📚 등) → SVG. **홈탭/탭바는 #625에서 완료**(선례).
- **점진 적용**: 한 번에 전면 교체하지 않고 표면별 코드 PR로. 아이콘셋은 단일 출처(공용 `Icon` 컴포넌트 / `components.js`)로 관리해 드리프트 방지.
- 컬러: `--ink-2`/`--ink-3` 기본, 활성·브랜드 맥락은 `--brand`.
- **#694 적용**: 홈 한 문장 입력 OCR 진입(`···` 드롭다운 단일항목 → 입력 툴바 **SVG 카메라 버튼**, 틴트·로딩 시 비활성), 책 상세 완독/중단(`🏰`/`⏸️` → **SVG 체크/일시정지**). 보조 액션이 2개이고 내용이 적으면 **좌우 한 줄 2버튼**(`flex:1`)으로 배치해 세로 적층을 줄인다.

### 11.9 로딩 스켈레톤 (v8.4, #618)

'불러오는 중…' 맨 텍스트 대신 **실제 콘텐츠 레이아웃에 맞는 스켈레톤 + 은은한 shimmer**로 체감 지연을 줄인다.

| 대상 | 스켈레톤 형태 |
|---|---|
| 한 문장 피드 | 문장 카드 골격(아바타 원 + 2줄 텍스트 바 + 메타 바) ×3 |
| 인기 책 랭킹 | 순위 행(표지 사각 + 제목 바) ×5 |
| 책장/검색 | 표지 그리드 플레이스홀더 |

- 공용 컴포넌트 신설(`components.js` `Skeleton`): `Skeleton.Card` / `Skeleton.Row` / `Skeleton.Cover`.
- shimmer: `--line`↔`--paper-2` 사이 1.2s linear infinite 그라디언트 스윕. `prefers-reduced-motion` 시 정적 톤.
- 적용 우선순위: 피드(`social.js`) → 인기 책 → 책장. 텍스트 폴백은 스켈레톤 미적용 영역에만 잔존.

---

## 12. 빈 상태 / 마이크로카피

| # | 위치 | 카피 |
|---|---|---|
| 1 | 메인 CTA | "오늘의 한 쪽, 짹 하기" |
| 2 | CTA 아래 nudge | "한 쪽이라도 읽으면 🔥 N일 연속 유지! 작은 호흡도 충분해요." |
| 3 | 체크인 모달 헤더 | "오늘의 짹 🐦" |
| 4 | 체크인 모달 서브 | "한 쪽도 충분해요. 어디까지 읽으셨어요?" |
| 5 | 문장 입력 placeholder | "책에서 마음에 남은 한 문장을 옮겨 적어보세요." |
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
| — | 관심 책(책찜) 추가 토스트 | "관심 책에 담았어요 🔖" (#641: 책찜 아이콘 ❤️/📚 → 🔖 통일) |
| — | ~~책갈피 저장 토스트~~ (#641 폐기) | 책갈피→좋아요 단일화로 제거. 좋아요는 토스트 없이 ❤️ 토글 |
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

