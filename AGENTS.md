# AGENTS.md — AI Agent Instructions for ReadingGo

이 파일은 **Cursor, Continue, Aider, Windsurf** 등 AGENTS.md 표준을 따르는 코딩 에이전트를 위한
진입점이다. Claude Code는 `CLAUDE.md`를 우선 로드하지만, 동일 규범을 참조하도록 이 파일도
동기화되어 있다.

> repo: `GyehyuKim/readinggo` (구 `glocalx` — 이전 프로젝트 GlocalX에서 피벗 후 2026-06 리네임). **프로젝트명 = ReadingGo.**

---

## 필수 준수 문서

이 프로젝트에서 작업하는 모든 AI 에이전트는 **작업을 시작하기 전에** 다음 문서를 읽고 준수해야 한다:

1. **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — 브랜치 네이밍, PR 규칙, 커밋 메시지, 금지 사항,
   LLM 행동 규칙(§9). **이것이 단일 진실 소스.**
2. **[`CLAUDE.md`](./CLAUDE.md)** — Claude Code 전용 보조 지침 + Stack Lock + Pages. 다른 에이전트도 참고.
3. **[`docs/readinggo/specs/README.md`](./docs/readinggo/specs/README.md)** — ReadingGo 스펙 인덱스 (v18). 용어 사전(§0.5)·Phase(§3)·파일 변경 조율.

우선순위 (모순이 있을 때): `CONTRIBUTING.md` > `CLAUDE.md` > `AGENTS.md` > `specs/README.md` > `DESIGN.md` > `ROADMAP.md` > 기타 문서.

---

## 프로젝트 개요 (1분 요약)

