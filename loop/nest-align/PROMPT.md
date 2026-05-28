Goal: docs/readinggo/js/nest.js, docs/readinggo/js/data.js, docs/readinggo/js/components.js 를 docs/readinggo/specs/nest.md spec 과 정합시켜, tests/spec-align/nest.py 의 모든 invariant 가 통과하도록 한다.

Source:
- docs/readinggo/specs/nest.md (스펙 정본 §5.1-5.4)
- docs/readinggo/specs/onboarding.md (§4 가입 여정 참조용)
- docs/readinggo/specs/systems.md (§6 스트릭·XP 시스템 참조용)
- docs/readinggo/js/nest.js (구현 본체)
- docs/readinggo/js/data.js (NEST_STAGES, getNestStage)
- docs/readinggo/js/components.js (NestBanner 등 공용 컴포넌트)

Output:
- docs/readinggo/js/nest.js (수정)
- docs/readinggo/js/data.js (필요 시 수정)
- docs/readinggo/js/components.js (필요 시 수정)
- spec 자체를 수정하지 말 것. 코드만 정합.

Exit: `python tests/spec-align/nest.py` 가 exit 0 일 때, loop/nest-align/DONE 파일을 빈 내용으로 생성한다.

Blocked:
- spec 이 모호하거나 두 해석이 가능할 때 → loop/nest-align/BLOCKED.md 에 (a) 모호한 절 번호 (b) 가능한 해석 2개 이상 (c) 추천 해석 작성 후 종료.
- spec 변경 필요 발견 시 → BLOCKED.md 에 spec 변경 제안 (어느 절·어떻게) 작성 후 종료. 사용자가 별도 spec PR 로 처리한다.
- 다른 피처 파일 (book-club.md, profile.md 등) 까지 손대야 풀리는 의존이면 → BLOCKED.md 에 *어떤 cross-feature 변경 필요* 명시 후 종료.

Constraints:
- React 18 + Babel standalone CDN 환경. 빌드 도구 없음.
- 의존: 각 파일 끝에 `window.X = X` 로 export.
- 상태 저장: localStorage `rg_v41` (data.js INITIAL_STATE 참조).
- 새 라이브러리 도입 금지. CLAUDE.md Stack Lock 준수.
- spec-only PR 룰 위반 금지: 본 loop 결과는 *코드만* 변경. spec 수정이 필요하면 BLOCKED.md 로.
- 본 PROMPT.md, tests/spec-align/nest.py, loop/* 디렉토리는 *변경 금지*.

Verification self-check:
- 변경 후 `python tests/spec-align/nest.py` 실행 → 12/13 → 13/13 으로 가야 한다.
- 새 컴포넌트 추가 시 `window.X = X` 누락 없는지.
- 기존 `state.simDate` 시뮬레이터 동작 깨지 않는지.
