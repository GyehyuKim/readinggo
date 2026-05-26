# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

This is a course project folder for **BIZ.69911 — IT경영 특수논제: AI 기반 비즈니스 진화, 전략 및 실습** (KAIST IMMS, Spring 2026, instructor: 이지수).

The project is **ReadingGo** — 독서습관 앱계의 Duolingo. 독서 + 게이미피케이션(스트릭, XP, 소셜)으로 매일 읽게 만드는 앱. 소스 문서는 `docs/` (MANIFESTO, whytree, pitch). 데모 엔트리포인트: `docs/readinggo/index.html` (예정).

## Governance — MANDATORY

Before making any git/PR operation, read and follow **[`CONTRIBUTING.md`](./CONTRIBUTING.md)**. It is the single source of truth for:

- Branch naming (`<owner>/<topic-slug>`, owner ∈ {gyehyu, seungwon, yunji})
- PR size and lifetime rules
- Conventional Commits message format
- Forbidden operations (direct push to main, --force, --no-verify, committing secrets)
- Concurrent work and rebase protocol (web editor stale-base sacrifice zone — §3.4)
- LLM-specific behavior rules (§9)

**Priority on conflict**: `CONTRIBUTING.md` > `CLAUDE.md` > `AGENTS.md` > other docs.

Other agents (Cursor, Continue, Aider) should enter via [`AGENTS.md`](./AGENTS.md) — same governance, same rules.

## Active Workspace Boundaries

- `docs/` — MANIFESTO, whytree, pitch, GitHub Pages 데모
- `old/` — 이전 아이디어 아카이브 (기프타로, GosiOps, 트렌드 패치노트, 찍먹). 읽기 전용.

새 작업은 `docs/` 에만 한다. `old/` 는 레퍼런스 용도로만 열람.

## Stack Lock

근거: [LF: Lock Stack in CLAUDE.md](./docs/lecture-frameworks.md#lf-week9-lock-stack).

- **iOS**: Capacitor로 점진 마이그레이션 (v5.1 결정). Swift/React Native 등 새 네이티브 프레임워크 도입 금지.
- **웹/Phase 0-1**: 정적 HTML/JS (현재) → Phase 1 풀스택은 결정 시 spec PR 경유.
- **데이터**: 책 데이터셋 TSV 포맷 유지 (#90 결정).
- 변경 제안 시 `docs/readinggo-spec.md` spec PR 먼저, 코드 PR 나중 ([LF: Spec only PR](./docs/lecture-frameworks.md#lf-week6-spec-only-pr)).

새 프레임워크/라이브러리/언어 도입 제안이 들어오면 위 룰을 먼저 안내하고 사용자에게 확인.

## Product Principle: SLC > MVP

근거: [LF: SLC > MVP](./docs/lecture-frameworks.md#lf-week6-slc-over-mvp).

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
- Mine session patterns to update CLAUDE.md → invoke /insights (마일스톤마다, 최소 월 1회. 근거: [LF: /insights](./docs/lecture-frameworks.md#lf-week6-insights))

## PR 머지 전 체크리스트

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

GitHub Pages serves from `main /docs`.

- Demo URL: `https://gyehyukim.github.io/glocalx/readinggo/` (예정)
- Demo entrypoint: `docs/readinggo/index.html` (예정)