- **코스**: KAIST IMMS BIZ.69911 — IT경영 특수논제: AI 기반 비즈니스 진화, 전략 및 실습 (2026 Spring, 이지수 교수)
- **프로젝트**: **ReadingGo** — "하루 한 페이지, 한 문장"의 낮은 마찰로 독서를 이어가는 독서 습관 앱. 타겟: *읽고 싶은데 이어가지 못하는 사람*.
- **v18 목표**: 3번째 탭은 네 책 상태를 하나의 연속 흐름에서 검색·필터·정렬하는 **서재**다. 기존 카드는 유한 가로 `scroll-snap` 레일로 빠르게 넘긴다. 4번째 탭은 **프로필**을 유지하고 사용자 로컬 페이지 세션·내 문장 저장일을 월간 활동 캘린더와 비징벌적 연속일로 보여준다.
- **제품 경계**: 3번째 탭은 서재, 4번째 탭은 프로필·개인 활동이다. XP·둥지·성·방패·하루 만회는 복원하지 않는다. 책·문장·진도·세션·위시·최근 14일 리듬·누적 성장일·공개범위·RLS 안전 계약은 유지한다.
- **형태**: **Capacitor 채택**(런칭 결정, 2026-06) — 같은 React 코드베이스로 **웹·iOS·Android 동시 출시**. 빌드 = **Vite 전환 완료**(#871). Phase 0 데모(현행) → Phase 1 Supabase. *이전 web-first·Capacitor Phase 3 보류는 해제* (`CLAUDE.md` Stack Lock · `iOS-PLAN.md`).
- **협업자 (dev 3인)**: maintainer 김계휴(`gyehyu`), contributor 이승원(`seungwon`)·정윤지(`jyj23-jeong`, actor slug `yunji`). 파일·기능별 고정 담당은 없으며, 세 사람은 사전에 합의된 이슈 범위에서 자기 actor slug 브랜치로 구현·PR한다. 감독 게이트를 통과한 PR은 승인 contributor·Hermes도 `main`/DEV까지 merge할 수 있고, Production 승격은 김계휴만 수행한다.
- **주요 산출물**: `docs/readinggo/` (현행 데모), `docs/readinggo/specs/` (피처별 spec, v18 목표와 레거시 as-built 분리).
- **언어**: 모든 커뮤니케이션과 문서는 **한국어**가 기본. 코드 식별자만 영어.

---

## 자주 하는 작업과 출발점

| 작업 | 시작 파일 |
|---|---|
| 스펙 전체 지도 | `docs/readinggo/specs/README.md` |
| 데이터 모델 · DataStore 계약 | `docs/readinggo/specs/backend.md` |
| 서재·개인 활동 방향 | `docs/readinggo/specs/profile.md` |
| 홈·독서 기록과 레거시 XP·스트릭 경계 | `docs/readinggo/specs/home-reading.md`, `systems.md` |
| 같이읽기 | `docs/readinggo/specs/co-reading.md` |
| 소셜·공개범위 | `docs/readinggo/specs/social.md`, `feed.md`, `profile.md` |
| 데모 코드 | `docs/readinggo/index.html` + `docs/readinggo/js/*` |
| 도서 데이터 | **canonical = Supabase `books`** (#490). `loadBooks()` Supabase 1순위·게스트 anon RLS read. 구 정적 `books.tsv`는 제거됨(#972) — 폴백은 인라인 `RG_BOOKS`(12) 최소치. 어느 단계든 책 정보 하드코딩 금지 |
| 결정 이력 | `docs/readinggo/specs/meta/decisions.md` |

---

## 워크플로 최소 요구사항 (상세는 CONTRIBUTING.md)

```bash
# 0. (Google Drive) git 명령 전 항상
find .git -name "desktop.ini" -type f -delete

# 1. 최신화
git checkout main && git pull origin main

# 2. 브랜치 생성 (actor slug: gyehyu/*, seungwon/*, yunji/*)
git checkout -b gyehyu/example-topic

# 3. 편집 및 커밋 (Conventional Commits)
git add <files>
git commit -m "docs: 왜 바꿨는지 한 문장"

# 4. push 전 항상 (조건 없이 — 그 사이 머지된 PR이 있을 수 있다. CONTRIBUTING §3.0)
git fetch origin && git rebase origin/main

# 5. 푸시 + PR (필수 CI green 뒤 감독 게이트를 통과하면 main merge·stable DEV 검증)
#    PR 본문에 관련 이슈 연결: Closes #N(완료) / Refs #N(관련) — CONTRIBUTING §4.2
#    작업 중 발견한 새 일은 이슈로 (§4.3 형식)
git push -u origin gyehyu/example-topic
gh pr create --title "..." --body "..."
```

**금지**: `main` 직접 push · `git push --force` · `--no-verify` · `.env`/API 키 커밋 ·
임의 `feat/`·`fix/` type-prefix 브랜치 · **spec과 코드를 한 PR에 묶기** (CONTRIBUTING §4.1).

**Stack Lock**: 플랫폼 = **Capacitor 단일**(RN/Expo/Flutter 등 다른 네이티브 프레임워크 금지), 빌드 = **Vite**. 이 외 **새** 프레임워크/라이브러리 도입 제안 시 사용자에게 먼저 확인. 임의 도입 금지. 상세는 [`CLAUDE.md` Stack Lock](./CLAUDE.md).

**이슈 동기화**: PR은 관련 이슈를 연결(`Closes #N` 완료 / `Refs #N` 관련)하고, 작업 중 발견한 새 일은 이슈로 만든다 (CONTRIBUTING §4.2–4.3).

**운영 권한**: 이슈는 누구나 만들고 의견을 남길 수 있다. 구현 브랜치·코드/스펙 변경·PR 작성은 김계휴/Hermes와 승인 contributor 이승원·정윤지가 사전에 합의된 이슈 범위에서 수행한다. 파일·기능별 고정 담당은 없다. CI green은 자동 머지 승인이 아니며, 감독 게이트를 통과한 PR은 김계휴·Hermes·승인 contributor가 `main`에 merge하고 stable DEV까지 검증할 수 있다. Production 승격은 김계휴만 수행한다 (`CONTRIBUTING.md` §0).

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
  실제 증거 없는 서재 preload/window 수치·달력의 책 대표 규칙·레거시 삭제 순서·페르소나·숫자 추산은 임의로 채우지 않는다.
- **SLC > MVP**: 새 기능은 *Simple·Lovable·Complete* 기준. "다듬은 한 기능 > 반쯤 만든 다섯 개."
- **한국어 응답**: 사용자가 영어로 쓰지 않는 한 한국어로 답한다.

---

자세한 규칙·예시·과거 사고 기록은 `CONTRIBUTING.md`를 참조.
