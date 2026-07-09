# Design System — ReadingGo

> 팀 디자인 source of truth. **모든 시각·UI 결정 전에 이 문서를 먼저 읽는다.**
> 폰트·컬러·간격·버튼 위계·미감 방향이 여기 정의돼 있으며, 사용자 승인 없이 벗어나지 않는다.
> 근거: `/design-consultation` 세션(2026-06-19), Issue #838.

---

## ReadingGo Feeling Guardrail

> **ReadingGo는 생산성 대시보드가 아니라, 다시 책으로 돌아오는 작은 둥지다.** 모든 시각·카피·인터랙션 결정은 이 감성을 먼저 통과한다. (상세는 아래 Product Context · Aesthetic Direction.)

| Always | Avoid |
|---|---|
| 하루 한 페이지면 충분하다는 **안도감** | Duolingo식 **압박·죄책감** |
| 한 문장을 남겼다는 **작은 성취** | SaaS **대시보드** 느낌 |
| 놓쳐도 다시 돌아올 수 있는 **부드러움** (나타남을 축하) | 과한 보상 **폭죽** · 숫자·랭킹 중심 화면 |

---

## UI 규칙 (always-on · 린트 강제)

> 아래는 **항상 적용**되는 코드 레벨 규칙이며, `tests/spec-align/design_lint.py` 가 `js/*.js`·`index.html` 을 스캔해 위반을 자동 탐지한다(이모지·raw hex·ghost·라운딩 = `exit 1`). 새 UI 코드는 예외 없이 지킨다. 상세 근거는 아래 'Color'·'Typography'·'Layout & 버튼 위계' 섹션.

- ❌ **기능 UI 이모지 금지** (📖 📚 📦 📸 📷 🔍 🔎 🔖 ✍️ ✏️ ⚙️ ✕ 🗑 🏠 ❤️ 등) → `RG_ICONS` + `rgIcon('name')` 모노라인 SVG(`icons.js`)로 통일. 단, **둥지 5단계(🌿🪹🪺🐣🏰)·컴패니언 동물(🦊🦝🐰🐹🐱)** 은 게임 시그니처라 허용.
- ⭐ **평점 별은 이모지(⭐) 대신 `★`/`☆` 글리프** — 색·크기를 CSS로 제어하고 플랫폼 렌더 편차를 없앤다.
- ❌ **raw hex 색값 금지** (`color:'#1a9e5a'`, `background:'#0B0D10'` 등) → `var(--token)`(`--brand`·`--ink`·`--line` 등 `:root` 토큰). `#fff`/`#000` 중립색과 OAuth 브랜드색(`#FEE500`/`#191919`)은 예외. 데이터 팔레트 파일(`data.js`·`datastore*.js`·`icons.js`)도 예외.
- **Border radius = 12 / 16 / 18 만** → `var(--r-sm)` / `var(--r-md)` / `var(--r-lg)`. 그 외 정수 라운딩 금지(pill `50`/`999` 는 예외).
- ❌ **ghost 버튼 금지** (투명 배경 `transparent`/`none` + `solid` 보더 조합) → 2차 액션은 반드시 **tonal**(`--brand-soft` 배경 + 진한 그린 글씨 `#196B45`). 버튼 위계는 'Layout & 버튼 위계' 참고.

---

## Product Context

- **무엇:** 독서 + 게이미피케이션(스트릭·XP·소셜)으로 매일 읽게 만드는 독서 습관 형성 앱
- **누구:** 책을 더 꾸준히 읽고 싶은 사람 (습관이 안 잡힌 독자)
- **카테고리:** 독서 트래커 × 습관 형성. 인접 제품 — StoryGraph·Literal.club(진중), Fable(활기), Finch(젠틀 습관)
- **타입:** 모바일-퍼스트 반응형 웹앱 (Phase 0/1 순수 웹)
- **코어 감정:** **고양감(uplift)** — 닦달이 아니라, 나타남(showing up)을 축하하는 따뜻함
- **memorable thing:** "성취를 닦달하지 않는데도, 매일 책을 펴게 만드는 따뜻한 서재"

## Aesthetic Direction

- **방향:** Warm Editorial × Gentle Gamification — "따뜻한 서재 + 부드러운 성취"
- **장식 수준:** intentional (종이 따뜻함 + 진중함 한 스푼, 토이 과잉은 후퇴)
- **무드:** 밝고 다정하되 시끄럽지 않게. 책상 위 따뜻한 독서 등불 같은.
- **의도적으로 피하는 인상:** "독서계 Duolingo" (놓치면 죄책감 주는 공격적 게이미피케이션). 비주얼 신호도 이 인상에서 멀어져야 함.
- **레퍼런스:** Finch(놓쳐도 부드러운 톤), StoryGraph·Literal.club(에디토리얼 진중함)

## Typography

