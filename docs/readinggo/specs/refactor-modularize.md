# 리팩토링 — monolith 분할 (모듈화)

> **신설 (#761, 2026-06-17)**: `components.js`(1626줄) 등 monolith를 기능별 파일로 분할. 목적은 **병렬 작업 충돌 영구 감소** + 인브라우저 Babel 파싱 에러 **blast radius 축소**(#687류). 개발 중지·pre-beta(저트래픽) 시점에 수행.
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

## 3. 모듈 맵 (1차 — components.js)

index.html 로드 순서: 의존 글로벌이 사용보다 **먼저**. 아래는 추출 순서(leaf→hot)이자 권장 로드 순서.

| 순서 | 새 파일 | 옮길 것 | 비고 |
|---|---|---|---|
| 1 (파일럿) | `icons.js` | `RG_ICONS`·`rgIcon`·`_RG_SEC_ICONS`·`SectionLabel`·`RG_SECTION_CARD`·`NEST_ART`·`nestArt` | 자립·cold. 위험 최소 |
| 2 | `admin-dashboard.js` | `AdminDashboardModal` | 방금 작성·admin 전용·자립 |
| 3 | `sentence-card.js` | `SentenceCard`·`SentenceActions` | claps/공개범위 계약 동반 |
| 4 | `settings-modal.js` | `SettingsModal` | icons 의존(로드 순서 뒤) |
| 5 | `book-info-modal.js` | `BookInfoModal`·`decodeEntities` | icons/sentence-card 의존 |

- `nest.js`·`library.js`는 1차 완료 후 별도 spec 갱신으로 진행.
- 공통 유틸(`rgTrack`·`decodeEntities` 등)은 사용처 따라 적절한 파일로(중복 정의 금지).

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
