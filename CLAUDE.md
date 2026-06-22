# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

This is a course project folder for **BIZ.69911 — IT경영 특수논제: AI 기반 비즈니스 진화, 전략 및 실습** (KAIST IMMS, Spring 2026, instructor: 이지수).

The project is **ReadingGo** — 독서 + 게이미피케이션(스트릭, XP, 소셜)으로 매일 읽게 만드는 독서 습관 형성 앱. 소스 문서는 `docs/` (MANIFESTO, whytree, pitch). 데모 엔트리포인트: `docs/readinggo/index.html` (예정).

## Governance — MANDATORY

Before making any git/PR operation, read and follow **[`CONTRIBUTING.md`](./CONTRIBUTING.md)**. It is the single source of truth for:

- Branch naming (`<owner>/<topic-slug>`, owner ∈ {gyehyu, seungwon, yunji})
- PR size and lifetime rules
- Conventional Commits message format
- Forbidden operations (direct push to main, --force, --no-verify, committing secrets)
- Concurrent work and rebase protocol (web editor stale-base sacrifice zone — §3.4)
- Issue sync — every PR links/creates issues, milestone triage (§4.2–4.3)
- LLM-specific behavior rules (§9)

**이슈 먼저 (필수)**: 새 PR을 만들기 **전에** GitHub 이슈를 먼저 생성하고(`gh issue create`), PR 본문에서 `Closes/Refs #N`로 연결한다. 의미 있는 작업(feat·fix·docs·perf·refactor)은 예외 없이 이슈를 먼저 연다. `no-issue:`는 **오타·포맷 같은 진짜 사소한 변경에만** 쓴다(상시 사용 금지). 이유: 이슈가 작업을 추적·정렬하고 정리 부담을 한 사람에게 몰리지 않게 한다 (CONTRIBUTING §4.2).

**Priority on conflict**: `CONTRIBUTING.md` > `CLAUDE.md` > `AGENTS.md` > other docs.

Other agents (Cursor, Continue, Aider) should enter via [`AGENTS.md`](./AGENTS.md) — same governance, same rules.

## Active Workspace Boundaries

- `docs/` — MANIFESTO, whytree, pitch, Netlify 데모
- `old/` — 이전 아이디어 아카이브 (기프타로, GosiOps, 트렌드 패치노트, 찍먹). 읽기 전용.

새 작업은 `docs/` 에만 한다. `old/` 는 레퍼런스 용도로만 열람.

## Stack Lock

