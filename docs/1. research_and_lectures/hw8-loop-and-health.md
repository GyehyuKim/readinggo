# HW8 — oh-my-claudecode Looping Flow + /health 회고 (초안)

| 항목 | 내용 |
|---|---|
| 과목 | BIZ.69911 IT경영 특수논제 — AI 기반 비즈니스 진화, 전략 및 실습 |
| 학기 | 2026 Spring · KAIST IMMS |
| 교수 | 이지수 |
| 학생 | 김계휴 (gyehyu / diziba213@gmail.com) |
| 제출일 | 2026-05-28 |
| 저장소 | <https://github.com/GyehyuKim/glocalx> |
| 기반 머지 SHA (main) | `e04cac9` (HW8 작업 직전) → `5951db3` → `e04cac9` (#116 머지 후) |

## 과제 요약

1. `yeachan-heo/oh-my-claudecode` (이하 OMC) 설치
2. **looping flow** 로 기능 1개 구현
3. 회고 작성:
   - **Q1**: looping flow 로 얻은 인사이트
   - **Q2**: `/health` (코드 품질 대시보드) 실행 회고

---

## Q1 — Ralph 루프로 얻은 가장 큰 인사이트

> **"AI 에게 자율 루프를 맡길 때, 진짜 일은 *시작 전* 의사결정이다."**

Ralph 가 코드를 짜는 시간은 짧았다. 정작 길었던 건 **무엇을 루프에 태울지 정하는 과정**이었다. AI 가 후보를 검토해 보고하면, 내가 기준을 정해 골랐다. 이 보고-결정 사이클이 반복되고 나서야 비로소 Ralph 가 한 줄도 안 멈추고 통과시킬 만큼 잘 정제된 `PROMPT.md` 가 나왔다.

### 내가 결정한 지점들

**1. "/health 는 지금 의미 없다" 판단**
처음 무의식적으로 `/health` 를 돌렸다. AI 가 "이 저장소는 빌드 도구가 없는 docs-only 프로젝트라 측정할 표면이 0" 이라고 정직하게 보고. → **내 결정: 과제(looping flow + 회고) 를 먼저 한다.** 뒤에 AI 가 다시 "이제 /health 가시죠?" 라고 잘못 안내한 적이 있다. 내가 "아직 구현도 안 했는데 무슨 health?" 라고 막았다. → **AI 의 자동 추종을 사람이 끊어야 할 때가 있다**는 점을 체감.

**2. Spec 원본을 무엇으로 볼지**
AI 가 monolith spec(1,651줄) 과 분할본(`docs/readinggo/specs/`, 12 파일) 이 공존한다고 보고. → **내 결정: 분할본이 원본. monolith 는 무시.** 이 결정이 이후 모든 gap 분석/PROMPT 작성의 ground truth 가 됐다.

**3. Autopilot vs Ralph, 그리고 gap 분석 먼저**
"스펙 다 구현" 을 곧장 autopilot 으로 던지자 했다가, AI 가 "3,831 LOC 가 이미 있고 무엇이 missing 인지 모름. 덮어쓰기 위험" 이라고 막음. → **내 결정: gap 분석 먼저, 그 다음 작은 단위 루프.** 산출물: `docs/2. specifications/GAP-ANALYSIS.md` (PR #115).

**4. Feature 후보 우선순위 — UX 기준**
AI 가 3개 후보(방패 / 첫 7일 가속+카피 / 메가 스트림)를 비교 보고. → **내 질문: UX 기준 어느 게 가장 유효?** AI 답: #2 압도적. 근거는 spec §5.2 가 *"첫 일주일에 시각적 변화가 자주 터져야 사용자가 '내 행동이 집을 짓고 있다' 라고 느낀다"* 라고 **UX 의도를 명시** 하고 있다는 점. → **내 결정: #2 채택**. 이때 깨달은 것 — *spec 안에 이미 UX rationale 이 박혀있는 항목* 이 가장 안전한 루프 대상이다. 모호한 자율 판단을 줄여준다.

**5. PR 머지는 내가**
Ralph 가 13/13 통과시키고 architect APPROVED 받았지만, 머지 권한은 내가 GitHub 웹에서. AI 는 PR 생성까지만. → **이 분리가 자율 루프의 안전핀이다.**

### 사람-AI 분업 관찰

| 단계 | AI 가 잘 한 일 | 내가 한 일 |
|---|---|---|
| 진단 | "`/health` 무의미" 정직한 보고 | 우선순위 재정의 |
| 옵션 생성 | 3개 묶음 + 트레이드오프 비교 | UX 기준 채택 |
| 실행 | PROMPT.md 검증, 13/13 통과 | 무엇을 루프에 태울지 결정 |
| 합의 | architect+deslop 자체 검증 | 머지 권한 보유 |
| 잘못된 진행 | "이제 health 가죠" 자동 추종 | "안 했는데 뭐?" 차단 |

### 한 줄 결론

> **Ralph 는 의사결정을 자동화하지 않는다. 의사결정을 강제로 *앞당겨* 잘 정의된 `PROMPT.md` 에 박게 만든다. 그게 정말로 어려운 부분이고, 그게 사람의 일이다.**

---

## Q2 — `/health` 체크 경험

> **"빌드 도구 = 측정 표면. Phase 0 정적 웹은 측정 도구 생태계의 '맹점'에 있다."**

웹 서비스를 만든다고 했지만, `/health` 의 측정 결과는 **6 카테고리 중 2개만 채워졌다** (lint-md, test-spec-align). 나머지 4개는 SKIP. 이유는 단순하다 — *내가 박은 도구가 없어서*. `/health` 는 도구를 *감지* 할 뿐, 도구 자체를 만들지 않는다.

### 내가 보고받고 결정한 지점들

**1. "HTML 은 왜 측정 안 되나"**
관찰: `index.html` (149 줄) + 8개 vanilla JS (3,831 LOC) 가 있는데 score 가 markdown 과 python 테스트로만 매겨졌다. AI 보고: `/health` 의 auto-detection 목록은 `tsc / biome / eslint / ruff / knip / shellcheck / pytest / cargo / go`. HTML 린터(`html-validate`, `htmlhint`) 와 CSS 린터(`stylelint`) 는 **목록에 없다**. 즉 `/health` 는 *컴파일러 생태계가 있는 언어* 만 가정한다. 의미: AI 도구가 가정하는 "web stack" 은 React/Vue + TypeScript + Vite 같은 *빌드 도구가 박힌* 스택이지, 우리처럼 *React 18 CDN + Babel standalone + 정적 HTML* 같은 Phase 0 셋업은 측정 대상으로 인지조차 못 한다.

**2. "그래서 우리는 뭘 해야 하나"**
AI 가 옵션 4가지 시간·위험 추정 보고:

| 옵션 | 시간 | 결과 | 선택? |
|---|---|---|---|
| A — Health Stack 등록만 | 5분 | 의미 약함 | ❌ |
| **B 반쪽 — markdownlint + spec-align** | **30분-1시간** | **2 카테고리 측정** | ✅ |
| B 풀 — `package.json` + ESLint baseline | 2-3시간 | 4 카테고리, Stack Lock 영향 | ❌ |
| C — Phase 1 Vite/TS 마이그레이션 | 며칠 | 5/6 카테고리 | 별도 마일스톤 |

**내 결정: 옵션 B 반쪽**. 이유: spec PR 룰(Stack Lock) 위반 없이 *지금 당장* `/health` 를 의미 있게 굴릴 수 있는 최소 침습. 결과: `.markdownlint-cli2.jsonc` + CLAUDE.md `## Health Stack` 으로 2 카테고리 측정 가능. Composite Score 10/10 (단, 측정 표면이 좁다는 정직한 한계 포함).

**3. "Trend tracking 이 진짜 가치다"**
Composite Score 10/10 은 첫 baseline 이라 의미 약하다. 단일 시점 점수는 *지금 잘하고 있다* 가 아니라 *기준선 잡았다* 일 뿐. **진짜 가치는 두 번째 실행부터 나온다** — `~/.gstack/projects/glocalx-readinggo/health-history.jsonl` 에 누적되는 JSONL 이 *코드 품질의 시계열* 이 된다. 어떤 PR 이 점수를 떨어뜨렸는지, 어떤 머지 이후 회귀가 생겼는지 *데이터로* 보인다. "이번 PR 머지 전에 `/health` 돌려서 score 안 떨어졌는지 확인" 같은 루틴이 가능해진다. CI 에 묶으면 자동화. 지금은 수동이지만 trend 자체가 *팀의 품질 의식을 시각화* 한다.

### 첫 실행 결과 (baseline)

```
CODE HEALTH DASHBOARD
=====================
Project: ReadingGo (glocalx)
Branch:  gyehyu/health-stack-bootstrap
Date:    2026-05-28 (UTC 12:47)

Category      Tool                              Score   Status   Duration
----------    --------------------------------  -----   ------   --------
Type check    —                                 SKIP    -        -
Lint (md)     npx -y markdownlint-cli2          10/10   CLEAN    2s
Test          python tests/spec-align/nest.py   10/10   CLEAN    <1s
Dead code     —                                 SKIP    -        -
Shell lint    —                                 SKIP    -        -
GBrain        —                                 SKIP    -        -

COMPOSITE SCORE: 10.0 / 10
  (가중치 재분배: lint 18% → 39%, test 28% → 61%)
```

### 한 줄 결론

> **`/health` 의 점수는 *코드가 건강하다* 가 아니라 *측정 도구가 있다* 를 말한다. 진짜 가치는 점수가 아니라 시간에 따른 점수의 *변화* — 그래서 baseline 부터 시작해야 trend 가 산다.**

### 후속 백로그 (Phase 1 마이그레이션 시점 트리거)

- ESLint vanilla 8 JS 파일 baseline → `/health` 코드 LINT 카테고리 활성화
- `drift.py` GitHub Actions workflow 생성 → spec drift 자동 감지
- Vite + TypeScript → typecheck 카테고리 활성화
- vitest → 실제 단위 테스트 카테고리 활성화
- 목표: **6/6 카테고리 측정** → composite score 가 진짜 코드 품질 신호

---

## Evidence — 실제 산출물 (SHA + PR)

### PR #113 — Ralph 루프 스캐폴딩 (선행 작업, 본 HW 진입 전 머지)

| 항목 | 값 |
|---|---|
| PR | <https://github.com/GyehyuKim/glocalx/pull/113> |
| Branch | `gyehyu/loop-scaffolding` |
| Head SHA | `40e485c` |
| Merge SHA | `247c403` |
| 제목 | `test(harness): scaffold Ralph loops for nest-align and drift-defense (HW8)` |
| 산출물 | `loop/nest-align/PROMPT.md`, `tests/spec-align/nest.py`, `tests/spec-align/drift.py` |

### PR #114 — Ralph 루프 1회 실행 결과 (Q1 핵심 산출)

| 항목 | 값 |
|---|---|
| PR | <https://github.com/GyehyuKim/glocalx/pull/114> |
| Branch | `gyehyu/nest-microcopy` |
| Head SHA | `99abf9b` (코드) + `b67720d` (progress log) |
| Base SHA | `247c403` |
| Merge SHA | `5951db3` |
| Merged | 2026-05-28T12:29:09Z |
| 제목 | `feat(nest): add §5.2 진화 마이크로카피 4종 상수` |
| 변경 | `docs/readinggo/js/data.js` +15 lines (`NEST_STAGE_TRANSITIONS` 상수 + `getEvolutionCopy` 헬퍼 + 2 window export) |
| Verifier | `python tests/spec-align/nest.py` 12/13 → **13/13 exit 0** |
| Ralph 단계 | PRD → Implement → Verify → Architect APPROVED → Deslop (no edits) → Post-deslop regression → Cancel |

### PR #115 — Gap Analysis (Autopilot 산출, Ralph 진입 전 의사결정 기반)

| 항목 | 값 |
|---|---|
| PR | <https://github.com/GyehyuKim/glocalx/pull/115> |
| Branch | `gyehyu/gap-analysis` |
| Head SHA | `a9726cd` |
| Base SHA | `5951db3` |
| Merged | 2026-05-28T12:37:29Z |
| 제목 | `docs(spec): add GAP-ANALYSIS.md — spec ↔ 구현 매트릭스` |
| 변경 | `docs/2. specifications/GAP-ANALYSIS.md` +170 lines (67 항목 매트릭스, P0 5개, Open Questions) |
| 결과 요약 | Done 30 / Partial 17 / Missing 20 / v6 신규 미구현 0/4 |

### PR #116 — Health Stack Bootstrap (Q2 핵심 산출)

| 항목 | 값 |
|---|---|
| PR | <https://github.com/GyehyuKim/glocalx/pull/116> |
| Branch | `gyehyu/health-stack-bootstrap` |
| Head SHA | `7710e8d` |
| Base SHA | `e04cac9` |
| Merged | 2026-05-28T12:45:43Z |
| 제목 | `chore(health): bootstrap markdownlint + spec-align test registration` |
| 변경 | `.markdownlint-cli2.jsonc` (신규, 룰셋) + `CLAUDE.md` `## Health Stack` 섹션 추가 |
| 측정 표면 | 2/6 카테고리 (lint-md 18 files, test-spec-align 13/13) |

---

## 종합 한 줄

> **HW8 의 핵심 학습은 *AI 에게 무엇을 맡기지 않을지* 를 결정하는 일이 *맡기는 일* 보다 어렵다는 것**. Ralph 가 코드를 짜기 전에 5개 의사결정 지점이 있었고, `/health` 가 점수를 내기 전에 4개 옵션 중 *어느 강도로 도구를 박을지* 결정해야 했다. AI 가 보고하고 사람이 결정하는 분업이 명확해질수록 자율 루프의 결과가 *제품에 의미 있는* 방향으로 수렴한다.