- **Display / 히어로·큰 숫자:** `Moneygraphy Rounded` (로컬 `.otf`) — 따뜻한 브랜드 시그니처. 유지.
- **Body / 본문·UI:** `Noto Sans KR`
- **Quote / 책 발췌·"내가 남긴 흔적":** `Noto Serif KR` — 사용자가 옮긴 책 글귀에 적용. "진짜 책"의 에디토리얼 감을 주고 UI 텍스트와 시각적으로 구분.
  - **적용 범위 (design-shotgun 검증):** 세리프는 **따옴표로 감싼 흔적·발췌 문장에만** 적용한다. 헤딩·버튼·라벨·로고 등 UI 텍스트는 `Noto Sans KR` 유지. (본문 전체 세리프는 무거워서 폐기 — B안에서 확인)
- **Accent / 보상 모먼트:** `Moneygraphy Pixel` — 화면 전반이 아니라 **작은 보상 순간 액센트로만** (게임 신호 절제).
- **로딩:** Noto Sans/Serif KR = Google Fonts, Moneygraphy = self-hosted `fonts/`
- **강제 (#1109):** 위 4패밀리(Noto Sans/Serif KR · Moneygraphy Rounded/Pixel)가 **앱 폰트의 전부**다. `tests/spec-align/design_lint.py` 가 `index.html`·`js/*.js` 의 `font-family`/`fontFamily` 를 스캔해, 이 4종과 표준 폴백(`serif`·`sans-serif`·`monospace`·`system-ui`·`-apple-system`·`BlinkMacSystemFont`·`Georgia`·`Times New Roman`)·`var(--token)`·JS 변수 참조 **밖의 리터럴 폰트명**을 `exit 1` 로 막는다(폴백은 웹폰트 로드 전/실패 시의 점진적 저하라 허용). 새 웹폰트(Pretendard·Roboto 등) 도입은 화이트리스트(여기 + `design_lint.FONT_WHITELIST`)를 먼저 고쳐야 가능 — 화면마다 폰트가 새는 드리프트를 차단한다.

## Color

검증된 정체성(따뜻한 종이·부드러운 잉크)은 유지하고, **그린·게임 액센트만 진정**시킨다.

| 토큰 | 현재 (As-Built) | 리프레시 (목표) | 변경 이유 |
|------|-----------------|------------------|-----------|
| `--paper` | `#FAF6F0` | `#FAF6F0` | 유지 (따뜻한 종이) |
| `--ink` | `#2A2D33` | `#2A2D33` | 유지 (부드러운 다크그레이) |
| `--brand` | `#3FD17F` | **`#2EA86A`** | 쨍한 민트 → 차분한 세이지 |
| `--brand-2` | `#2EB867` | **`#228A57`** | 동반 조정 |
| `--brand-3` | `#1F8E4D` | **`#196B45`** | 동반 조정 |
| `--brand-soft` | `#DFF6EA` | **`#E4F2EA`** | tonal 버튼 배경용 |
| `--fire` | `#FF8A3D` | **`#E08A5E`** | 게임 액센트 채도↓ |
| `--gold` | `#FFC233` | **`#D9A52E`** | 보상 골드 채도↓ |

- **의미 색(success/warning/error)은 이번 범위 아님** — 후속 정의.

### 다크 모드 (Night Library — 별도 옵션, design-shotgun C안)

밤 독서용 별도 테마. 메인 아이덴티티가 아니라 토글 옵션으로 둔다.

| 토큰 | 다크 값 | 비고 |
|------|---------|------|
| `--paper` / `--paper-2` | `#17140F` / `#1F1B15` | 어두운 세피아 종이 |
| `--card` / `--card-soft` | `#22201B` / `#2A2722` | |
| `--ink` / `--ink-2` / `--ink-3` | `#ECE4D5` / `#B7AD99` / `#857C6A` | 따뜻한 오프화이트 |
| `--line` | `#332E25` | |
| `--brand` | `#5BBE86` | 1차 솔리드 버튼은 `#3FA873` |
| `--brand-soft` | `#1E2A22` | tonal 배경, 글씨 `#7FD3A2` |
| `--fire` (앰버) / `--gold` | `#E0A050` / `#E0B557` | |

- ⚠️ **로고 다크 대응 필요:** 현재 로고가 다크 배경에서 "Go"만 보임. 로고 SVG에 다크 variant 필요 (아이콘이 이미 SVG라 대응 가능, #785).

## Layout & 버튼 위계 (★ 핵심 규칙)

이번 리프레시의 가장 큰 레버. "온통 그린" 인상은 색조가 아니라 **그린 솔리드 버튼의 면적**에서 온다.

- **버튼 3단 위계** (액션이 밀집한 화면 — 홈/기록 등에 적용):
  - **1차 (Primary):** 그린 솔리드 채움 (`--brand`). 화면당 **원칙적으로 1개**. "여길 눌러".
  - **2차 (Secondary, tonal):** 연한 그린 배경(`--brand-soft` `#E4F2EA`) + 진한 그린 글씨(`#196B45`) + 옅은 보더. 버튼 어포던스는 유지하되 쨍하지 않게.
  - **3차 (Tertiary):** 텍스트·아이콘만 (배경 없음). 공유·수정·삭제 등.
  - ⚠️ **ghost(투명 + 보더)는 금지** — 시인성·"어디 눌러야 할지" 저하로 폐기. 2차는 반드시 tonal.
- **예외:** 진행바·퍼센트 뱃지 등 **데이터 시각화는 그린 유지** (액션이 아님).
- **화면별 적용:** 탐색(검색)·선택(바텀시트) 화면은 이미 차분 → **토큰 진정만 적용, 위계 규칙 불필요**. 위계 규칙은 액션 밀집 화면 한정.
- **Border radius:** `--r-sm:12px` `--r-md:16px` `--r-lg:18px` (현재 `--r-xl:28px` → 18px 중심으로 정제, 덜 토이)
- **Max content width:** 모바일 프레임 ~420px 중심, 데스크탑은 중앙 정렬 셸

## Spacing

- **Base unit:** 8px (유지)
- **Density:** comfortable
- **Scale:** xs(4) sm(8) md(16) lg(24) xl(32)

## Motion

- **방향:** intentional — 의미 있는 전환만. 보상 모먼트에 절제된 마이크로 애니메이션.
- **Duration:** micro(50–100ms) / short(150–250ms) / medium(250–400ms)
- **Easing:** enter(ease-out) / exit(ease-in) / move(ease-in-out)

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-19 | DESIGN.md 신설 + 인접 리프레시 방향 확정 | `/design-consultation`, Issue #838. 라이브 실측 기반 |
| 2026-06-19 | 그린 톤 진정(`#3FD17F→#2EA86A`) | Duolingo 인상 탈피, 고양감과 정합 |
| 2026-06-19 | **3단 버튼 위계(1차 솔리드/2차 tonal/3차 텍스트)** | "그린 면적"이 인상의 핵심 레버. ghost는 시인성 저하로 폐기 |
| 2026-06-19 | 흔적 문장 `Noto Serif KR` | 책 글귀의 에디토리얼 감, UI와 구분 |
| 2026-06-19 | 게임 액센트 채도↓, 라운딩 28→18px | 토이 과잉 후퇴, 더 성숙·세련 |
| 2026-06-19 | 세리프 적용 범위 = 따옴표 흔적·발췌 문장만 | `/design-shotgun` 4안 비교. 본문 전체 세리프(B)는 무거워 폐기 |
| 2026-06-19 | 다크 모드(Night Library) 토큰셋 옵션 정의 | `/design-shotgun` C안. 메인 아님, 토글 옵션 |
| 2026-06-19 | Quiet Mono(그린 제거) 방향 폐기 | `/design-shotgun` D안. 그린 정체성·고양감 손실이 큼 |
| 2026-06-26 | **코드 반영 완료(#1032)** — 세이지 토큰·라운딩 18·Noto Sans 본문·Noto Serif 흔적·버튼 위계(ghost→tonal/텍스트) | 위 2026-06-19 리프레시의 구현. `index.html`(:root·폰트) + 액션 밀집 화면(홈/책상세/동의/컴패니언) ghost 버튼 제거 |
| 2026-06-28 | **앱 아이콘·참새 마크 리디자인** — 고개 든 통통 세이지 참새(짧은 부리·작은 깃) + 골드 스파크, 따뜻한 종이 배지. 구 flux 3D새/옛 민트 마크 전면 교체 | flux 마스코트는 토이 과잉(DESIGN이 피하라는 인상)·작은 데서 뭉개짐. 손코딩 벡터로 고대비·온브랜드(세이지 `#2EA86A`)·전 사이즈 가독. `assets/icon.png`·`sparrow.svg`·`SparrowMark`·부트로더·공유카드 공통 적용. 인앱 마크는 spark 없는 본체(아바타용), 앱아이콘/favicon은 배지+스파크 |
| 2026-06-28 | **UI 규칙 always-on 린트(#1062)** — `design_lint.py` 신설(이모지·raw hex·ghost·라운딩 탐지, 위반 시 `exit 1`) + `RG_ICONS` 에 `search`·`home`·`camera`·`trash`·`box` 모노라인 추가 | DESIGN.md 를 코드에서 게이트로 강제. 기능 이모지→SVG 아이콘, 색→토큰, ghost→tonal 드리프트를 CI 가 차단 |

---

## 구현 메모 (코드 PR 시)

- 토큰은 `index.html` `:root`에 정의돼 있고 피처 코드가 `--brand` 등을 참조하므로 **토큰 값 교체만으로 그린 톤 진정은 대부분 자동 반영**된다.
- **버튼 위계**는 토큰 교체로 안 됨 — 2차 버튼 클래스(tonal) 신설 + 화면별 1차/2차/3차 지정 필요 (별도 코드 PR).
- 검증 방식: 라이브 화면에 CSS 변수·스타일을 런타임 주입해 before/after 스크린샷 비교 (재현 대신 실측).