근거: [LF: Lock Stack in CLAUDE.md](./docs/1. research_and_lectures/lecture-frameworks.md#lf-week9-lock-stack).

- **플랫폼 (런칭 결정, 2026-06)**: **Capacitor 채택 — iOS + Android 앱스토어 출시**(이전 web-first 보류 해제). 같은 React 코드베이스로 웹·iOS·Android 동시. **선행 = Vite 전환**(아래 빌드). RN/Expo/Flutter 등 *다른* 네이티브 프레임워크는 여전히 금지(Capacitor 단일). 상세·단계는 [`iOS-PLAN.md`](./docs/readinggo/iOS-PLAN.md).
- **OCR (해제, v8 결정 2026-06-11)**: 읽기모드 책 사진 글귀 추출 = **웹 기반 OCR 허용**. 서버리스(Cloudflare Worker `/api/ocr`)에서 **Upstage Document OCR + solar-pro3 보정**, 키는 서버 보관(클라 노출 금지). 네이티브 불필요 → 위 보류 대상 아님. STT(음성)는 여전히 OS 키보드 마이크로 대체(Phase 3).
- **빌드 (런칭 결정, 2026-06)**: **Vite 전환** — React 18 CDN + Babel(현행)에서 Vite 빌드로 이전. Capacitor 셸·앱스토어 출시의 선행 작업(iOS-PLAN S1). 전환 완료 전까지 기존 CDN 데모는 유지.
- **백엔드**: Phase 0 `localStorage` / Phase 1+ **Supabase** (Google OAuth). **DataStore 계약**으로 추상화 — 피처 코드는 저장소를 직접 호출하지 않음 (`docs/readinggo/specs/backend.md` §7.2).
- **AI (v9 갱신 2026-06-20)**: **Gemini Flash 무료 티어 + 서버리스 프록시** — **텍스트·vision 모두 자유 사용**(도서 추천, 사진 밑줄/강조 추출 등 용도 추가에 별도 lock 결정 불필요). 클라이언트에 API 키 노출 금지(키는 서버 보관). OCR(글자 추출)은 Upstage Document OCR 유지, 이미지 의미 이해(vision)는 Gemini.
- **데이터 (canonical 갱신, #490 결정 2026-06-15)**: 책 데이터의 canonical source는 **Phase 1 Supabase `books`**. `getBook(id)` 동기 API는 부팅 시 Supabase 전체 책을 메모리 캐시에 적재해 보존하고, 게스트 검색도 publishable key + RLS read 로 같은 카탈로그를 쓴다. `books.tsv`·인라인 `RG_BOOKS`는 **더 이상 주 데이터 소스가 아니다** — 시드 및 네트워크/부팅 실패용 최소 폴백으로만 남긴다(근거·범위는 PR에 명시). 단 **Phase 0 현재 구현은 여전히 `localStorage` + 정적 TSV** 이며, 위 전환(차집합 시드·코드·데이터 적용)은 #490 후속 코드 PR에서 한다. (이전 "TSV 포맷 유지 #90"을 본 결정으로 갱신.)
- 변경 제안 시 해당 피처의 `docs/readinggo/specs/<feature>.md` spec PR 먼저, 코드 PR 나중 ([LF: Spec only PR](./docs/1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)).

새 프레임워크/라이브러리/언어 도입 제안이 들어오면 위 룰을 먼저 안내하고 사용자에게 확인.

## Product Principle: SLC > MVP

근거: [LF: SLC > MVP](./docs/1. research_and_lectures/lecture-frameworks.md#lf-week6-slc-over-mvp).

새 기능 제안·평가 시 *Simple · Lovable · Complete* 기준 적용. "ugly but functional" (MVP) 대신 "small but delightful" (SLC). 다듬은 한 기능 > 반쯤 만든 다섯 개. 자문 질문: "이게 lovable한가? 이번 주에 *complete*할 수 있는 최소 단위는?"

## Google Drive environment

This repo lives inside a Google Drive sync folder. The Drive client periodically creates `desktop.ini` files inside `.git/refs/`, `.git/objects/`, etc., which breaks `git pull`/`fetch` with `fatal: bad object refs/.../desktop.ini`. **Before any git command, run:**

```bash
find .git -name "desktop.ini" -type f -delete
```

If an error mentions `desktop.ini`, clean first, then retry.

## Working with PPTX Files

Use the `pptx` skill to read, edit, or create `.pptx` files:
- `/pptx` — invoked via the Skill tool in Claude Code

## Language

All course content and communication is in **Korean** unless the user writes in English.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /open-gstack-browser
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health
- Mine session patterns to update CLAUDE.md → invoke /insights (마일스톤마다, 최소 월 1회. 근거: [LF: /insights](./docs/1. research_and_lectures/lecture-frameworks.md#lf-week6-insights))

## Health Stack

`/health` 가 측정하는 도구 등록. 자동 감지 우회 — 이 섹션이 source of truth.

- lint: `npx -y markdownlint-cli2`
- test: `python tests/spec-align/nest.py`

### 현재 측정 표면

- **lint (md)** — `.markdownlint-cli2.jsonc` globs 범위 (active spec + 루트 docs, 18 files)
- **test (spec-align)** — `tests/spec-align/nest.py` 13개 invariant
- TYPECHECK / 코드 LINT / DEADCODE / SHELL → SKIPPED (Phase 0 정적 HTML/JS, 빌드 도구 미도입 — Stack Lock)

### 추가 등록 후보 (도입 시)

- `tests/spec-align/drift.py` — 현재 `.github/workflows/spec-drift.yml` 부재로 단독 실패. CI 워크플로우 생성 후 등록
- ESLint (vanilla JS 린트) — `package.json` 도입 동반, 별도 spec PR 필요
- Phase 1 Vite/TypeScript 마이그레이션 시 typecheck/vitest 추가

## PR 머지 전 체크리스트

> **상태 보고·액션 요청 규칙 (MANDATORY)**: PR/이슈 상태를 보고하거나 계휴에게 "머지/실행하세요"를 말하기 **직전에 반드시** `gh pr list --state open` / `gh issue view <n>`로 실측한다. **이미 머지·닫힌 것을 "하세요"로 다시 나열하지 않는다.** 액션 목록에는 `gh`로 OPEN임을 확인한 것만 넣는다. 확인 안 한 추정 상태를 적는 것은 금지.
> **`Closes` 다중 이슈 주의**: `Closes #A #B`는 **#A만** 닫는다. 여러 이슈는 각각 `Closes #A` `Closes #B`로 줄을 나눠 쓴다.

PR 생성 또는 머지 요청 전 반드시 아래 순서를 따른다.

1. **브랜치 최신화 확인**: PR 페이지에 "This branch is out-of-date" 메시지가 있으면 머지 전에 반드시 해결.
   ```bash
   # 로컬에서 최신화
   git fetch origin
   git rebase origin/main
   git push --force-with-lease
   ```
   또는 GitHub PR 페이지 하단의 **`Update branch`** 버튼 클릭 (더 간단).

2. **왜 필요한가**: 다른 팀원의 PR이 먼저 main에 머지되면 내 브랜치가 뒤처진다. 이 상태로 머지하면 충돌이 발생하거나 변경사항이 덮어써질 수 있다. `Require branches to be up to date` 브랜치 보호 규칙이 이를 시스템적으로 강제한다.

3. **머지 권한**: main 머지는 계휴(gyehyu)가 GitHub 웹에서 수행. LLM이 직접 머지하지 않고 PR 생성까지만 한다.

## Pages / Demo

**Cloudflare Workers**에서 배포 (Netlify → Cloudflare 이전 완료).

- Worker 이름: `readinggo`
- Demo URL: `https://readinggo.hyuniverse.workers.dev`
- Demo entrypoint: `docs/readinggo/index.html` (`wrangler.toml` `[assets]` 로 서빙)
- 재배포: `npx wrangler deploy`

## Design System

시각·UI 작업 전 반드시 [`docs/readinggo/DESIGN.md`](./docs/readinggo/DESIGN.md)를 먼저 읽는다. 폰트·컬러·간격·**버튼 위계(1차 솔리드/2차 tonal/3차 텍스트)**·미감 방향이 거기 정의돼 있으며, 사용자 승인 없이 벗어나지 않는다. QA 시 DESIGN.md와 어긋나는 코드를 플래그한다. (근거: `/design-consultation`, #838)
