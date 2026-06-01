# AGENTS.md — AI Agent Instructions for ReadingGo

이 파일은 **Cursor, Continue, Aider, Windsurf** 등 AGENTS.md 표준을 따르는 코딩 에이전트를 위한
진입점이다. Claude Code는 `CLAUDE.md`를 우선 로드하지만, 동일 규범을 참조하도록 이 파일도
동기화되어 있다.

> repo 이름은 역사적 이유로 `GyehyuKim/glocalx` (이전 프로젝트 GlocalX에서 피벗). **현재 프로젝트는 ReadingGo.**

---

## 필수 준수 문서

이 프로젝트에서 작업하는 모든 AI 에이전트는 **작업을 시작하기 전에** 다음 문서를 읽고 준수해야 한다:

1. **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — 브랜치 네이밍, PR 규칙, 커밋 메시지, 금지 사항,
   LLM 행동 규칙(§9). **이것이 단일 진실 소스.**
2. **[`CLAUDE.md`](./CLAUDE.md)** — Claude Code 전용 보조 지침 + Stack Lock + Pages. 다른 에이전트도 참고.
3. **[`docs/readinggo/specs/README.md`](./docs/readinggo/specs/README.md)** — ReadingGo 스펙 인덱스 (v7). 용어 사전(§0.5)·Phase(§3)·파일 소유권.

우선순위 (모순이 있을 때): `CONTRIBUTING.md` > `CLAUDE.md` > `AGENTS.md` > 기타 문서.

---

## 프로젝트 개요 (1분 요약)

- **코스**: KAIST IMMS BIZ.69911 — IT경영 특수논제: AI 기반 비즈니스 진화, 전략 및 실습 (2026 Spring, 이지수 교수)
- **프로젝트**: **ReadingGo** — 독서 습관 앱. "하루 한 페이지, 한 문장"을 게이미피케이션(스트릭·XP·둥지 진화·성 컬렉션)과
  소셜(마을·전체 공개 피드·짹·NPC)로 매일 읽게 만든다. 타겟: *읽고 싶은데 이어가지 못하는 사람*.
- **형태**: **web-first** — Phase 0 정적 웹(데모) / Phase 1 Supabase. **Capacitor·네이티브 앱은 Phase 3으로 보류** (`CLAUDE.md` Stack Lock).
- **팀 (dev 3인)**: 김계휴(`gyehyu`, 백엔드·소셜·내서재), 이승원(`seungwon`, 둥지·XP·디자인), 정윤지(`yunji`, 마을).
- **주요 산출물**: `docs/readinggo/` (Phase 0 데모), `docs/readinggo/specs/` (피처별 spec, v7).
- **언어**: 모든 커뮤니케이션과 문서는 **한국어**가 기본. 코드 식별자만 영어.

---

## 자주 하는 작업과 출발점

| 작업 | 시작 파일 |
|---|---|
| 스펙 전체 지도 | `docs/readinggo/specs/README.md` |
| 데이터 모델 · DataStore 계약 | `docs/readinggo/specs/backend.md` |
| 둥지·XP·스트릭 규칙 | `docs/readinggo/specs/nest.md`, `systems.md` |
| 마을 | `docs/readinggo/specs/village.md` |
| 소셜·내서재 | `docs/readinggo/specs/social.md`, `profile.md` |
| 데모 코드 | `docs/readinggo/index.html` + `docs/readinggo/js/*` |
| 도서 데이터 | `docs/readinggo/data/books.tsv` (유일 소스, 하드코딩 금지) |
| 결정 이력 | `docs/readinggo/specs/meta/decisions.md` |

---

## 워크플로 최소 요구사항 (상세는 CONTRIBUTING.md)

```bash
# 0. (Google Drive) git 명령 전 항상
find .git -name "desktop.ini" -type f -delete

# 1. 최신화
git checkout main && git pull origin main

# 2. 브랜치 생성 (규칙: <owner>/<topic-slug>, owner ∈ {gyehyu, seungwon, yunji})
git checkout -b gyehyu/example-topic

# 3. 편집 및 커밋 (Conventional Commits)
git add <files>
git commit -m "docs: 왜 바꿨는지 한 문장"

# 4. push 전 항상 (조건 없이 — 그 사이 머지된 PR이 있을 수 있다. CONTRIBUTING §3.0)
git fetch origin && git rebase origin/main

# 5. 푸시 + PR (머지는 계휴가 GitHub 웹에서)
git push -u origin gyehyu/example-topic
gh pr create --title "..." --body "..."
```

**금지**: `main` 직접 push · `git push --force` · `--no-verify` · `.env`/API 키 커밋 ·
임의 `feat/`·`fix/` type-prefix 브랜치 · **spec과 코드를 한 PR에 묶기** (CONTRIBUTING §4.1).

**Stack Lock**: 새 프레임워크/라이브러리 도입(Capacitor 재도입, Vite 전환 등) 제안 시 사용자에게 먼저 확인. 임의 도입 금지.

---

## 환경 특이사항

- **플랫폼**: Windows 11, bash shell, repo는 **Google Drive 동기화 폴더 안**에 있다.
- **Google Drive 이슈**: `.git/` 내부에 `desktop.ini`가 자동 생성되어 `git pull`/`fetch`를
  깨뜨리는 문제가 반복된다. git 명령 실행 **전에 항상** `find .git -name "desktop.ini" -type f -delete`.
- **경로 공백**: 폴더명에 한글과 공백이 많다 (`20. KAIST-IMMS`, `41. Project` 등).
  반드시 따옴표로 감싸라.

---

## 에이전트 작업 스타일

- **과분할 금지**: 관련된 변경을 과도하게 쪼개 PR 여러 개를 만들지 말 것. 1 PR = 1 논리 단위.
- **단정하지 말 것**: 프로젝트 맥락이 불충분하면 사용자에게 묻는다. 특히 제품 의사결정,
  게임 메카닉(XP·둥지·성), 페르소나, 숫자 추산은 임의로 채우지 않는다.
- **SLC > MVP**: 새 기능은 *Simple·Lovable·Complete* 기준. "다듬은 한 기능 > 반쯤 만든 다섯 개."
- **한국어 응답**: 사용자가 영어로 쓰지 않는 한 한국어로 답한다.

---

자세한 규칙·예시·과거 사고 기록은 `CONTRIBUTING.md`를 참조.
