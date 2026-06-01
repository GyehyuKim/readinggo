# AGENTS.md — AI Agent Instructions for ReadingGo / GlocalX

> **Source-of-truth**: [`CLAUDE.md`](./CLAUDE.md) — Claude Code가 로드하는 주 파일.
> Cursor, Gemini CLI, Aider, Continue 등 다른 툴은 이 파일을 통해 진입하되,
> 상세 규칙은 모두 CLAUDE.md를 따른다. 두 파일이 충돌하면 CLAUDE.md가 이긴다.

---

## 프로젝트 개요

- **코스**: KAIST IMMS BIZ.69911 — AI 기반 비즈니스 진화, 전략 및 실습 (2026 Spring, 이지수 교수)
- **현재 서브프로젝트**: **ReadingGo** — 독서 습관 앱. Duolingo처럼 매일 읽게 만드는
  스트릭·XP·소셜 게이미피케이션. 데모 진입점: `docs/readinggo/index.html`
- **팀**: 4명 (김계휴 Dev/Tech, 김경문 GTM, 이승원 Marketing, 정윤지 AX)
- **언어**: 한국어 기본. 코드 식별자만 영어.

---

## 필수 준수 문서 (우선순위 순)

1. **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — 브랜치 네이밍, PR 규칙, 커밋 메시지,
   금지 사항, LLM 행동 규칙(§9). **단일 진실 소스.**
2. **[`CLAUDE.md`](./CLAUDE.md)** — Stack Lock, SLC 원칙, Health Stack, 데모 아키텍처.
3. **[`docs/readinggo/CLAUDE.md`](./docs/readinggo/CLAUDE.md)** — 데모 디렉토리 전용
   가이드. TSV 스키마, 파일 구조, 아키텍처 메모.

우선순위 (충돌 시): `CONTRIBUTING.md` > `CLAUDE.md` > `AGENTS.md` > 기타

---

## 컴파운드 루프 — 이 프로젝트의 작업 방식

에이전트는 단발 실행이 아니라 **루프**로 작동한다. 매 작업은 다음 작업을 더 스마트하게 만든다.

```
Plan  →  Work  →  Review  →  Compound
 ↑                               |
 └───────────────────────────────┘
```

| 단계 | 에이전트의 역할 |
|------|----------------|
| **Plan** | 컨텍스트 수집 → 상세 계획 작성. "지금 모델 창에 무엇이 필요한가?" 를 묻는다. |
| **Work** | 계획 실행 + 테스트 작성. 계획 외 변경은 사용자에게 묻는다. |
| **Review** | 결과물 검증. 오류·예외 케이스·스펙 미정렬을 기록. |
| **Compound** | **고장 → 파일 업데이트.** 같은 실수가 반복되면 이 파일 또는 CLAUDE.md에 규칙으로 추가. |

> **핵심 습관**: 에이전트가 잘못된 가정으로 실수했다면, 대화 종료 전에 해당 교훈을
> CLAUDE.md 또는 이 파일에 한 줄 규칙으로 남긴다. 같은 실수는 두 번 없다.

---

## 자주 하는 작업과 출발점

| 작업 | 시작 파일 |
|------|-----------|
| 데모 UI 수정 | `docs/readinggo/index.html`, `docs/readinggo/js/*.js` |
| 책 데이터 추가 | `docs/readinggo/data/books.tsv` — 코드 수정 불필요 |
| 스펙 작성/수정 | `docs/readinggo/specs/<feature>.md` (코드 PR 전에 먼저) |
| 스펙 정합성 검사 | `python tests/spec-align/nest.py` |
| Markdown 린트 | `npx -y markdownlint-cli2` |
| 서버 실행 (로컬) | `python -m http.server 3000` (docs/readinggo/ 에서) |

---

## 워크플로 최소 요구사항

```bash
# Google Drive 이슈 선제 처리 (필수 — git 명령 전 항상)
find .git -name "desktop.ini" -type f -delete

# 브랜치: <owner>/<topic-slug>  (owner ∈ {gyehyu, seungwon, yunji})
git checkout -b yunji/feature-name

# 커밋 (Conventional Commits)
git commit -m "feat: 무엇을 왜"

# PR 생성 (머지는 gyehyu가 GitHub 웹에서)
gh pr create --title "..." --body "..."
```

**금지**: `main` 직접 push · `--force` · `--no-verify` · 시크릿 커밋 ·
새 프레임워크/라이브러리 무단 도입 (Stack Lock 위반)

---

## 스택 & 아키텍처 (Phase 0)

- **프론트엔드**: 정적 HTML/JS + React 18 CDN + Babel standalone. 빌드 도구 없음.
- **크로스 파일 공유**: `window.X = X` 패턴. ES modules 없음.
- **책 데이터**: `data/books.tsv` (542권, TSV, UTF-8). 코드 하드코딩 금지.
- **배포**: GitHub Pages (`main /docs`).
- **Stack Lock**: Swift, React Native, Vite, TypeScript 등 신규 도입 금지.
  제안 시 spec PR 먼저, 코드 PR 나중.

---

## 에이전트 행동 규칙

- **단정하지 말 것**: 비즈니스 의사결정·숫자 추산은 임의로 채우지 않고 묻는다.
- **SLC 기준 적용**: 새 기능은 "lovable한가? 이번 주에 complete할 수 있나?" 로 평가.
  ugly but functional(MVP)보다 small but delightful(SLC).
- **스펙 PR 먼저**: 코드보다 설계가 먼저. `specs/<feature>.md` 없이 큰 기능 구현 금지.
- **한국어 응답**: 사용자가 영어로 쓰지 않는 한 한국어로 답한다.
- **과분할 금지**: 1 PR = 1 논리 단위. 관련 변경을 여러 PR로 쪼개지 않는다.
- **고장 → 파일 업데이트**: 새 quirk·실수 패턴 발견 시 이 파일 또는 CLAUDE.md에 기록.

---

## 환경 특이사항 (Windows + Google Drive)

- **플랫폼**: Windows 11, bash shell, repo가 **Google Drive 동기화 폴더** 안에 있다.
- **desktop.ini 문제**: Drive가 `.git/` 내부에 자동 생성 → `git pull`/`fetch` 깨짐.
  **git 명령 전 반드시**: `find .git -name "desktop.ini" -type f -delete`
- **경로 공백·한글**: 폴더명에 한글·공백 있음. 경로는 항상 따옴표로 감싼다.

---

자세한 규칙·예시·과거 사고 기록은 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 참조.
