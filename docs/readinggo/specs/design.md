# 디자인 토큰 + 빈 상태 / 마이크로카피

> **Split from** `docs/2. specifications/_archive/readinggo-spec.md` v6 (2026-05-28 분할). 원 위치: §11, §12. 변경 이력은 git log 참조.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../1.%20research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.
> **린트 강제 (#1062)**: DESIGN.md UI 규칙(기능 이모지→RG_ICONS·raw hex→토큰·라운딩 12/16/18·ghost 금지)을 `tests/spec-align/design_lint.py`가 코드에서 자동 검사한다(admin·test·데이터 파일 면제). #696 이모지→SVG 부채를 전면 스윕(book-detail·library·user-profile 등 88건 교체)하고 누락 RG_ICONS(검색·홈·카메라·삭제·박스)를 추가했다.
> **CI 게이트 등록 (#1062, 2026-06-28)**: `design_lint.py`를 `.github/workflows/test.yml` 잡으로 등록 — emoji+hex+ghost 위반 1건 이상이면 PR 차단(라운딩은 warning, 비차단). 잔여 기능 이모지를 스윕(로그인 메일 안내 📬→`rgIcon('mail')`, 룸 초대 링크 🔗→`rgIcon('share')`, 둥지 토스트 📖 제거 등)해 **위반 0건** 달성. 이후 기능 이모지를 새로 넣으면 게이트가 막는다(드리프트 방지). 라운딩 warning(다회)은 후속 토큰 정리 대상.
> **라운딩 정합 + blocking 승격 (#1130, 2026-07-03)**: 잔여 비표준 `borderRadius` 113건을 역할 기준으로 전량 정합화 — 칩·입력·카드·버튼은 `12`, 원형/알약 의도(토글 스위치·마이크로 배지·프로그레스 트랙·크롭 핸들·히트맵 도트 등 13건)는 pill `999`, OCR 크롭 선택영역 마퀴 1건은 라운딩 제거(직각이 크롭 영역을 정확히 표현). `design_lint.py` 라운딩을 warning → **blocking(exit 1)** 승격해 이후 비표준 라운딩은 CI가 차단한다.
> **v18 목표 결정 (2026-08-25, #1389·#1515)**: 서재는 빠른 좌우 flick에서도 스쳐 지나가는 표지가 준비되어야 하며, 상태를 색만으로 구분하지 않고 제스처 외 조작과 `prefers-reduced-motion`을 제공한다. preload/window 수치와 최종 모션은 성능·접근성 검증 전 확정하지 않는다. 캐릭터 계약은 [mascot.md](./mascot.md)를 따른다.

## 10. 서재 시각·상호작용 계약 (v18)

- 중앙 책과 이동 중 인접 책의 표지·메타데이터가 자연스럽게 이어져야 한다. cache miss는 안정된 비율의 placeholder로 처리하고 decode 전 깨진 이미지를 노출하지 않는다.
- 현재 위치 주변만 렌더·preload하는 bounded window를 사용하며 대량 서재에서 모든 표지를 한꺼번에 DOM·메모리에 적재하지 않는다.
- 빠른 연속 입력이 들어와도 입력 순서·현재 index가 어긋나지 않고 세로 스크롤·Android system back과 충돌하지 않아야 한다.
- 이전/다음 44px 컨트롤, 키보드, 스크린리더 이름, 정확한 검색·목록 경로를 제공한다. 색·모션·제스처만으로 상태나 선택을 전달하지 않는다.
- `prefers-reduced-motion`에서는 관성·과도한 이동을 줄이고 즉시 또는 짧은 교차 페이드로 같은 상태를 이해시킨다.
- 최종 carousel 기술, preload window, 메모리 상한, 정렬 기본값은 web·Android WebView 측정과 비교 시안 뒤 승인한다.

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

> 아래 선택자 중 스트릭·XP·The Path·보상·리그·마을 항목은 현행 레거시 as-built다. v17 활성 사용처는 책 진도·페이지 입력·서재 메타·시간처럼 정보 밀도가 필요한 숫자이며, 레거시 선택자를 신규 기능 규범으로 재사용하지 않는다.

```css
/* 레거시 선택자를 포함한 현행 구현 목록 */
.stat-num, .path .node, .book-progress-num, .page-num, .reward-card .val,
.league-rank, .league-xp, .friend-streaknum, .shelf-prog, .sentence-meta {
  font-family: 'Moneygraphy Pixel', 'Moneygraphy Rounded', monospace;
}
```

파일 위치: `docs/readinggo/fonts/Moneygraphy-Rounded.otf`, `Moneygraphy-Pixel.otf` (한글 11,449 글리프 풀세트).

### 11.2 컬러 팔레트

**활성 의미체계**: 브랜드 민트와 접근 가능한 중립 토큰을 우선한다. 아래 불꽃 오렌지·골드 토큰은 현행 스트릭·XP 표면의 레거시 as-built이며 신규 레거시 의미나 보상 규범으로 확정하지 않는다.

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
  --star-empty:   #C7CCD3;   /* 빈 별점(☆) 전용 회색 — 크림(--paper)에 또렷이. 디바이더 --line-2 오용 금지(#984) */

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

> **바텀시트 끌어 닫기 (#1046, 2026-06-28)**: 모든 `.sheet`(설정·체크인 등)는 **grip 또는 시트 상단 120px 밴드(grip+헤더 타이틀 줄, #1146 — 구 44px는 헤더가 존 밖이라 체감 미구현)를 아래로 끌면 닫힌다**(글로벌 포인터 위임 `js/sheet-drag.js`). 임계: 이동 ≥120px 또는 플릭(≥0.6px/ms & 24px 초과). 끄는 동안 `.sheet.dragging`으로 transition 제거(즉시 추종), 손 떼면 스냅백 또는 슬라이드아웃(`translateY(100%)` 180ms 후 닫힘). 닫기는 backdrop 클릭(React `onClose`)에 위임하고, 없으면 `aria-label`/`title="닫기"` 버튼 폴백. grip은 `cursor:grab; touch-action:none`이며, **히트영역을 시트 상단 풀폭 밴드(높이 20px)로 확대**(시각 핸들은 `::before` 44×5px)해 정밀 조준 없이 맨 위 어디를 잡아도 닫히게 한다(#1069 — 구 44×5px grip 은 터치로 정밀 조준 못 하면 `.sheet`(`touch-action:auto`+`overflow-y:auto`)가 끌기 제스처를 스크롤로 흡수해 안 닫혔다). 시트 내부 스크롤 위치가 최상단일 때만 제스처 시작(스크롤과 충돌 방지), 인터랙티브 요소(버튼·입력) 위는 제외. **드래그 활성 중 전역 `touchmove` non-passive `preventDefault` 가드(#1146)** — 확장 존(헤더)은 touch-action 미지정이라 브라우저 세로 팬이 `pointercancel`로 드래그를 죽이던 것을 차단.

참새 마스코트: 현행 온보딩·소개 화면·라벨은 **SparrowMark SVG**(`<window.SparrowMark>` / 인라인용 `<window.SparrowInline>`, `sparrow-bounce` 애니메이션)로 표현한다. (#785/#823/#824 — 🐦 이모지를 브랜드 SVG 마크로 통일.) v17에서도 진화 없는 2D 참새 방향은 유지하지만 최종 표시명·배치·모션은 미확정이다. `NEST_STAGES` 이모지(🪵🪹🏠🏡🏰)는 레거시 둥지 구현 설명일 뿐 활성 레거시 규범이 아니다.

### 11.5 반응형 내비게이션 (v8.1, #466)

- 하단 탭바는 **플로팅 "필(Pill)" 스타일**을 적용한다.
- **레이아웃**: `bottom: calc(12px + env(safe-area-inset-bottom))`, `left: 12px`, `right: 12px`.
- **디자인**: `border-radius: 999px`, `box-shadow: 0 6px 20px rgba(0,0,0,.12)`. 기존 `border-top`과 `backdrop-filter: blur`는 제거하고 깔끔한 부유감을 준다.
- **그리드**: [README.md §0.5](./README.md#05-용어-사전-v17--정본)에 정의된 **현재 노출 탭 수만큼 전체 너비를 균등 분할**한다. 탭이 3개면 3열이며, 빈 탭처럼 보이는 여백을 만들지 않는다.
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
| 성격 포인트 (감정·마스코트) | 참새는 SparrowMark SVG, 그 외 이모지는 승인된 비기능 강조에 한정 | 참새 마크(SparrowMark), 빈 상태의 절제된 감정 표현 |

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

## 12. 레거시 빈 상태 / 마이크로카피 — do not ship

> ⚠️ **v17 비활성 이력:** 아래 표는 v5~v16 카피와 현행 코드 드리프트를 보존한 참고 자료다. 스트릭·XP·둥지 진화·마을·짹·단절 경고 문구는 폐기됐으며 신규 UI·스토어·알림에 복사하지 않는다. v17 정확한 카피는 별도 카피 검토와 승인 전까지 미확정이다.

| # | 위치 | 카피 |
|---|---|---|
| 1 | 메인 CTA | "오늘의 한 쪽, 짹 하기" |
| 2 | CTA 아래 nudge | "한 쪽이라도 읽으면 🔥 N일 연속 유지! 작은 호흡도 충분해요." |
| 3 | 체크인 모달 헤더 | "오늘의 짹" |
| 4 | 체크인 모달 서브 | "한 쪽도 충분해요. 어디까지 읽으셨어요?" |
| 5 | 문장 입력 placeholder | "책에서 마음에 남은 한 문장을 옮겨 적어보세요." |
| 6 | 문장 입력 helper | "한 쪽만 읽어도 출석은 인정됩니다. 끊기는 게 더 어려워요!" |
| 7 | 가드레일 토스트 | "한 쪽도 OK! +1만 눌러봐요" |
| 8 | 둥지 카드 진화 | "참새가 살림을 차렸어요!" |
| 9 | 둥지 hint | "3일 더 읽으면 🏡 다정한 집으로!" |
| 10 | 마을 헤더 | "오늘 불 켜진 친구에게 🪱 모이를 보내봐요." |
| 11 | 세리머니 CTA | "내일도 짹 →" |
| — | 마을 게시판 빈 상태 | "첫 글을 남겨보세요 ✍️" |
| — | 소셜 피드 빈 상태 | "아직 모이가 없어요. 오늘의 모이를 남겨보세요" |
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

> **레거시 명칭 이력:** `재키/Jacky`와 액션 동사 `짹`은 v5~v16 구현·카피의 호환 문자열이다. v17 캐릭터명 결정은 팀 논의까지 보류하며 그동안 `재키/Jacky` 표시를 유지한다. `짹`을 신규 제품 카피로 보존한다는 과거 결정은 대체됐고 새 액션 동사는 별도 승인 전까지 확정하지 않는다.

---
