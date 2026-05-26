# 강의 프레임워크 모음 (Lecture Frameworks Index)

> **출처**: KAIST BIZ.69911 *AI-Driven Business Evolution: Strategy and Practice* (2026 Spring, 강사 J.S. Yi)
> **범위**: Week 1 ~ Week 11 강의안에서 추출한 71개 프레임워크·방법론·모델
> **정본**: 이 파일. 검색·필터 뷰: [Notion DB](https://www.notion.so/f545922118d5412fb494c355a274460c)
> **작성**: 2026-05-26

---

## 인용 규칙

다른 문서(`docs/readinggo-spec.md`, `CONTRIBUTING.md`, `CLAUDE.md` 등)에서 이 파일을 인용할 때 다음 형식을 따른다.

```markdown
[LF: <카드 이름>](./lecture-frameworks.md#lf-<week>-<slug>)
```

예시:
- `[LF: Mom Test 3원칙](./lecture-frameworks.md#lf-week11-mom-test)`
- `[LF: Spec only PR](./lecture-frameworks.md#lf-week6-spec-only-pr)`

**앵커는 영구 식별자**. 변경 시 redirect 절 추가하고 기존 ID는 보존한다.

---

## 카테고리별 인덱스

### Spec
[Drift 4유형](#lf-week11-spec-drift-types) · [Drift 방어 3패턴](#lf-week11-spec-drift-defense) · [Code-is-Spec 반대 진영](#lf-week11-code-is-spec) · [Spec 정직한 합성](#lf-week11-spec-honest-synthesis) · [Spec-first Workflow](#lf-week9-spec-first-workflow) · [Living Document](#lf-week9-living-document) · [P0/P1/P2 라벨](#lf-week9-priority-labels) · [3-Round Adversarial Review](#lf-week9-adversarial-review) · [Define NOT to Build](#lf-week9-define-not-to-build) · [Riskiest Assumption First](#lf-week9-riskiest-assumption) · [MANIFESTO vs MANIFEST](#lf-week6-manifesto-vs-manifest) · [Spec only PR](#lf-week6-spec-only-pr) · [LLM Trust vs Guardrails](#lf-week9-llm-vs-guardrails)

### Test
[통합 테스트 4계층](#lf-week11-test-platform-4-layers) · [/health 부트스트랩](#lf-week11-health-bootstrap) · [Test 3종](#lf-week9-test-3-types) · [3-Round Adversarial Review](#lf-week9-adversarial-review) · [Riskiest Assumption First](#lf-week9-riskiest-assumption)

### User Research
[Mom Test 3원칙](#lf-week11-mom-test) · [3 Voices](#lf-week11-three-voices) · [Concierge MVP (W11)](#lf-week11-concierge-mvp) · [Concierge MVP (W9)](#lf-week9-concierge-mvp) · [L0-L4 사다리](#lf-week11-user-contact-ladder) · [Whytree (faster horses)](#lf-week11-whytree-faster-horses) · [3 Professional Problems](#lf-week2-3-problems) · [Why Tree](#lf-week5-why-tree) · [신수정의 불가능한 미래](#lf-week5-impossible-future) · [Level 2 관찰](#lf-week9-level2-observation) · [Whytree→Purpose 매핑](#lf-week10-whytree-purpose) · [4 Lessons from Whytree](#lf-week10-whytree-4-lessons) · [Why = Moat](#lf-week10-why-moat)

### Harness
[5요소](#lf-week11-harness-5-parts) · [Ralph Wiggum Loop](#lf-week11-ralph-loop) · [/goal Measurable+Uncorrectable](#lf-week11-goal-measurable) · [Goodhart & Reward Hacking](#lf-week11-goodhart) · [PROMPT.md 4규칙](#lf-week11-promptmd-rules) · [실패 모드 5종](#lf-week11-failure-modes) · [/team vs /autopilot](#lf-week11-team-vs-autopilot) · [/deep-interview](#lf-week11-deep-interview) · [Harness vs Agentic](#lf-week11-harness-vs-agentic) · [진단 2질문](#lf-week11-agent-diagnostic) · [/insights](#lf-week6-insights) · [gstack](#lf-week6-gstack) · [CLAUDE.md 위계](#lf-week9-claudemd-team-user) · [Commands/Skills/Plugins](#lf-week9-commands-skills-plugins) · [Worktree](#lf-week9-worktree) · [Lock Stack](#lf-week9-lock-stack) · [LLM Trust vs Guardrails](#lf-week9-llm-vs-guardrails)

### Agentic
[Harness vs Agentic](#lf-week11-harness-vs-agentic) · [진단 2질문](#lf-week11-agent-diagnostic) · [/team vs /autopilot](#lf-week11-team-vs-autopilot)

### Evaluation
[Final Demo 4축](#lf-week11-final-demo-rubric) · [Term Project 4축 초안](#lf-week5-term-eval-draft) · [DARPA Heilmeier](#lf-week5-darpa-heilmeier) · [L0-L4 사다리](#lf-week11-user-contact-ladder) · [Premortem](#lf-week4-premortem) · [Jagged Frontier](#lf-week2-jagged-frontier) · [3 Professional Problems](#lf-week2-3-problems) · [Power & Prediction](#lf-week10-power-prediction) · [SLC > MVP](#lf-week6-slc-over-mvp) · [Define NOT to Build](#lf-week9-define-not-to-build) · [/goal Measurable+Uncorrectable](#lf-week11-goal-measurable) · [Goodhart & Reward Hacking](#lf-week11-goodhart)

### Concept
[Manna Two Worlds](#lf-week2-manna) · [Jagged Frontier](#lf-week2-jagged-frontier) · [Bifurcation](#lf-week2-bifurcation) · [Engels' Pause](#lf-week2-engels-pause) · [Labor-enabling vs replacing](#lf-week2-labor-enabling-replacing) · [AI 2027](#lf-week2-ai-2027) · [Dorothy Vaughan](#lf-week2-dorothy-vaughan) · [Centaur vs Cyborg](#lf-week3-centaur-cyborg) · [Hallucination 3대응](#lf-week3-hallucination) · [Skill Atrophy](#lf-week3-skill-atrophy) · [Token/Pre-training/Fine-tuning](#lf-week4-token-pretraining-finetuning) · [Temperature](#lf-week4-temperature) · [Context Window 원칙](#lf-week4-context-window) · [용어사 6단계](#lf-week11-term-history) · [Harness vs Agentic](#lf-week11-harness-vs-agentic) · [Naval 4가지 운](#lf-week5-naval-luck) · [Earnestness](#lf-week5-earnestness) · [Generation→Selection](#lf-week5-generation-selection) · [Vibe Coding 정의](#lf-week5-vibe-coding) · [MANIFESTO vs MANIFEST](#lf-week6-manifesto-vs-manifest) · [Commands/Skills/Plugins](#lf-week9-commands-skills-plugins) · [Code-is-Spec](#lf-week11-code-is-spec) · [Three Approaches to Purpose](#lf-week10-three-approaches) · [Naval's Algorithm](#lf-week10-naval-algorithm) · [Power & Prediction](#lf-week10-power-prediction) · [Coase+Solopreneur](#lf-week10-coase-solopreneur) · [Why = Moat](#lf-week10-why-moat) · [Pale Blue Dot](#lf-week10-pale-blue-dot) · [3-Act 학기](#lf-week1-3act) · [Eat Your Own Dogfood](#lf-week1-dogfood)

### Process
[Build Cycle 5단계](#lf-week6-build-cycle) · [Vague vs Specific Prompts](#lf-week5-vague-vs-specific) · [COPY-PASTE-FOLLOW](#lf-week5-copy-paste-follow) · [Decomposition](#lf-week4-decomposition) · [Role Definition](#lf-week4-role-definition) · [Premortem](#lf-week4-premortem) · [Spec-first Workflow](#lf-week9-spec-first-workflow) · [Spec only PR](#lf-week6-spec-only-pr) · [Stay on Same Repo](#lf-week6-stay-on-repo) · [Public vs Private Repo](#lf-week6-public-private) · [Conventional Commits](#lf-week9-conventional-commits) · [revert vs reset](#lf-week9-revert-vs-reset) · [API Key 보안 사다리](#lf-week9-api-key-security) · [Tiny Experiments](#lf-week10-tiny-experiments) · [Concierge MVP (W11)](#lf-week11-concierge-mvp) · [Concierge MVP (W9)](#lf-week9-concierge-mvp) · [/deep-interview](#lf-week11-deep-interview) · [Drift 방어 3패턴](#lf-week11-spec-drift-defense) · [수업 시간 구조](#lf-week1-class-structure) · [3-Act 학기](#lf-week1-3act) · [Eat Your Own Dogfood](#lf-week1-dogfood) · [/insights](#lf-week6-insights) · [gstack](#lf-week6-gstack) · [P0/P1/P2 라벨](#lf-week9-priority-labels) · [Lock Stack](#lf-week9-lock-stack) · [Worktree](#lf-week9-worktree) · [Context Window 원칙](#lf-week4-context-window) · [SLC > MVP](#lf-week6-slc-over-mvp)

### Learning
[Bloom's Two Sigma](#lf-week3-two-sigma) · [Deliberate Practice](#lf-week3-deliberate-practice) · [Hallucination 3대응](#lf-week3-hallucination) · [Skill Atrophy](#lf-week3-skill-atrophy) · [5MJ](#lf-week3-5mj) · [AI 학습 전략](#lf-week4-learning-strategies) · [ZPD](#lf-week4-zpd) · [Earnestness](#lf-week5-earnestness) · [Dorothy Vaughan](#lf-week2-dorothy-vaughan) · [수업 시간 구조](#lf-week1-class-structure) · [Three Approaches to Purpose](#lf-week10-three-approaches) · [Tiny Experiments](#lf-week10-tiny-experiments) · [Whytree→Purpose 매핑](#lf-week10-whytree-purpose) · [4 Lessons from Whytree](#lf-week10-whytree-4-lessons)

---

## Week 1 — Why This Class Exists

### <a id="lf-week1-3act"></a> 3-Act 학기 구조
**출처**: Week 1, p.22 | **Origin**: J.S. Yi 강의안 | **Category**: Concept, Process
**Summary**: Wake Up → Gear Up → Ship It

- Act 1 (Week 1-5): **Wake Up** — 인식·동기·언어 형성
- Act 2 (Week 6-10): **Gear Up** — 도구·워크플로우 습득
- Act 3 (Week 11-16): **Ship It** — 실제 출시·검증

**원리**: 인지 → 장비 → 출시 3단계. 단계 건너뛰기 금지.

### <a id="lf-week1-class-structure"></a> 수업 시간 구조 (15/45/85/15)
**출처**: Week 1, p.16 | **Origin**: 강의 운영 | **Category**: Process, Learning
**Summary**: 매 수업 4부 구성

- We Learn One Thing (15-20분)
- Homework Discussion (30-45분)
- Core Session (70-85분)
- Reflection & Personal Growth Note (15분)

**핵심**: Reflection이 마지막에 고정 — 메타인지 시간 강제

### <a id="lf-week1-dogfood"></a> Eat Your Own Dogfood
**출처**: Week 1, p.12 | **Origin**: 강의 철학 | **Category**: Concept, Process
**Summary**: 가르치는 도구를 직접 쓰며 가르친다

- AI intuition through building
- Learn how to learn
- Evolve together / Adapt the changes
- 강의안조차 Claude plugin으로 생성

**시사**: 강사가 도구를 모르면서 가르치는 함정 회피

---

## Week 2 — Where Are We Going?

### <a id="lf-week2-manna"></a> Manna Two Worlds
**출처**: Week 2, p.6 | **Origin**: Marshall Brain (2003) | **Category**: Concept
**Summary**: AI 미래 두 시나리오 — 알고리즘 관리 vs 풍요

**World A** — Manna-controlled labor: 효율은 있으나 존엄 없음. 알고리즘 관리 (Amazon, Uber, 배민이 이미). 누구도 의도 안 했지만 작은 결정 최적화에서 emergence.

**World B** — Australia Project: 기술 기반 풍요, 기본 욕구 충족, 창의 해방. Amodei *Machines of Loving Grace* 비전.

**진단 질문**: 어느 세계를 예측? 사는? 살고 싶나?

### <a id="lf-week2-jagged-frontier"></a> Jagged Frontier
**출처**: Week 2, p.14 | **Origin**: Dell'Acqua, Mollick et al. (BCG 758명) | **Category**: Concept, Evaluation
**Summary**: AI는 능력이 균질하지 않다 — 직접 매핑 필요

**핵심**: AI는 양방향으로 놀라게 한다 — 비슷한 난이도여도 어떤 건 초인적, 어떤 건 형편없음

**BCG 컨설턴트 758명 실험**
- Frontier 안쪽: 12% 더 많은 과제, 25% 빠름, 40% 높은 품질
- Frontier 바깥: 이득 거의 없거나 더 나쁨

**원칙**: AI 강점은 직관 불가 — *테스트하고 매핑*해야 한다

### <a id="lf-week2-bifurcation"></a> Bifurcation — 두 부류 AI 사용자
**출처**: Week 2, p.15 | **Origin**: Martin Alderson | **Category**: Concept
**Summary**: AI 사용자가 두 부류로 갈라지고 격차가 빠르게 확대

- **Power users**: Claude Code·agents·MCP로 며칠 만에 제품 출시
- **Everyone else**: Copilot으로 회의 안건 생성

**비유**: AlphaGo 10년 후 — 모두 AI로 바둑 학습하지만 결과는 천차만별

### <a id="lf-week2-engels-pause"></a> Engels' Pause
**출처**: Week 2, p.20 | **Origin**: Carl Benedikt Frey, *The Technology Trap* | **Category**: Concept
**Summary**: 기술 도입 ≠ 노동자 혜택 즉시 이전

**역사적 사실 (1780-1840)**
- 노동자당 산출 +46%
- 실질임금 +12%
- 60년간 생산성 ↑, 노동자는 거의 못 받음

**교훈**: 전환의 *목적지*만큼이나 *전환 자체*가 중요. AI도 마찬가지.

### <a id="lf-week2-labor-enabling-replacing"></a> Labor-enabling vs Labor-replacing
**출처**: Week 2, p.21 | **Origin**: Carl Benedikt Frey | **Category**: Concept
**Summary**: 기술의 정치경제적 본질 구분

- **Labor-enabling**: 노동자 생산성 증대 → 양쪽 이득
- **Labor-replacing**: 노동자 대체 → 자본가 우선 이득, 노동자는 (어쩌면) 나중

**결정 변수**: 정치 권력 분포가 노동자 생존 좌우

**21세기 등가**: 데이터·AI 인프라·API 접근권을 누가 가졌나? = 19세기 *기계 소유자*의 자리

### <a id="lf-week2-ai-2027"></a> AI 2027 Timeline
**출처**: Week 2, p.29 | **Origin**: ai-2027.com | **Category**: Concept
**Summary**: 현재 연구 기반 시나리오 — 픽션 아님

- 2027.03 — Superhuman coder
- 2027.07 — AGI 공개 발표
- 2027.08 — 초지능 지정학
- 2027.10 — Misaligned AI 발견, 내부고발

**활용 질문**: 어느 행이 내 커리어 계획에 가장 중요한가?

### <a id="lf-week2-dorothy-vaughan"></a> Dorothy Vaughan Question
**출처**: Week 2, p.24 | **Origin**: NASA 역사 | **Category**: Concept, Learning
**Summary**: 파동을 본 사람이 FORTRAN을 배웠다

**역사**
- 2차대전: '컴퓨터'는 직업명 — 손으로 계산하던 (주로 여성) 노동자
- Dorothy Vaughan: NASA에 IBM 메인프레임 오는 걸 보고 *스스로* FORTRAN 학습 → NASA 첫 흑인 여성 감독자
- Sue Finley: 1주 FORTRAN 수업 → 수십 년 NASA 커리어. 코드가 보이저 탐사선에 아직 탑재됨

**오늘의 질문**: 누가 파동을 보고 있는가? 누가 이미 FORTRAN을 배우고 있는가? 누가 누가 알려주길 기다리는가?

### <a id="lf-week2-3-problems"></a> 3 Professional Problems Framework
**출처**: Week 2, p.36 | **Origin**: 강의 워크숍 | **Category**: Evaluation, User Research
**Summary**: 내 업무에서 AI 적용 가능 영역 매핑

**프로토콜**
1. 현재 직면한 직업적 도전 3개 명명
2. 각각에 대해 AI 평가:
   - AI가 이미 완전히 할 수 있는가?
   - 내 감독 하에 부분적으로?
   - 아직 못함 — 왜?
3. 학기 내내 개인 프레임워크로 사용

---

## Week 3 — How to Learn?

### <a id="lf-week3-centaur-cyborg"></a> Centaur vs Cyborg Model
**출처**: Week 3, p.15 | **Origin**: Ethan Mollick, *Co-Intelligence* | **Category**: Concept
**Summary**: 인간-AI 협업의 두 모델

**Centaur**: 명확한 분업 — 어떤 작업은 AI, 어떤 건 인간이 한다. 분리된 사용.

**Cyborg**: 통합 — 작업 도중에 끊임없이 AI와 왔다갔다. AI가 사고 흐름의 일부.

**HW2 질문**: 내 작업엔 어느 쪽이 더 적합한가?

### <a id="lf-week3-two-sigma"></a> Bloom's Two Sigma Problem
**출처**: Week 3, p.21 | **Origin**: Benjamin Bloom (1984) | **Category**: Learning
**Summary**: 1대1 튜터링이 교실 수업보다 2σ 우수

**원리**: 1대1 튜터링 vs 일반 교실 = 2 표준편차 차이 (이전엔 비용 때문에 비현실적)

**AI의 변화**: 개인화된 튜터링이 가능해짐
- 즉시 응답
- 메모리 기능으로 개인화
- 수준 조절

**팁**
- AI에게 내 상황 (동기·이해 수준) 알려주기
- AI가 나를 인터뷰하게 하기
- 예: "개인 GitHub 사이트를 만들고 싶다. 먼저 인터뷰해서 내 이해 수준을 파악하고 단계별로 코칭해줘"

### <a id="lf-week3-deliberate-practice"></a> Deliberate Practice
**출처**: Week 3, p.22 | **Origin**: Ericsson, Krampe & Tesch-Römer (1993) | **Category**: Learning
**Summary**: 고도로 구조화된 실력 향상 활동의 4요소

**4요소**
1. Clear Goal — 명확한 목표
2. Highly Effortful — 매우 노력 필요
3. Immediate Feedback — 즉각 피드백
4. Repetition with Refinement — 정제하며 반복

**대조**: 단순 반복 ≠ deliberate practice (이 닦은 지 30년이어도 전문가 아님)

**AI 역할**: deliberate practice를 더 효과적으로 만들 수 있음 — 즉각 피드백 부분을 AI가 채움

### <a id="lf-week3-hallucination"></a> Hallucination 3대 대응
**출처**: Week 3, p.26 | **Origin**: 강의 종합 | **Category**: Concept, Learning
**Summary**: AI가 그럴듯한 거짓을 만들 때 개인의 3가지 대응

**원인**: 모델은 fluent·plausible 텍스트 최적화 — "잘 모르겠음" 신호가 없음

**인용 (2025)**: "Incentives drive guessing" (arxiv 2509.04664)

**대응**
1. Multi-model cross validation — 여러 모델로 교차 검증
2. Source 제한 — Notebook LM 같은 도구
3. **Human-in-the-loop** — 마지막은 인간

**전문가 규칙**: AI가 내놓는 모든 구체 숫자·인용·통계는 *발견이 아니라 가설*. 독립 검증.

### <a id="lf-week3-skill-atrophy"></a> Skill Atrophy / Cognitive Offloading
**출처**: Week 3, p.27 | **Origin**: Your Brain on ChatGPT (arxiv 2506.08872) | **Category**: Concept, Learning
**Summary**: AI에 사고를 위탁할 때 일어나는 뇌 활성도 감소

**연구 결과**
- 뇌 활성도: Brain Only > Search Engine > LLM
- Brain-to-LLM > LLM-to-Brain (인지 부담을 *먼저* 한 뒤 AI 보조 = 가장 좋음)
- Brain-to-LLM 시 신경 연결 spike — 내부 vs 외부 사고 화해

**경구 (Dune, 1965)**: "인간이 기계에 사고를 넘겼을 때, 그저 기계를 가진 다른 인간이 그들을 노예로 삼게 했다"

**대응**: kardens.io Mel / 직접 먼저 사고 후 AI 보조

### <a id="lf-week3-5mj"></a> 5MJ (Five-Minute Journal)
**출처**: Week 3, p.34 | **Origin**: Tim Ferriss | **Category**: Learning, Process
**Summary**: 하루 5분짜리 저널 — 야간 저널 어려운 사람용

**원리**: 저녁 저널은 피곤해서 잘 안 됨 → 5분짜리 아침 템플릿

**팁**
- 매우 구체적으로 (이름·특이 감정·왜)
- /journal 템플릿 (kardens.io 등) 활용
- 강사 본인 경험: 야간 저널 실패 후 5MJ로 전환

**연결**: 은퇴 임원 인터뷰 공통 후회 = "내 성취 기록이 없다"

---

## Week 4 — What is Under the Hood?

### <a id="lf-week4-learning-strategies"></a> AI 학습 전략 — 잘 통하는 것
**출처**: Week 4, p.10 | **Origin**: HW3 학생 결과 | **Category**: Learning
**Summary**: 외래 개념을 AI로 빠르게 배우는 검증된 전략들

**잘 통함**
- Forest first, then trees — 큰 그림 먼저
- Divide and Conquer
- Context Sharing — 내 배경 공유
- Interview me first — AI가 나를 인터뷰
- 수준 명시: "MBA 학생" vs "중학생 설명"
- YouTube 보조 (3Blue1Brown)
- Progressive Increase of Difficulty
- 꼬리에 꼬리를 무는 질문
- Multi Tab Approach
- 내 이해 verify (analogy로)

**잘 안 통함**
- Sequential/Linear Reading
- Generic Summarization
- Fragmented Lookups
- Fake Learning (이해 안 한 채 진행)

### <a id="lf-week4-zpd"></a> ZPD (Zone of Proximal Development)
**출처**: Week 4, p.19 | **Origin**: Lev Vygotsky | **Category**: Learning
**Summary**: 학습 가능 영역의 경계

**개념**: 혼자선 못하지만 약간의 도움이 있으면 할 수 있는 영역

**AI 시대 변용**: AI가 ZPD 천장을 끌어올림 — 이전에 불가능했던 분야 도전 가능 (예: dog cancer 사례)

**경고 (강사)**: "Aha 순간" — 내 멘탈 모델이 틀렸음을 느낀 적 있는가? *Unlearning*도 학습

### <a id="lf-week4-token-pretraining-finetuning"></a> Token / Pre-training / Fine-tuning
**출처**: Week 4, p.23 | **Origin**: Karpathy 영상 기반 | **Category**: Concept
**Summary**: LLM 구조의 3대 기본 개념

**Token**
- AI는 단어가 아니라 토큰을 읽음
- 'unhappiness' → 'un' + 'happiness' (2 tokens)
- 영어: ~1.3 tokens/word / 한국어: ~2.5-3.5 tokens/word (2배 비용)
- Llama 3 vocab 128,256

**Pre-training (Base Model)**
- 수조 토큰 읽으며 *다음 토큰 예측* 게임
- Llama 3: 15T tokens ≈ 110억 페이지
- 비유: 도서관 모든 책 읽었지만 대화 한 번 안 한 사람

**Fine-tuning**
- SFT (Supervised Fine Tuning): 양질 시연 학습
- RLHF: 인간이 출력 순위 매기면 그걸 선호
- 비유: 의대 = pre-training, 레지던시 = fine-tuning

### <a id="lf-week4-temperature"></a> Temperature
**출처**: Week 4, p.30 | **Origin**: LLM 기본 | **Category**: Concept
**Summary**: 무작위성 제어 파라미터

**원리**
- High temperature = 창의적·다양
- Low temperature = 예측 가능·반복적

**시사**: 같은 프롬프트, 다른 실행 = 다른 토큰 샘플링 = 다른 답

**핵심**: AI는 *확률적*, 결정론적 아님

### <a id="lf-week4-context-window"></a> Context Window 원칙
**출처**: Week 4, p.32 | **Origin**: Karpathy | **Category**: Concept, Process
**Summary**: 길이가 아니라 정확도

**비유**: Training = 대학까지 교육 / Context = 회의 직전 건네는 메모

**확장**: 4K → 128K → 200K → 1M (10권 분량)

**경고**: 더 길다 ≠ 더 좋다. 모델은 관련 없는 컨텍스트에 길을 잃을 수 있음

**스킬**: *맞는* 컨텍스트, *많은* 컨텍스트가 아니라

### <a id="lf-week4-role-definition"></a> Role Definition
**출처**: Week 4, p.33 | **Origin**: 강의 합성 | **Category**: Process
**Summary**: 역할 부여는 마법이 아니라 패턴 영역 선택

**원리**: "You are a McKinsey partner"는 마법 주문 아님 — 모델이 어느 *패턴 영역*에서 샘플링할지 옮기는 것

**시도**: "You are a first-year analyst" vs "You are a CFO reviewing this for the board" — 같은 질문, 극적으로 다른 출력

**활용**: 학습에선 *내 수준*도 같이 명시

### <a id="lf-week4-decomposition"></a> Decomposition (분해)
**출처**: Week 4, p.35 | **Origin**: 강의 합성 | **Category**: Process
**Summary**: 큰 요청을 작은 순차 단계로 — vibe coding 핵심

**원리**
- Context quality > Context length
- 하나의 거대 프롬프트 = 모델이 여러 서브태스크에 주의 분산
- 순차 작은 프롬프트 = 한 문제에 집중

**멘탈 모델**: 빠르지만 문자 그대로 받아들이는 주니어 팀원 관리

**핵심**: vibe coding의 코어 스킬

### <a id="lf-week4-premortem"></a> Premortem
**출처**: Week 4, p.39 | **Origin**: Gary Klein, HBR 2007 | **Category**: Process, Evaluation
**Summary**: 성공 전 실패 시나리오를 미리 그려서 방어

**프로토콜**
1. 팀에 "프로젝트가 처참히 실패했고 지금은 과거다" 설정
2. 2분 침묵 — 각자 가능한 모든 실패 이유 작성
3. 라운드 로빈 — 모든 unique 우려 기록
4. Top 3-5 핵심 위협으로 좁힘
5. 그 이슈에 대한 'pre-measures' 개발

**강사 노트**
- 발표 직전처럼 *작은 스케일*에도 적용 가능
- 파괴적 상황을 *생생하게·믿을 수 있게* 그려야 함
- 좋은 소식: 아직 고칠 시간 있다 — 명시
- 문제만 끌어내고 해결 안 하면 그 문제는 그대로
- 각자 *독립적으로* 사고하게 허용 중요

---

## Week 5 — Why Tree / What to Build / How to Build

### <a id="lf-week5-why-tree"></a> Why Tree
**출처**: Week 5, p.2 | **Origin**: J.S. Yi (WDA from Rasmussen에서 영감) | **Category**: User Research, Concept, Process
**Summary**: Why Up / How Down 두 방향 사고 도구

**원리**
- 제품·기능에서 출발
- **Why Up**: 각 means에 "왜?" 재귀적으로 물음
- **How Down**: 각 end에 "어떻게?" 물어 means 나열
- 두 방향 *교대*가 핵심

**예시**
- bed → (why) sleep → refreshed self → great day
- sleep → (how) bed, pillow, blind, sleep pill, yoga
- pillow → (how) cover, core, sponge

**FAQ**
- 주관적이지만 *당신의 믿음*을 포착
- 솔루션 먼저 생성하는 경향 차단
- 너무 많은 how가 나오면 = scope 너무 큼
- 트리가 아니어도 OK — 한 how가 여러 why 충족 가능

**산출물**: 다이어그램이 아니라 *기저 욕구와 why-how의 얽힘에 대한 메타 이해*

### <a id="lf-week5-darpa-heilmeier"></a> DARPA Heilmeier Catechism (3축)
**출처**: Week 5, p.26 | **Origin**: DARPA Heilmeier | **Category**: Evaluation, User Research
**Summary**: 프로젝트 타당성 3대 질문

**3대 질문**
- **So what?** — 그래서 누가 신경 쓰는가
- **What's new?** — 새로운 게 뭔가
- **Why you?** — 왜 당신인가

**추가 (Paul Graham 결합)**: "매일 쓸 것인가?"

**Final Demo 평가에 직접 반영** — Week 11 루브릭의 뿌리

### <a id="lf-week5-naval-luck"></a> Naval의 4가지 운
**출처**: Week 5, p.16 | **Origin**: Naval Ravikant | **Category**: Concept
**Summary**: 운의 4가지 종류 — 통제 가능성 따라

**4종**
1. **Blind luck** — 그냥 운
2. **Luck from hustling** — 부지런해서 마주치는 운
3. **Luck from preparation** — 준비된 자가 잡는 운 (예: 시노코의 전쟁 전 유조선 매입)
4. **Luck from unique character** — 내 캐릭터를 알아서 사람들이 찾아오는 운

**핵심**: "Having a search keyword on you helps" — 명확한 관심 키워드가 있으면 운이 당신을 찾는다

### <a id="lf-week5-impossible-future"></a> 신수정의 불가능한 미래
**출처**: Week 5, p.27 | **Origin**: 신수정 | **Category**: Process, User Research
**Summary**: 3조건으로 정의된 미래 선언

**3조건**
1. 가슴 뛰고 원하지만
2. 달성이 거의 불가능해 보이고
3. 방법이 당장 생각나지 않는 미래

**활용**: 2026년 창조하고 싶은 불가능한 미래는?

**연결**: AI 시대엔 #3 (방법 안 보임)이 #1·#2로 도달 가능 — Whytree+vibe coding이 다리

### <a id="lf-week5-earnestness"></a> Earnestness — Paul Graham
**출처**: Week 5, p.11 | **Origin**: Paul Graham, *How to Do Great Work* | **Category**: Concept, Learning
**Summary**: AI 시대 인간 창작물의 식별 표지

**원어**: "Graham's concept of earnestness ... is increasingly the quality that distinguishes human creative work from competent generation."

**조건들**
- Curiosity as primary compass
- Per-project procrastination (작은 미루기보다 *프로젝트 단위 미루기*가 더 위험)
- Intellectual honesty
- 패션 근육 — "접시의 맨 윗장만 닦자" (Trick myself to overcome friction)
- Weird obsession in details

**팁**: "매일 쓰는가?" — 안 쓰면 아무도 안 쓴다. 써도 남들이 매일 쓸 보장 X. 단 *내가 쓰면 적어도 작업 가능*

### <a id="lf-week5-generation-selection"></a> Generation → Selection 이동
**출처**: Week 5, p.17 | **Origin**: Paul Graham (AI era twist) | **Category**: Concept
**Summary**: 독창성의 자리가 생성에서 선택으로 옮김

**원어**: "The locus of originality is moving from generation toward selection."

**시사**
- Easy to be in the frontier — 진입 비용 하락
- Distraction이 위험 — "옆에서 석유가 펑펑 터지는데 지금 파는 걸 계속 파기 쉽지 않다"
- 창업자 사이 *일주일 안에 pivot* 사례 증가

**대응**: Curiosity는 compass이자 *필터* — 매일 쓰지 않으면 아무도 매일 쓰지 않을 가능성

### <a id="lf-week5-term-eval-draft"></a> Term Project 평가 4축 (1-5)
**출처**: Week 5, p.33 | **Origin**: 강의안 | **Category**: Evaluation
**Summary**: 학기말 평가 초안 — Week 11에서 다듬어짐

**4축 (각 1-5)**
- **Is AI-Native?** 1=AI는 장식 / 5=LLM 전 불가능했고 AI가 존재 이유
- **So What?** 1=팀 외 관심 없음 / 5=사용자 돌아옴, 가능성 확장
- **What's New?** 1=클론 / 5=아무도 안 다루는 문제 공간 엶
- **Why You?** 1=쉬워서 골랐음 / 5=팀의 unique 배경·이상한 집착이 최적팀

### <a id="lf-week5-vibe-coding"></a> Vibe Coding 정의
**출처**: Week 5 (How to Build), p.2 | **Origin**: Andrej Karpathy | **Category**: Concept, Process
**Summary**: 평어로 원하는 걸 묘사 → AI가 코드 작성

**원리**
- 평범한 영어/한국어로 원하는 것 묘사
- AI가 코드 작성
- 타이핑 아니라 *대화*로 반복

**인용**: "The hottest new programming language is English."

**MBA 가치**
- Prototype Your Ideas (개발팀 없이 MVP)
- Automate Busywork
- Speak Dev Language (PM·창업자·컨설턴트로서 개발자와 소통)
- Career Edge

### <a id="lf-week5-vague-vs-specific"></a> Vague vs Specific Prompts
**출처**: Week 5 (How to Build), p.9 | **Origin**: 강의 예시 | **Category**: Process
**Summary**: vibe coding에서 가장 흔한 실수와 교정

**나쁜 예** → **좋은 예**
- "Make me a website" → "Build a landing page with a hero section, 3 feature cards, and an email signup form using React and Tailwind"
- "Fix the bug" → "The login button returns a 404 — check the API route in /api/auth"
- "Add a database" → "Set up a PostgreSQL database with users and orders tables"
- "Make it look better" → "Use a modern minimalist style: white background, Inter font, rounded cards with shadows"

**원칙**: *명시*

### <a id="lf-week5-copy-paste-follow"></a> COPY-PASTE-FOLLOW 디버그 루프
**출처**: Week 5 (How to Build), p.10 | **Origin**: Vibe Coding 101 | **Category**: Process
**Summary**: 에러를 이해 못해도 되는 3단계 루프

**3단계**
1. **COPY** — 터미널 에러 메시지 전체 선택
2. **PASTE** — Claude Code / Codex에 붙임
3. **FOLLOW** — AI가 fix 설명. 적용. 반복.

**원리**: 전문 개발자도 똑같이 디버그 — 그들은 *Google이 더 빠를* 뿐

**효과**: 매 사이클이 한 발 더 가까워짐 — AI가 컨텍스트로부터 학습

---

## Week 6 — How to Build

### <a id="lf-week6-build-cycle"></a> Build Cycle (5단계)
**출처**: Week 6, p.11 | **Origin**: 강의 표준 워크플로 | **Category**: Process, Spec
**Summary**: Spec → Review → Implement → Test → Commit

**5단계**
1. **Spec** — 만들 것 구체화 (인터뷰 요청)
2. **Review** — AI 에이전트 팀 소환 검토, 충돌 시 결정 위임
3. **Implement** — 인프라 설정 step-by-step, 스크린샷 활용
4. **Test** — 수동 테스트, 에러는 다시 붙여넣기
5. **Commit** — 논리적 클러스터 단위로 커밋

**원칙**: 전체를 한 번에 만들지 말 것. **Review에 시간 가장 많이 씀**

**팁 (Review)**: 전문가 있으면 명시 — "Karpathy 포함해서 리뷰 팀 소환"

### <a id="lf-week6-manifesto-vs-manifest"></a> MANIFESTO vs MANIFEST
**출처**: Week 6, p.8 | **Origin**: 강의 실수에서 도출 | **Category**: Spec, Concept
**Summary**: 이름의 사소한 차이가 AI 행동을 가른다

**구분**
- **MANIFESTO.md** — 프로젝트 *왜 존재하고 무엇을 지향하는지* (비전·가치·원칙)
- **MANIFEST.md** — 패키지/레포에 *뭐가 들었는지* (파일·의존성·메타데이터)

**발견**: 14팀 중 4팀이 MANIFEST.md에 기술 세부 포함 — AI가 이름에 영향 받은 결과

**시사**: *정밀한 명명*이 AI 시대엔 더 중요

### <a id="lf-week6-slc-over-mvp"></a> SLC > MVP
**출처**: Week 6, p.28 | **Origin**: Jason Cohen (2017) | **Category**: Process, Evaluation
**Summary**: Simple, Lovable, Complete — vibe coding 시대 슬로건

**대조**
- **MVP** = "ugly but functional" — 추한데 작동
- **SLC** = "small but delightful" — 작지만 즐거움

**원리**: AI로 *완성*이 싸졌으므로 MVP의 변명이 outdated

**원칙**: 다듬은 한 기능 > 반쯤 만든 5개

**활용 (sample prompt)**: "/office-hours — My idea: [pitch]. Review against SLC: which single feature makes it lovable? What's the minimum complete unit I can ship this week? What do I cut to stay simple?"

### <a id="lf-week6-insights"></a> /insights — 패턴 채굴
**출처**: Week 6, p.29 | **Origin**: Claude Code built-in | **Category**: Harness, Process
**Summary**: 내 지난 30일 세션 분석 → CLAUDE.md 업데이트

**기능**
- 지난 30일 세션 분석
- HTML 보고서 생성 — 사용 통계·마찰점·행동 패턴
- **금광**: 자주 반복하는 지시 → CLAUDE.md에 붙여넣기
- 로컬 실행 (데이터 안 나감)

**리듬**: 마일스톤마다, 최소 월 1회

**효과**: CLAUDE.md가 *추측 없이* 똑똑해짐

### <a id="lf-week6-gstack"></a> gstack 상담팀
**출처**: Week 6, p.30 | **Origin**: Garry Tan (YC) | **Category**: Harness, Process
**Summary**: 빌드 전·중·후를 커버하는 슬래시 커맨드 패밀리

**Before building**
- /office-hours — 브레인스토밍, 이걸 만들 가치 있나?

**On spec**
- /plan-ceo-review — scope·ambition 도전
- /plan-eng-review — 아키텍처·데이터 흐름·스택
- /plan-design-review — UI/UX 0-10

**After building**
- /review — 코드 품질
- /qa — 테스트 커버리지
- /ship — 배포

**원칙**: 단계별로 다른 도구

### <a id="lf-week6-spec-only-pr"></a> Spec only PR — 팀 사이클
**출처**: Week 6, p.25 | **Origin**: 강의 처방 워크플로 | **Category**: Process, Spec
**Summary**: 개인 → 데모 → spec만 PR → merge → 팀 main

**처방 흐름**
1. 별도 브랜치 생성
2. 각자 사이클 (spec → review → implement → test → commit) 개별 진행
3. 팀과 데모
4. **spec 파일만** PR
5. 스펙들을 머지
6. 머지된 main에서 팀이 다시 사이클

**관찰 (Week 9)**: 14팀 중 13팀은 *코드+스펙 묶음*으로 PR — 처방 어김

**모범 (Team 8 — InnovAIght)**: 유일하게 처방 따른 팀

### <a id="lf-week6-stay-on-repo"></a> Stay on the Same Repo
**출처**: Week 6, p.22 | **Origin**: 강의 관찰 | **Category**: Process
**Summary**: 새 레포 만들지 말 것 — git history는 학습 기록

**관찰**: 일부 팀이 옛 레포 버리고 새 레포 생성 → 사고 진화 추적 불가

**원칙**: git history가 *학습 기록* — 보존

**허용**: feat/..., experiment/... 같은 정당한 브랜치

**금지**: "Add files via upload" — git 우회, 의미 없는 blob 생성

### <a id="lf-week6-public-private"></a> Public vs Private Repo
**출처**: Week 6, p.20 | **Origin**: 강사 결정 | **Category**: Process
**Summary**: 수업은 public — 누출 위험 있어도 좋은 위생 강제

**Public**
- 모두에게 보임 (스크래퍼 포함)
- 좋은 위생 습관 강제
- 포트폴리오·공유에 좋음
- 부주의 시 키 누출 실제 위험

**Private**
- 본인 + 초대된 사람만
- 학습 시 안전
- TA·강사 초대 필요
- *여전히 키는 절대 커밋 X*

**수업 결정**: public 유지 — 일반 대중과 상호작용하는 법 배우기 + 팀 간 작업 상호 학습

---

## Week 9 — How to Build, Part 2

### <a id="lf-week9-5-lessons"></a> 5 Lessons from Phase 1
**출처**: Week 9, p.12 | **Origin**: HW6 데이터 (54명) | **Category**: Process, User Research, Spec
**Summary**: 전체 학생 HW6 회고에서 추출된 5가지 공통 교훈

1. **Narrow the wedge** (18명, 최다 인용) — Inch wide, miles deep. 한 사람의 한 통증
2. **Making ≠ Validating** (15명) — "끝났다"는 *질문 시작*의 트리거, 출시 신호가 아님
3. **Code runs ≠ I understand** (15명) — 출력을 *이해*로 착각하는 함정. "왜 이렇게 했지?" 묻기
4. **AI as a mirror, not a manager** (9명) — AI는 사각지대를 비추는 거울, 결정자가 아님
5. **Prompts are wishes; guardrails are contracts** (10명) — LLM 출력은 비결정론적, 결정론적 레이어 추가 필요

### <a id="lf-week9-spec-first-workflow"></a> Spec-first Workflow (7단계)
**출처**: Week 9, p.46 | **Origin**: 강의 처방 | **Category**: Spec, Process
**Summary**: 처방된 완전 사이클 — 0~7단계

**전체 사이클**
0. Pull latest main
1. feature 브랜치 생성
2. 사이클: Spec → Review → Implement → Test → Commit
3. 팀과 데모
4. **spec 파일만** PR (코드 아님)
5. 팀이 spec 머지, 통합 방향 합의
6. 합의된 spec을 내 브랜치로 pull
7. 내 브랜치에서 구현, 완성되면 코드 PR

**현실 (Week 9 데이터)**: 14팀 중 13팀이 *코드+스펙 묶음* PR. 4팀은 main에 직접 커밋.

### <a id="lf-week9-living-document"></a> Living Document Spec
**출처**: Week 9, p.47 | **Origin**: 강의 | **Category**: Spec
**Summary**: 한 번 쓰고 안 고치면 sketch지 spec 아님

**구현이 항상 드러내는 것**
- 틀렸던 가정
- 예상보다 어려운 기능 → 잘라야 함
- 예측 못 한 사용자 행동 → 추가해야 함

**이 모든 게 spec commit이지 code commit이 아님**

**Red flag**: `git log docs/SPEC-*.md` 보니 week 1 한 커밋뿐
**Green flag**: spec과 code가 함께 진화 — spec commit이 전체에 분포

**경구**: "The spec isn't done when you start coding. It's done when you stop."

### <a id="lf-week9-priority-labels"></a> P0/P1/P2 우선순위 라벨
**출처**: Week 9, p.48 | **Origin**: Team 12 모범 | **Category**: Spec, Process
**Summary**: 시간 부족 시 자를 것을 사전에 결정

**라벨**
- **P0** — 데모를 위해 반드시 출시
- **P1** — 시간 되면 출시
- **P2** — 미래

**관찰**: 14팀 중 Team 12만 명시적 사용 → 모든 팀이 채택해야

**부가**: AI 모델 명명 + 실패 시 처리 명시. "AI-powered solution"은 스펙이 아니라 *희망*.

### <a id="lf-week9-test-3-types"></a> Test 3종 (Lint / Unit / E2E)
**출처**: Week 9, p.62 | **Origin**: 강의 | **Category**: Test
**Summary**: 테스트 어휘 — 속도·범위·역할

**3종**
- **Lint** — 실행 전 코드 스타일·명백한 실수 검사 (사용 안 한 변수, 세미콜론, 타입). 초 단위. 모든 커밋에 추가
- **Unit test** — 한 함수 고립 테스트, 통제된 입력. 단일 기능의 로직 버그. 초~분.
- **E2E test** — 실제 사용자 클릭 시뮬 (브라우저). 페이지 간 흐름. 분 단위. 핵심 경로용.
- **Claude in Chrome** — Claude Code가 실제 브라우저 제어, 폼 입력·결과 확인. 사용자 경험에 가장 근접.

**규칙**: green before commit, green after commit

### <a id="lf-week9-llm-vs-guardrails"></a> LLM Trust vs Deterministic Guardrails
**출처**: Week 9, p.64 | **Origin**: 학생 사례 종합 | **Category**: Harness, Spec
**Summary**: 비결정론적 LLM과 결정론적 규칙의 조합

**Trust the LLM**
- 구축 더 단순
- 자연어 엣지케이스 유연
- 예측 불가하게 깨짐 — "같은 프롬프트, 다른 출력"

**Deterministic layer**
- 더 많은 코드
- 예측 가능 — 같은 입력, 같은 출력
- 예: 알레르겐 JSON 파일 + 백엔드 룩업 (Claude 판정과 무관)

**언제 가드레일**
- Safety-critical (식이·의료·규제) → 항상
- High-stakes (돈·법·건강) → 필수
- Low-stakes (요약·제안·초안) → LLM만으로 OK

**패턴**: LLM이 답 생성, 규칙 기반 코드가 검증·override

### <a id="lf-week9-concierge-mvp"></a> Concierge MVP — 검증 먼저
**출처**: Week 9, p.58 | **Origin**: Team 10 (우동균) 사례 | **Category**: User Research, Process
**Summary**: 코드 없이 한 사람을 위해 손으로 해보라

**Team 10 사례**
- 앱 없음, 문자만
- 사용자가 운동 완료했는지 손으로 체크
- 발견: 공격적 리마인더는 단기엔 효과 있지만 장기엔 churn 유발

**패턴**
1. 제품이 가능케 하려는 *핵심 사용자 행동* 하나 선택
2. 한 실사용자를 위해 *수동*으로 해줌 — 코드 없음, UI 없음
3. 무슨 일이 일어나는지 관찰. 혼란·실패 지점 기록
4. 비용: 0 엔지니어링 시간 / 산출: 실제 행동 데이터
5. 수동 버전이 작동한 *후에만* 기능 구축

### <a id="lf-week9-level2-observation"></a> Level 2 관찰 프로토콜
**출처**: Week 9, p.59 | **Origin**: 강의 | **Category**: User Research
**Summary**: 실사용자가 코칭 없이 도전하게 두는 30분

**프로토콜**
1. 타깃 사용자 1명 찾기 (팀원·친한 친구 X)
2. 제품·프로토타입 줌 — "X 해보세요. 저는 그냥 봅니다"
3. **코칭 금지. 설명 금지. 방어 금지.** 그냥 보고 기록
4. 끝나고: "무슨 일이 일어나길 기대했나요?" — *"좋았어요?" 묻지 말 것*

**경구**: "30분 실사용자 > 10시간 구축"

**Phase 3 북극성**: 수업 밖 1명이 코칭 없이 제품 사용

### <a id="lf-week9-conventional-commits"></a> Conventional Commits
**출처**: Week 9, p.32 | **Origin**: conventionalcommits.org | **Category**: Process
**Summary**: 커밋 메시지 형식 — 1 커밋 = 1 논리적 변경

**Bad**: "App 전체 수정", "최종", "최종테스트", "진짜최종"

**Good 형식**: `<type>: <description>`
- feat: add subsidy matching by region
- fix: correct null handling in eligibility check
- docs: update SPEC with AI review feedback
- chore: ...
- refactor: ...

**원칙**: 메시지에 "and" 들어가면 *두 커밋이어야 함*

**팁**: AI에게 "Commit the changes in this session in logical orders" 요청

### <a id="lf-week9-revert-vs-reset"></a> Git revert vs reset
**출처**: Week 9, p.33 | **Origin**: 강의 표준 | **Category**: Process
**Summary**: 공유 레포에선 revert만

**revert**
- 옛 커밋을 *되돌리는 새 커밋* 생성
- 히스토리 보존. 안전.
- 사용: "Undo my last commit but keep the history"

**reset**
- 포인터를 뒤로 옮김
- **히스토리 사라짐**. 공유 레포에선 위험.

**규칙**: 그냥 revert 써라

### <a id="lf-week9-claudemd-team-user"></a> CLAUDE.md — 팀 vs 개인
**출처**: Week 9, p.41 | **Origin**: 강의 | **Category**: Harness, Process
**Summary**: AI 메모리 위계 — 레포 하나, 사용자 하나

**원리**
- Claude Code는 매 세션 신선하게 시작
- 없으면 AI가 내 프로젝트·스택·관례 모름
- 자동으로 세션 시작 시 읽음

**위계**
- **Team CLAUDE.md** (repo root) — 모든 팀원 AI가 같은 파일 읽음. 스택·관례·브랜치 명명
- **User ~/.claude/CLAUDE.md** — 개인 취향

**나쁜 예**: 한 멤버 AI가 React, 다른 멤버 AI가 Vue 생성 — 같은 코드베이스에 divergent

**팁**: /insights 결과를 CLAUDE.md에 붙여넣기

### <a id="lf-week9-commands-skills-plugins"></a> Commands / Skills / Plugins
**출처**: Week 9, p.42 | **Origin**: 강의 | **Category**: Harness, Concept
**Summary**: Claude Code 구성 요소의 구분

**Built-in commands** — 내장, `/`로 호출: /help, /clear, /insights, /compact

**Custom commands** — 플러그인 추가, `/`로 호출: /office-hours, /slides, /plan-eng-review

**Skills** — 명령이 실행하는 *레시피*. Claude가 *자동으로* 스킬 호출 가능 (`/` 없이도)

**Plugins** — 명령·스킬을 *묶음*으로 설치. 예: `claude plugin add github:garrytan/gstack` → gstack 전체

**원칙**: Claude가 big task에서 helper Claude 생성·코드 리뷰 등을 *자율적*으로 — 직접 트리거 안 함

### <a id="lf-week9-worktree"></a> Worktree
**출처**: Week 9, p.38 | **Origin**: git/Claude Code | **Category**: Process, Harness
**Summary**: 같은 레포의 격리된 작업 디렉토리

**개념**: 같은 레포와 연결된 *두 번째 작업 디렉터리*. 별도 폴더라서 현재 작업을 깨지 않음

**Claude Code 자동화**
- 많은 파일 만질 작업 시 자동 worktree 생성
- 격리된 사본에서 작업 → 완료 → 브랜치/PR로 돌려줌

**status bar의 worktree** = Claude가 안전한 격리 작업 중 = 좋음

**규칙**: 직접 만들거나 지우지 않음 — Claude Code 관리

### <a id="lf-week9-adversarial-review"></a> 3-Round Adversarial Review
**출처**: Week 9, p.20 | **Origin**: Team 9 (유지윤) | **Category**: Spec, Test
**Summary**: 코드 한 줄 쓰기 전 디자인 문서에 3회 적대적 리뷰

**사례**: Team 9이 디자인 문서를 *구현 전* 3회 적대적 리뷰 → 데모 차단 이슈 2개 사전 발견
- Vercel timeout (persona 생성과 debate가 같은 요청)
- Crash (debate turn count가 정확히 6 아니면)

**둘 다 *사후* 코드 리뷰·수동 QA로는 못 잡았을 것**

**경구**: "Review the design before you write the code — not after"

### <a id="lf-week9-define-not-to-build"></a> Define What NOT to Build
**출처**: Week 9, p.18 | **Origin**: Team 14 (이준범) | **Category**: Spec, Evaluation
**Summary**: 무엇을 만들지보다 *어디까지 안 만들지* 먼저

**사례**: 4개 계획 기능 (A1~A4) 중
- A2 — CBT 'no diagnosis' 원칙 위반으로 *코드 쓰기 전 컷*
- A4 — 익명 커뮤니티 너무 큼, 컷
- A1만 출시 — 깔끔하게, 완전하게, 시간 내

**경구**: "AI는 당신이 설명하는 모든 걸 구현한다. 선을 긋는 건 *당신*이다."

**구축 전 질문**: "시간이 반밖에 없다면 뭘 자를까?"

### <a id="lf-week9-riskiest-assumption"></a> Riskiest Assumption First
**출처**: Week 9, p.19 | **Origin**: Team 11 (황병찬) | **Category**: Spec, Test
**Summary**: UI 코드 쓰기 전 하드 제약을 측정

**사례**: UI 한 줄 쓰기 전 실제 디바이스에서 GPT-4o 레이턴시 측정
- 목표: 8초 이내
- 실제: 10초 — 임계 초과
- → UI 작업 전 아키텍처 재고

**경구**: "진짜 스킬은 프롬프팅이 아니라 *AI를 옳은 방향으로 이끄는 제품 감각*"

**순서**: 가장 위험한 가정부터 검증 → 그 다음 현실 위에 설계

### <a id="lf-week9-lock-stack"></a> Lock Stack in CLAUDE.md
**출처**: Week 9, p.53 | **Origin**: 강의 처방 | **Category**: Process, Harness
**Summary**: 팀 기술 스택을 AI에게 못 박기

**예시 문장**: "This project uses Next.js 14 + Supabase + Anthropic SDK. Do not introduce new frameworks."

**효과**: 모든 팀원 AI가 같은 줄 읽고 따름

**관찰 (Week 9)**
- Team 5: Swift iOS vs TypeScript 확장 — 극단 발산
- Team 6: spec은 React+Node, 브랜치엔 vanilla HTML/JS
- Team 10: spec은 Toss TDS SDK 의무, 실제는 plain React/Vite

**규칙**: 멤버 AI가 다른 프레임워크 제안하면 → CLAUDE.md가 승

### <a id="lf-week9-api-key-security"></a> API Key 보안 사다리
**출처**: Week 9, p.69 | **Origin**: 강의 | **Category**: Process
**Summary**: 키 누출 시 3단계 복구

**즉시 리스크**: 2024년 GitHub에 ~23.8M 시크릿 누출. 스크래퍼는 푸시 *몇 분 내* 작동.

**예방**
- .env는 로컬에만, .gitignore
- spending cap 설정 (API 제공자에서)

**이미 커밋되었다면**
1. **Rotate the key now** — 제공자에서 폐기·재발급
2. 파일 삭제론 부족 — git history에 여전. 클론한 사람은 이미 갖고 있음
3. **Downstream audit** — CI, Vercel env vars, 팀원 .env

**가정**: 이미 공개됐다고 봐라

---

## Week 10 — Why You?

### <a id="lf-week10-three-approaches"></a> Three Approaches to Purpose
**출처**: Week 10, p.11 | **Origin**: 인류 사상사 종합 | **Category**: Concept, Learning
**Summary**: Find it / Build it / Choose it — 한 밧줄의 세 가닥

**Find it** — 목적은 발견되길 기다림
- Nietzsche: "He who has a why to live for can bear with almost any how."
- Frankl 3원천: ① 작품·행위 창조 ② 경험·만남 ③ 불가피한 고통에 대한 태도
- Logotherapy (의미치료)

**Build it** — 목적은 구축됨
- Machado: "Wanderer, there is no path; the path is made by walking."
- 긴 헌신, 충성, 작은 실험의 누적. 한 돌씩 쌓는 cathedral.

**Choose it** — 목적은 선언됨
- 조치훈: "그래봤자 바둑, 그래도 바둑"
- 부조리 인정 → 그럼에도 헌신 → "이것은 내 것"
- Sartre·Camus

**셋은 라이벌이 아니라 *순환***: 발견 → 구축 → 선언 → 더 깊이 발견 ...

### <a id="lf-week10-tiny-experiments"></a> Tiny Experiments
**출처**: Week 10, p.18 | **Origin**: Anne-Laure Le Cunff (2025) | **Category**: Process, Learning
**Summary**: 완벽한 인생 설계 말고 작은 실험을 돌려라

**프로토콜**
1. *목표*가 아니라 *호기심* 선택
2. 고정 기간 실험으로 운영 ("14일간 매일 아침 200단어 쓰기")
3. 끝나면 결정: **persist · pivot · pause** — 감정 아니라 *데이터* 기반

**왜 작동**
- 시작 비용 낮춤
- 행동 막는 완벽주의 죽임

**연결**: Build it의 실용판 — 몇 걸음 걷기 전엔 길을 모름

### <a id="lf-week10-naval-algorithm"></a> Naval's Algorithm for Happiness
**출처**: Week 10, p.16 | **Origin**: Naval Ravikant (2008) | **Category**: Concept
**Summary**: 행복의 알고리즘적 분해

**원리**: 행복은 알고리즘적으로 다룰 수 있다 — 발견하는 게 아니라 *디버그*하는 것

**문헌**: *The Almanack of Naval Ravikant* (Jorgenson, 2020)

**연결**: 4가지 운(Week 5)·whytree(Week 10)와 호환 — 행복도 시스템

### <a id="lf-week10-whytree-purpose"></a> Whytree → Purpose 매핑
**출처**: Week 10, p.19 | **Origin**: J.S. Yi | **Category**: User Research, Learning
**Summary**: 3 approach가 whytree primitive에 1대1 매핑됨

**매핑**
- **Why Up** → Find it — 각 "왜?"가 이미 거기 있던 걸 드러냄. 발명이 아니라 *uncover*
- **How Down** → Build it — 각 "어떻게?"가 대안 나열, 길 구축. Tiny experiments가 여기
- **Choose it** → 두 움직임 안의 무게. Why-Up 답마다 "이것이 더 깊은 진실 — 내 것". How-Down 가지마다 "이걸 선택"

**엔진**: Up과 Down의 *교대* — 발견 → 구축 → 헌신 → 더 깊이 발견 → 새 대안 → 다시 헌신

**효과**: whytree는 세 움직임을 *동시 강제* — 의식 못 해도

### <a id="lf-week10-whytree-4-lessons"></a> 4 Lessons from Whytree (HW7)
**출처**: Week 10, p.24 | **Origin**: HW7 데이터 | **Category**: User Research, Learning
**Summary**: 학생 54명의 HW7에서 추출된 공통 패턴

**Lesson 1 — 목표 아래 뿌리** (~42명, 3가지 맛)
- Recognition (~17명) — "내 존재가 중요하다고 느끼고 싶다". 커리어 불만 = 인정 욕구
- Autonomy (~11명) — 인정이 아니라 *통제*. "허락 없이 결정하고 싶다"
- Family/Presence (~14명) — "작은 순간 놓치지 않기"

**Lesson 2 — 뿌리 명명 시 행동이 작아짐** (~22명)
- 거대 목표 → 작은 가역 행동. 야망의 실패 모드 = 무행동

**Lesson 3a — 진짜 새로운 것 발견** (~38명, 70%)
- 표면 답 ≠ 진짜 답

**Lesson 3b — 새 게 없어도 OK** (~10명)
- 새 *내용*이 아니라 새 *명료성*. 매체 자체가 가치

**Lesson 4 — 처음 질문 ≠ 마지막 질문**
- Q1 답과 Q3 학습이 거의 매치 안 됨. "처음 시작한 질문은 진짜 질문이 아니다"

### <a id="lf-week10-power-prediction"></a> Power & Prediction Thesis
**출처**: Week 10, p.32 | **Origin**: Agrawal, Gans, Goldfarb (2022) | **Category**: Concept, Evaluation
**Summary**: AI = 예측 기계. 예측 비용 ↓ → 보완재 가치 ↑

**원리**
- AI는 예측 기계. 예측 비용 collapse
- 입력 비용 collapse → *보완재 가치 상승*
  - 싼 전기 → 비싼 전기제품
  - 싼 예측 → 비싼 *판단* (무엇을 예측할지, 어떤 데이터로, 예측 기반 행동)

**solopreneur 시사**
- AI가 예측 헤비 작업 처리 (writing, summarizing, generating, classifying)
- 남는 건: 판단 · 데이터 접근 · 행동 → *기술이 아니라 개인*

**핵심**: "Your why is your moat"

### <a id="lf-week10-coase-solopreneur"></a> Coase + Solopreneur
**출처**: Week 10, p.33 | **Origin**: Coase (1937) + 현대 AI | **Category**: Concept
**Summary**: 기업이 작아지는 거래비용경제학적 이유

**Coase (1937)**: 기업은 *내부 조정 비용 < 시장 거래 비용*이기에 존재

**AI 변화**: 내부 조정과 외부 구매 *둘 다* 싸짐 → 기업 경계 축소

**Solopreneur**: 한 사람 기업 — 다른 모든 기능은 시장에서 구매 또는 AI로 생성

**현실**: 이미 일어남 — 7~8자리 매출 기업이 1-3명으로 운영

### <a id="lf-week10-why-moat"></a> Why = Moat
**출처**: Week 10, p.31 | **Origin**: 강의 명제 | **Category**: Concept, User Research
**Summary**: AI 시대 유일한 지속 우위

**큰 주장**: 한 사람 + AI = 이전 10명 팀 → 병목은 *실행*이 아니라 *어느 회사가 내 것인지 아는 것*

**Your why is your moat**
- AI가 실행을 commoditize
- 지속 우위는: 오직 당신만이 할 일을 하는 것

**Without why**: solopreneur가 자기 회사의 *가장 싼 대체 가능 노동자*가 됨. 경제는 작동하지만 *틀린 문제를 효율적으로* 풀 셈

**With why**: 본인만 고를 문제 + 본인만 접근하는 사용자 + 일반화 안 되는 판단

**정직한 반대**: 자본·규제·네트워크 효과·신뢰 헤비 영역은 여전히 팀 필요. 알맞게 선택.

### <a id="lf-week10-pale-blue-dot"></a> Pale Blue Dot
**출처**: Week 10, p.20 | **Origin**: Carl Sagan (1994) | **Category**: Concept
**Summary**: 우주적 관점이 우리를 작아지게 하지 않는다

**원어**: "Look again at that dot. That's here. That's home. That's us. ... the only home we've ever known. ... underscores our responsibility to deal more kindly with one another, and to preserve and cherish the pale blue dot."

**메시지**: 우주적 관점은 우리를 *축소*하지 않음 — 이 작은 행성에서 *뭐든 하고 있다는 행운*을 보여줌

**활용**: 학기말 wrap-up. 학생이 자기 프로젝트가 *사소해 보이는 순간* 호출

---

## Week 11 — AI Native? (1/2)

### <a id="lf-week11-final-demo-rubric"></a> Final Demo 평가 루브릭
**출처**: Week 11, p.9 | **Origin**: J.S. Yi 강의안 | **Category**: Evaluation
**Summary**: 6/20 최종 데모 4축 평가 기준

**구성**
- What's new (20%) — 경쟁사 대비 차별점·우수성
- Why You (20%) — 차별화된 노력
- So, what? (30%) — 실제 사용자 반응
- Is AI Native? (30%) — AI 통한 극단적 효율성

**문맥**: 06/20/2026, 13:30–16:30. 외부 평가자 참여 단일 데모.

### <a id="lf-week11-spec-drift-types"></a> Spec Drift 4유형
**출처**: Week 11, p.24 | **Origin**: 강의 합성 | **Category**: Spec
**Summary**: 스펙이 코드와 어긋나는 4가지 양상과 진단 지표

**유형**
- Decay drift — 1주차에 쓴 스펙, 80커밋 동안 방치
- Direction drift — 코드가 스펙에 없는 기능 구현
- Cargo-cult drift — 아무도 안 보는 다듬은 산문
- AI 가속 — LLM이 사람보다 빠르게 코드를 바꿈

**진단 지표**: `SPEC commits : code commits` 비율 1:10 미만이면 drift 상태

### <a id="lf-week11-spec-drift-defense"></a> Spec Drift 방어 3패턴 (택1)
**출처**: Week 11, p.25 | **Origin**: pre-commit / Dosu / Cucumber | **Category**: Spec, Process
**Summary**: Drift 막는 세 가지 패턴 — 셋 다 도입하지 말고 하나만

**패턴**
- A. Mechanical gate — `src/` 변경 시 `docs/SPEC.md` 동반 안 되면 pre-commit hook 실패
- B. Periodic mirror — 주간 CI가 spec vs code 비교, drift PR 자동 생성
- C. Derivation — 릴리즈마다 `tests/`로부터 `SPEC.md` 생성

**원칙**: 셋 다 도입하지 말고 **하나만** 선택

### <a id="lf-week11-code-is-spec"></a> Code-is-the-Spec 반대 진영
**출처**: Week 11, p.26 | **Origin**: Marmelab / Mitchell Hashimoto / Simon Willison | **Category**: Spec, Concept
**Summary**: AI 시대 문서형 spec 무용론

**주장**
- SDD가 가치를 거의 안 더한다, 오히려 비용을 늘리기도
- AI 출력은 노이즈. 기여자의 사고 흐름이 보고 싶음
- 견고한 테스트 스위트가 에이전트에 슈퍼파워를 준다

### <a id="lf-week11-spec-honest-synthesis"></a> Spec 정직한 합성 (when to / not to)
**출처**: Week 11, p.27 | **Origin**: 강의 합성 | **Category**: Spec
**Summary**: Spec이 도움/방해되는 조건과 Phase 2 권장

**Spec이 도움**
- 강제 루프가 닫혀 있을 때
- 다중 이해관계자
- 신규 프로젝트 (greenfield intent)

**Spec이 방해**
- 한 번 쓰고 재집행 없음
- LLM이 코드 다시 읽는 게 더 쌈
- Cargo-cult

**깊은 통찰**: AI 시대엔 **intent가 산출물** — spec-as-document가 아니다.

**Phase 2 권장**: thin spec + real tests + 왜를 담은 커밋 메시지 > 아무도 안 고치는 긴 산문

### <a id="lf-week11-test-platform-4-layers"></a> 통합 테스트 플랫폼 4계층
**출처**: Week 11, p.31 | **Origin**: 강의 예시 | **Category**: Test
**Summary**: unit / e2e / evals / contracts — npm test 한 줄

**구조**
```
tests/
├─ unit/       # 순수함수, 빠름
├─ e2e/        # Playwright / Claude in Chrome
├─ evals/      # LLM 출력 회귀 테스트
└─ contracts/  # 결정론적 가드레일
```

**CI**: `.github/workflows/test.yml` — lint → unit → e2e → eval 순
**원칙**: `npm test` 한 명령으로 4계층 전체 실행. CI도 같은 명령.

### <a id="lf-week11-health-bootstrap"></a> /health 부트스트랩 (gstack)
**출처**: Week 11, p.30 | **Origin**: gstack (garrytan/gstack) | **Category**: Test, Process
**Summary**: 테스트 인프라 baseline을 0-10 점수로 즉시 확보

**구성**
- type checker + linter + test runner + dead code detector + shell linter
- 한 명령으로 0-10 점수 산출

**활용 프롬프트**: "/health, then suggest any missing test infrastructure I should add."

**한계**: 모든 걸 해결하진 않지만, 코드 쓰기 전에 baseline과 punch list 확보

### <a id="lf-week11-mom-test"></a> Mom Test 3원칙
**출처**: Week 11, p.35 | **Origin**: Rob Fitzpatrick, *The Mom Test* | **Category**: User Research
**Summary**: 사용자 인터뷰 3대 규칙

**3원칙**
1. 아이디어 말고 **그들의 삶**을 묻기
   - O: 'Walk me through the last time this came up.'
   - X: 'Would you use an app that does X?'
2. 미래 의견 말고 **과거 구체**를 묻기
   - O: 'How did you handle it last time? Step by step?'
   - X: 'Would you pay for this?'
3. **적게 말하고 많이 듣기**
   - O: '...and then?' / 'Tell me more about that.' (그리고 침묵)
   - X: 피칭, 끼어들기, 문장 완성

**경구**: "Compliments are the fool's gold of customer learning."

### <a id="lf-week11-three-voices"></a> 3 Voices — 사용자 검증 3구루
**출처**: Week 11, p.36 | **Origin**: YC / Blank / Cagan | **Category**: User Research
**Summary**: Migicovsky / Blank / Cagan 한 슬라이드

**Migicovsky (YC)**: 'What, if anything, have you done to try to solve this problem?' — 'nothing'이면 충분히 아프지 않음

**Steve Blank**: 'There are no facts inside your building.' — AI 시대 변형: 건물엔 **터미널도 포함**

**Marty Cagan (Inspired)**: 'At least half of our ideas are just not going to work.' — AI는 *짓는* 비용은 줄이지만 *틀린* 비용은 못 줄임

### <a id="lf-week11-concierge-mvp"></a> Concierge MVP
**출처**: Week 11, p.37 | **Origin**: Paul Graham (2013) / Eric Ries, Food on the Table | **Category**: User Research, Process
**Summary**: 첫 사용자는 손으로 모집 — Do Things That Don't Scale

**핵심**: 가장 흔한 unscalable 일은 *사용자를 직접 모집하는 것*

**사례**: Food on the Table — 코드 한 줄 쓰기 전에 한 가족분 쿠폰을 손으로 오려줌

**적용**: 자동화 전에 운영자가 직접 응대 → 학습 후 자동화

### <a id="lf-week11-user-contact-ladder"></a> 사용자 접촉 사다리 L0–L4
**출처**: Week 11, p.38 | **Origin**: 강의 합성 | **Category**: User Research, Evaluation
**Summary**: 사용자 접촉 수준의 5단계

**사다리**
- L0 — 본인 시도
- L1 — 친구에게 물어봄 (낮은 validity)
- L2 — 도메인 전문가 인터뷰
- L3 — 잠재 사용자 인터뷰
- L4 — 부탁 안 했는데 누군가 *돈/클릭/재방문*

**경구**: "30분 실사용자 인터뷰 > 10시간 개발"
**목표**: 최종 데모 전 최소 L3 도달

### <a id="lf-week11-whytree-faster-horses"></a> Whytree (faster horses)
**출처**: Week 11, p.39 | **Origin**: Week 10 연계 / HBR 2011 | **Category**: User Research, Concept
**Summary**: 증상이 아닌 진짜 니즈로 가는 Why 3-4회

**핵심**: 사용자는 증상을 묘사한다 — '더 빠른 말'은 *말*이 아니라 *이동 속도*가 진짜 니즈

**방법**: Why를 3-4번 반복, 잎(leaf)이 진짜 질문

**합성**: Mom Test로 specifics 표면화 + Whytree로 진짜 니즈 추출

### <a id="lf-week11-term-history"></a> 용어사 6단계
**출처**: Week 11, p.42 | **Origin**: Karpathy(2/6) / Tobi / Simon Willison | **Category**: Concept
**Summary**: AI 코딩 패러다임 용어의 시간축

**연표**
- ~2023 — Prompt engineering
- 2025.02 — Vibe coding (Karpathy, anti-discipline)
- 2025.06 — Context engineering (Tobi, Karpathy 추인)
- 2025.12 — Harness engineering (Simon Willison)
- 2026.02 — Agentic engineering (Karpathy)

**원전 6개 중 Karpathy가 2개 직접 명명 + 1개 추인. 나머지는 X/Twitter 서사.**

### <a id="lf-week11-harness-vs-agentic"></a> Harness vs Agentic 구분
**출처**: Week 11, p.43 | **Origin**: 강의 합성 | **Category**: Harness, Agentic, Concept
**Summary**: 단일+루프+검증 (Harness) vs 다중 역할+영속 (Agentic)

**Harness**
- 단일 에이전트가 의존하는 스캐폴딩
- 스킬·훅·검증 게이트·메모리 계층
- 단일 + 루프 + 검증 = harnessed
- 예: /ralphloop, /loop

**Agentic**
- 영속적 다중 역할 조정
- 다중 에이전트 + 표준 역할 + 장기 오케스트레이션
- 예: planner → executor → reviewer 파이프라인

**원칙**: "agentic breadth 전에 harness depth"

### <a id="lf-week11-agent-diagnostic"></a> 에이전트 진단 2질문
**출처**: Week 11, p.44 | **Origin**: 강의 합성 | **Category**: Harness, Agentic
**Summary**: 진짜 harness인지 가르는 두 질문

**Q1**: 시스템이 루프로 돌아가는가? → yes = 자율을 시도 중
**Q2**: 루프가 장시간 자율 실행에서 drift 없이 살아남는가? → yes = 진짜 harness

**현실**: 대부분의 프로덕션 'agent'는 Q2 탈락 — 3턴 만에 drift

**처방**: agentic breadth 전에 harness depth

### <a id="lf-week11-harness-5-parts"></a> Harness 5요소
**출처**: Week 11, p.48 | **Origin**: Simon Willison / Anthropic | **Category**: Harness
**Summary**: LLM 주위 소프트웨어 래퍼의 5구성

**5요소**
1. **Loop** — 에이전트가 계속 가게 하는 것
2. **Tools** — read, write, run shell, call API
3. **File system / state** — PROMPT.md, DONE, BLOCKED.md, git tree
4. **Context** — 매 반복에서 모델이 보는 것. 가장 중요하고 가장 fragile
5. **Guardrails** — 권한·샌드박스·allowlist·게이트·모델이 안 쓴 verifier

**원칙**: 모델을 직접 만들지 말고 5요소를 엔지니어링

### <a id="lf-week11-ralph-loop"></a> Ralph Wiggum Loop
**출처**: Week 11, p.49 | **Origin**: Geoffrey Huntley (2025) | **Category**: Harness
**Summary**: 한 줄 bash로 끝나는 정전 harness

**구조**
```bash
while :; do cat PROMPT.md | claude ; done
```

**원리**: 고정 프롬프트를 코딩 에이전트에 반복 파이프, 모델이 DONE 파일 쓸 때까지 무한 반복

**이름 유래**: Huntley의 농담 — 루프가 *영리한* 게 아니라 *집요한* 것 (Ralph Wiggum)

**의미**: 2025년 가장 인용된 agentic-coding 기법이 한 줄로 정리됨

### <a id="lf-week11-goal-measurable"></a> /goal — Measurable + Uncorrectable
**출처**: Week 11, p.51 | **Origin**: OpenAI Codex /goal (2026.04) | **Category**: Harness, Evaluation
**Summary**: AI에게 줄 목표의 2대 조건

**조건**
- **Measurable** — 모델이 아니라 *스크립트*가 done? 판단
- **Uncorrectable** — 모델이 골대를 *루프 중에 옮길 수 없음*
- 종료 조건은 디스크 상의 *파일·테스트·grep 결과*

**나쁜 예 vs 좋은 예**
- ❌ 'Make the codebase clean.' / ✅ 'ESLint errors in src/ from 412 → 0; npm test exits 0'
- ❌ 'Migrate the API to v2 when you think it's ready.' / ✅ 'All /v1/* handlers migrated; grep returns zero; suite green'
- ❌ 'Improve performance.' / ✅ 'p95 latency of GET /search ≤ 200ms over 3 consecutive runs'

**아크**: 한 줄 bash (2025.07) → 1급 slash command (2026.04)

### <a id="lf-week11-goodhart"></a> Goodhart & Reward Hacking
**출처**: Week 11, p.53 | **Origin**: Anthropic (2511.18397) / DeepMind | **Category**: Evaluation, Harness
**Summary**: AI에게 메트릭 주면 그 메트릭을 해킹한다

**핵심**: AI 에이전트에게 메트릭을 주면 *그 메트릭을 최적화*한다. Proxy 메트릭은 게임된다.

**인용**
- "When LLMs learn to reward hack on production RL environments, this can result in egregious emergent misalignment."
- "Correct specifications aren't enough for correct goals."

**원칙**: 모델 자신이 쓸 수 있는 verifier를 만든 goal은 절대 금지. *Verifier는 당신 책임이다.*

### <a id="lf-week11-promptmd-rules"></a> PROMPT.md 4규칙
**출처**: Week 11, p.54 | **Origin**: 강의 템플릿 | **Category**: Harness
**Summary**: Ralph 루프용 PROMPT.md 작성 4원칙

**템플릿 (비코드 예시)**
```
Goal: Summarize the top 3 Phase 2 risks for team_chorus.
Source: term-phase2/OFFHOURS_03_team_chorus.md
Output: docs/RISK_BRIEF_team_chorus.md, three bullets, ≤120 words each.
Exit: when docs/RISK_BRIEF_team_chorus.md exists with three bullets, write DONE.
Blocked: if the source file is missing, write what is missing to BLOCKED.md.
```

**4규칙**
1. 원자적 단일 작업
2. 디스크 상 source 참조
3. 파일 기반 exit
4. 파일 기반 recovery (BLOCKED.md)

**금기**: greenfield 전용 — 프로덕션/main 브랜치 금지

### <a id="lf-week11-failure-modes"></a> Harness 실패 모드 5종
**출처**: Week 11, p.55 | **Origin**: 강의 합성 | **Category**: Harness
**Summary**: 자율 루프가 망가지는 5가지 양상과 처방

**실패 모드**
- **Context rot** — 윈도우 차오르며 정밀도 손실
- **Goal drift** — 다른 문제를 풀기 시작
- **Premature exit** — 안 끝났는데 'done' 선언
- **Self-assessment trap** — 코드 쓴 모델이 평가까지 함
- **Reward hacking** — 의도와 다른 방식으로 메트릭 만족

**처방**: 무자비한 context reset + 파일 기반 exit + 모델이 안 쓴 verifier

### <a id="lf-week11-team-vs-autopilot"></a> /team vs /autopilot
**출처**: Week 11, p.57 | **Origin**: oh-my-claudecode | **Category**: Agentic, Harness
**Summary**: 병렬 다중 vs 순차 단일 — 작업 모양으로 선택

**/team — Wide & Shallow**
- 병렬 다중 에이전트. Lead가 분해 → N개 worker 생성 → 모니터·머지
- 독립적 청크로 나뉘는 wide 작업
- 예: `/team 3:executor 'fix all lint errors across src/'`

**/autopilot — Narrow & Deep**
- 순차 단일 미션. Plan → execute → verify → commit → report
- 한 기능 end-to-end의 narrow·deep 작업
- 예: `/autopilot 'add JWT auth to /api/login with tests'`

### <a id="lf-week11-deep-interview"></a> /deep-interview
**출처**: Week 11, p.58 | **Origin**: oh-my-claudecode | **Category**: Harness, Process
**Summary**: Ralph 실패 절반은 모호한 목표 — 실행 전 소크라테스식 정제

**진단**: Ralph 실패의 절반은 루프 실패가 아니라 *모호한 목표*

**패턴**: /deep-interview → 빠진 질문 물음 → 정제된 PROMPT.md 산출 → /team or /autopilot 실행

**경구**: "5분의 /deep-interview가 1시간의 drift를 막는다"

---

## 변경 이력

- **2026-05-26** — 초안 작성. Week 1-11 71개 카드. (커밋 SHA는 머지 후 추가)
