# 리팩토링 — monolith 분할 (모듈화)

> **신설 (#761, 2026-06-17)**: `components.js`(1626줄) 등 monolith를 기능별 파일로 분할. 목적은 **병렬 작업 충돌 영구 감소** + 인브라우저 Babel 파싱 에러 **blast radius 축소**(#687류). 개발 중지·pre-beta(저트래픽) 시점에 수행.
> **1차 완료 (2026-06-17)**: components.js 5개 모듈 추출 종료(#763·#764·#765·#766·#767). 1626→718줄. prod 작동확인 완료. 2차(components.js 잔여)·nest/library 분할은 **보류**(§3.1) — 충돌 실발생 시 착수.
> **편집 정책**: 분할 계획 변경은 이 파일 PR로. spec-only 준수. 추출 코드는 후속 PR 시리즈.

## 1. 목적·범위

- **왜**: 1000줄+ 파일을 모두가 건드려 worktree로 격리해도 머지 충돌. 모듈 경계 = 병렬 작업 경계로 맞추면 미래 PR이 서로 다른 파일을 만져 충돌이 구조적으로 사라진다.
- **이 repo의 이점**: 크로스파일 공유가 `window.X` 글로벌이라 **import 그래프가 없다** → 추출 = "코드 이동 + `<script>` 추가 + `window.X` shim 유지"뿐. 소비자 코드 0 변경.
- **범위**: hot monolith만(`components.js`·`nest.js`·`library.js`). `social.js`(224)·`onboarding.js`(402)는 제외.
- **비목표**: 로직 변경(절대 같은 PR에 섞지 않음 — 별 PR), 빌드도구·번들러 도입(Stack Lock), import/export 전환.

## 2. 추출 원칙

1. **Strangler**: 한 번에 컴포넌트 1개씩. 빅뱅 금지.
2. **Behavior-preserving**: 순수 이동만. diff = "원본에서 블록 삭제 + 새 파일". 로직 변경 0.
3. **shim 유지**: 새 파일 끝에 `window.X = X` (기존 패턴). 소비자는 `window.X`/bare `X` 그대로 호출 → ripple 0.
4. **leaf → hot**: 가장 안 바뀌는·자립적인 것부터(충돌·위험 최소, 모멘텀↑).
5. **tiny PR + merge train**: 추출은 다 같은 원본을 삭제하니 서로 충돌 → **직렬 머지**(순서 합의/스택). 추출 끝난 모듈은 즉시 병렬 개방.
6. **응집도 경계**: 줄 수가 아니라 "같이 바뀌는 것"으로 묶는다.

## 3. 모듈 맵 (1차 — components.js) — ✅ 완료 (2026-06-17)

index.html 로드 순서: 의존 글로벌이 사용보다 **먼저**. 아래는 추출 순서(leaf→hot)이자 권장 로드 순서.

| 순서 | 새 파일 | 옮긴 것 | PR | 상태 |
|---|---|---|---|---|
| 1 (파일럿) | `icons.js` | `RG_ICONS`·`rgIcon`·`_RG_SEC_ICONS`·`SectionLabel`·`RG_SECTION_CARD`·`NEST_ART`·`nestArt` | #763 | ✅ |
| 2 | `admin-dashboard.js` | `AdminDashboardModal` | #764 | ✅ |
| 3 | `sentence-card.js` | `SentenceCard`·`SentenceActions` | #766 | ✅ |
| 4 | `settings-modal.js` | `SettingsModal` | #765 | ✅ |
| 5 | `book-info-modal.js` | `BookInfoModal` | #767 | ✅ |

- **결과**: `components.js` 1626→718줄(≈56% 감소). 모든 추출 PR은 boot-smoke(vendor Babel 변환)·align_v7·nest.py 통과 후 머지, prod `_RG_V '82'` 반영·작동확인 완료.
- **`decodeEntities` 잔류 결정(#767)**: 맵은 book-info-modal.js 동반 이동을 적었으나, `sentence-card.js`(components 직후 로드)가 **로드 시점**에 `window.decodeEntities`를 alias하므로 components.js에 잔류(util host). 로드 순서 제약이 맵보다 우선.
- 공통 유틸(`rgTrack`·`decodeEntities` 등)은 사용처 따라 적절한 파일로(중복 정의 금지). `library.js`는 자체 `decodeEntities` 복사본 보유(기존 중복, 후속 정리 대상).

## 3.1 2차 후보 (components.js 잔여 — 평가만, 착수 보류)

1차 후 `components.js` 718줄에 남은 컴포넌트(9개). **현재 충돌 빈도·blast radius가 낮아 2차는 보류**, 아래는 착수 시 권장 경계.

| 컴포넌트 | 줄수(약) | 2차 후보 파일 | 메모 |
|---|---|---|---|
| `UserProfileModal` | ~218 | `user-profile-modal.js` | 잔여 최대. 자립적, 2차 1순위 |
| `SentenceCollectionModal` | ~113 | `sentence-collection-modal.js` | sentence-card(`SentenceActions`) 의존 |
| `TinderCards` | ~90 | `tinder-cards.js` | 자립 |
| `ActivityHeatmap` | ~65 | (잔류 후보) | 작음 |
| `ConsentBanner` | ~74 | (잔류/동의 모듈) | 프라이버시/동의 코드(C)와 함께 다룰 수 있음 |
| `StreakCalendarModal` | ~48 | (잔류 후보) | 작음 |
| `Toast`·`BookCover`·`Confetti` | ~70 합 | (잔류 — core) | 공유 프리미티브. `components.js`를 thin core로 유지 |

- 공유 컨텍스트·유틸(`SpoilerContext`·`isSentenceBlinded`·`showToast`·`rgTrack`·`decodeEntities`)은 `components.js`에 **core 호스트로 잔류**(다수 파일이 window alias로 소비).
- **판단**: 2차는 줄 수가 아니라 "충돌이 실제로 발생할 때" 착수(YAGNI). 큰 컴포넌트(UserProfileModal)만 선제 분리 가치.

- `nest.js`·`library.js`는 1차 완료 후 별도 spec 갱신으로 진행 → **§3.2**.

## 3.2 3차 — nest.js·library.js 분할 맵 (#761, 2026-06-17)

1차(components.js)와 독립한 **더 큰 hot monolith** 두 개. 같은 strangler 원칙(§2): 한 번에 1개, 순수 이동, `window.X` shim, leaf→hot, tiny PR 직렬 머지. 각 파일 내부는 같은 원본을 삭제하니 **파일별로 직렬**, 두 파일은 서로 독립이라 병렬 가능.

### nest.js (1406줄) → core(NestView) 잔류 + 추출

| 순서 | 새 파일 | 옮길 것 | 의존(window alias) | 비고 |
|---|---|---|---|---|
| 1 | `companion.js` | `CompanionModal`·`parseNoteToExchanges`·`pickCompanionQ`·`archiveCompanion` | datastore·LLM 프록시 | AI 대화 — 응집·자립, 가장 독립적(~250줄) |
| 2 | `ocr-crop-overlay.js` | `OcrCropOverlay` | — | OCR 크롭, 자립(~82줄) |
| 3 | `checkin-modal.js` | `CheckinModal` | — | 체크인(짹) 모달(~94줄) |
| 4 | `ceremony.js` | `Ceremony`·`stageMicrocopy` | Confetti·icons | 완독 세리머니(~200줄) |
| 5 | `nest-theatre.js` | `NestTheatre`·`nestVisualState` | NEST_ART/nestArt(icons) | 둥지 비주얼(~140줄) |
| 잔류 | `nest.js` | `NestView`(core 홈) | 위 추출분을 window로 소비 | hot view, 최후 잔류 |

### library.js (1163줄) → core(LibraryView) 잔류 + 추출

| 순서 | 새 파일 | 옮길 것 | 의존(window alias) | 비고 |
|---|---|---|---|---|
| 1 | `book-detail-modal.js` | `BookDetailModal` | `decodeEntities`·`SentenceActions`·`RG_SECTION_CARD` 등 | **최대 컴포넌트(~587줄)** — 단일 추출 고가치 |
| 2 | `follow-list-modal.js` | `FollowListModal` | datastore | 팔로우 목록, 자립(~53줄) |
| 잔류 | `library.js` | `LibraryView`(core 서재) | — | hot view, 최후 잔류 |

- **`decodeEntities` 중복 해소**: `library.js` 자체 복사본(§37)은 `BookDetailModal`이 주 소비자. 추출 시 `book-detail-modal.js`가 `window.decodeEntities`(components.js)를 alias → library.js 잔여(LibraryView)가 미사용이면 로컬 복사본 제거(중복 정의 금지). LibraryView가 여전히 쓰면 잔류.
- **로드 순서**: 추출 파일은 의존(icons·components·sentence-card)이 먼저 로드된 뒤, `nest.js`/`library.js`(core) **이전**에 로드(core가 window로 소비). 1차와 동일 패턴.
- **착수 판단**: nest/library는 실제 편집 빈도·충돌이 잦은 hot 파일이라 components.js 2차(§3.1, 보류)와 달리 **선제 분할 가치 있음**. 단 큰 컴포넌트(CompanionModal·BookDetailModal) 우선, 작은 잔류 후보는 충돌 시.

## 4. prod-안전 배포 플로우 (필수)

main 머지 = Cloudflare Workers Build 자동배포(prod 직행)라 검증 완충이 없다 → 추출 PR마다:

1. **프리뷰 검증**: 브랜치에서 `wrangler versions upload`(비프로모션 — prod 미영향) → 프리뷰 URL에서 **부팅·전 스크립트 로드·해당 컴포넌트 렌더** 확인.
2. **CI 게이트**: `boot-smoke`(부팅 Babel 회귀) + spec-align 통과.
3. **머지** → Workers Build 자동배포 → `deploy-verify`(#693, `_RG_V` 대조)로 반영 감지.
4. **롤백**: 깨지면 `wrangler rollback`(또는 PR revert + 재배포). tiny PR이라 비용 최소.
5. **`_RG_V` bump**: 파일 추가/변경마다 캐시버스트 상향(스큐·#687 방지).

## 5. 검증 체크리스트 (추출 PR마다)

- [ ] 순수 이동(로직 diff 0), `window.X` shim 유지
- [ ] index.html `<script>` 추가 + 로드 순서(의존 먼저), `_RG_V` bump
- [ ] 프리뷰(`wrangler versions upload`)에서 부팅·렌더 확인
- [ ] boot-smoke·spec-align 통과
