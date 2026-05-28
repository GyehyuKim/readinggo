# CONTRIBUTING — GlocalX 협업 규칙

이 파일은 **사람과 LLM 모두가 준수해야 하는 단일 규범**이다. Claude Code, Cursor, Copilot 등
어떤 AI 도구를 쓰든 여기 적힌 브랜치/PR/커밋 규칙을 예외 없이 따라야 한다.

팀 구성과 배경은 [`docs/MANIFEST.md`](./docs/MANIFEST.md), 문서 읽기 순서는 그 하단의 Reading Order 참조.

---

## 1. 브랜치 네이밍 (필수)

형식: **`<owner>/<topic-slug>`**

정규식: `^(gyehyu|gyeongmun|seungwon|yunji)/[a-z0-9]+(-[a-z0-9]+)*$`

- `owner` — 작업자의 고정 slug. 4명 외 금지.
  | 사람 | slug |
  |---|---|
  | 김계휴 | `gyehyu` |
  | 김경문 | `gyeongmun` |
  | 이승원 | `seungwon` |
  | 정윤지 | `yunji` |
- `topic-slug` — kebab-case, 3~40자, 무슨 일인지 한눈에 보이게.

**좋은 예**
- `gyehyu/ai-pipeline-fix`
- `gyeongmun/interview-screening-criteria`
- `seungwon/whytree-marketing-refresh`
- `yunji/premortem-ax-risks`

**나쁜 예 (금지)**
- `patch-1`, `jerome3354-patch-9`, `update` — 의미 없음
- `fix/whytree` — owner 없음
- `gyehyu/WhyTree_Update` — PascalCase/underscore 금지
- `feat/biz-plan-restructure` — owner 없음, type-prefix는 사용 안 함

> GitHub 웹 에디터의 "Edit" → "Commit directly to a new branch"는 기본값이
> `<username>-patch-N`으로 나온다. **반드시 "branch name" 필드를 위 규칙대로 수정**한 뒤 커밋한다.

---

## 2. 브랜치 수명 (필수)

- **이상**: 24시간 이내 머지
- **최대**: 72시간. 그 이상 살리려면 PR 설명에 이유를 적는다.
- **머지 후**: 자동 삭제 비활성화. 각 팀원이 브랜치를 보존하거나 수동 삭제.
- **정리 권장**: 더 이상 필요 없는 브랜치는 PR 닫고 수동 삭제. 과제 기간 중에는 HW 제출 브랜치를 보존 권장.

---

## 3. 동시 작업과 충돌 방지 (핵심)

파일 소유권을 나누지 않는다. 대신 **"머지 전 base 최신화"** 규칙으로 충돌을 물리적으로 차단한다.

### 3.1 작업 시작 시
```bash
git checkout main
git pull origin main
git checkout -b <owner>/<topic-slug>
```

### 3.2 작업 중 main이 움직였다면 (PR 열기 전)
```bash
git fetch origin
git rebase origin/main
# 충돌 해결 후
git push --force-with-lease    # 새 브랜치만, main/공유 브랜치에는 절대 금지
```
> `--force-with-lease`는 원격이 내가 본 상태와 같을 때만 강제 푸시한다. 순수 `--force`는 금지.

### 3.3 PR 연 뒤 다른 PR이 먼저 머지됐다면
두 가지 중 하나:
- **GitHub UI**: PR 페이지 하단의 `Update branch` 버튼 클릭 (merge commit 방식)
- **로컬**: 위 3.2와 동일하게 rebase 후 force-with-lease push (히스토리 깔끔)

둘 중 하나를 **반드시** 수행한 뒤에 머지한다. 안 하면 GitHub 브랜치 보호 규칙이 막는다 (§7 참조).

### 3.4 웹 에디터 사용자 주의 (⚠️ 과거 사고 지점)

GitHub 웹 에디터는 편집 세션 중 base 브랜치 변경을 자동 감지하지 않는다. 한참 창을 열어둔 채
다른 PR이 머지되면, 저장 시 **조용히 덮어쓴다**. 실제로 이 프로젝트에서 WHYTREE 메타 헤더 회귀
사고가 두 번 발생했다.

**웹 에디터 사용자는 반드시 아래를 지킨다:**
1. 편집 시작 전에 항상 파일 URL을 새로고침해서 가장 최신 커밋 기준인지 확인한다.
2. 한 번에 하나의 파일만 편집한다. 브라우저 탭을 30분 이상 열어두지 않는다.
3. 커밋하기 전에 Preview 탭에서 diff를 눈으로 확인한다. 내가 지웠던 줄이 살아나 있으면 절대 저장하지 않는다.
4. 헷갈리면 저장하지 말고 팀에 물어본다.

**CLI가 익숙하지 않으면 Claude Code/Cursor에게 시키는 것이 웹 에디터보다 훨씬 안전하다.**

---

## 4. PR 단위

- **1 PR = 1 논리 단위.** 관련 없는 변경을 섞지 않는다.
- **권장 상한**: 변경 파일 ≤ 5개, 순증 라인 ≤ 300줄. 초과하면 나누는 게 거의 항상 낫다.
- **예외**: 단일 대형 문서(business-plan.html 같은) 1회 개편, 자동 생성 파일 (lock, 데이터셋) — PR 설명에 이유 적기.
- **과분할도 금지**: 같은 하루에 동일 파일을 여러 PR로 쪼개 머지하면 히스토리 오염. 묶을 수 있으면 묶는다.

### 4.1 Spec PR과 코드 PR 분리

근거: [LF: Spec only PR](./docs/1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr) + [LF: Spec-first Workflow](./docs/1. research_and_lectures/lecture-frameworks.md#lf-week9-spec-first-workflow).

- **spec 파일(`docs/readinggo/specs/**/*.md`, `docs/2. specifications/readinggo-feature-spec.md`, `docs/readinggo/{BACKLOG,ROADMAP,iOS-PLAN,COMPETITIVE-ANALYSIS}.md`)과 구현 코드(`docs/readinggo/index.html`, `docs/readinggo/js/*` 등)를 같은 PR에 묶지 않는다.**
- 순서: spec 변경 → spec-only PR → 팀이 머지·합의 → 별도 PR로 구현.
- **이유**: Week 9 강의 점수표에서 14팀 중 13팀이 *코드+스펙 묶음 PR*로 처방을 어겼다. 묶음 PR은 (a) spec 합의가 코드 머지에 인질잡힘 (b) 다른 팀원이 spec만 보고 리뷰할 수 없음.
- **예외**: 같은 PR 안에서 spec과 코드가 *동시에 결정되어야 하는* 작은 변경 (예: 데이터 스키마 + 그 스키마 쓰는 한 함수). 예외 시 PR 설명에 이유 기록.

**살아있는 spec 의무**: 구현 중 가정이 틀렸음·예상보다 어려움·예측 못 한 사용자 행동을 발견하면 *spec commit*으로 먼저 반영. 코드 commit이 아니다. 근거: [LF: Living Document](./docs/1. research_and_lectures/lecture-frameworks.md#lf-week9-living-document).

---

## 5. 커밋 메시지

[Conventional Commits](https://www.conventionalcommits.org/) 스타일.

형식: `<type>: <subject in Korean or English>`

| type | 용도 |
|---|---|
| `feat` | 새 기능/콘텐츠 추가 |
| `fix` | 버그/오류 수정 |
| `docs` | 문서 편집 (MD, HTML 문서) |
| `chore` | 빌드/설정/청소 (.gitignore, 파일 이동 등) |
| `data` | 데이터셋 추가/갱신 |
| `refactor` | 동작 변경 없는 구조 개선 |

**예**
```
docs: Add field evidence to business-plan Summary
feat: Add GlocalX AI pipeline PoC (Gemini multimodal)
chore: Move validation screenshots to 90. Internal/etc/
```

본문(선택)은 **왜** 바꿨는지 1~3줄. 무엇을 바꿨는지는 diff가 말해준다.

---

## 5.5 작업 우선순위 레이블

TODOS.md 항목, 스펙 문서(`docs/spec-*.md`), PR 설명에 아래 레이블을 명시한다.

| 레이블 | 의미 | 판단 기준 |
|---|---|---|
| **P0** | 데모 전 반드시 완료 (ship blocker) | 없으면 데모가 무너지는 것 |
| **P1** | 시간 허용 시 완료 (nice to have) | 있으면 좋지만 데모는 돌아감 |
| **P2** | 미래 작업 (post-demo / MVP 이후) | 지금 건드리면 오히려 리스크 |

**사용 예**

```
## P0 — 데모 전 필수
- [ ] 파트너 스토어 3곳 실명 거짓 양성 없음 확인

## P1 — 시간 허용 시
- [ ] 응답 타임아웃 설정 (timeout=60)

## P2 — 미래
- [ ] GBP API 직접 푸시
```

레이블 없는 항목은 **P1**으로 간주한다.

---

## 6. 절대 금지 사항

- `main`에 직접 push. 모든 변경은 PR 경유.
- `git push --force` (순수 force). `--force-with-lease`만 허용, 그것도 내 브랜치 한정.
- `git commit --no-verify` — 훅을 스킵하지 않는다. 훅이 실패하면 근본 원인을 고친다.
- `git rebase -i` 로 이미 원격에 올라간 공유 브랜치 재작성.
- `git checkout --orphan` — 브랜치 히스토리를 초기화하는 명령. 새 작업은 반드시 `main`에서 새 브랜치를 따는 방식으로 시작한다.
- **GitHub Fork** — 팀원 4명 모두 `GyehyuKim/glocalx` 원본 repo에 직접 push 권한 보유. Fork 기반 워크플로우 사용 금지. 모든 브랜치는 원본 repo에 직접 생성한다.
- `.env`, API 키, 비밀번호 커밋. `.gitignore`에 `.env` 등록되어 있으나 복사본도 금지.
- 실제 점주/고객 개인정보(이름, 연락처, 주소)를 평문으로 저장. 필요 시 익명화.

---

## 7. 브랜치 보호 규칙 (repo 설정)

`main` 브랜치에 다음을 설정한다. 사고 재발 방지의 시스템적 방어선이다.

- [x] Require a pull request before merging
- [x] Require approvals: 1 (자기 PR 자기 승인 금지는 팀 규모상 제외)
- [x] **Require branches to be up to date before merging** ← 핵심. 웹 에디터 stale-base 사고 차단.
- [ ] Automatically delete head branches (비활성화 — 팀원 브랜치 보존)
- [ ] Require status checks to pass — CI 없음, 미사용
- [x] Do not allow bypassing the above settings

Settings → Branches → `main` 에서 설정.

---

## 8. Google Drive 환경 이슈

이 repo는 Google Drive 동기화 폴더 안에 있다. Google Drive 데스크톱 클라이언트가 `.git/refs/`,
`.git/objects/` 등에 **`desktop.ini` 파일을 자동 생성**하여 `git pull`/`git fetch`가 깨지는
문제가 반복 발생한다 (`fatal: bad object refs/remotes/.../desktop.ini`).

### 응급 복구
```bash
find .git -name "desktop.ini" -type f -delete
git fetch --prune
```

### 권장 운영
- 모든 git 명령 **전후**에 위 삭제 명령을 실행하는 습관.
- 장기적으로는 repo를 Google Drive 밖으로 옮기는 것이 근본 해결. (과제 제출 특성상 당분간 유지)

---

## 9. LLM 행동 규칙 (Claude Code · Cursor · 기타)

이 섹션은 AI 도구가 이 프로젝트에서 코드/문서 작업을 대신 수행할 때 **예외 없이** 따라야 하는
규칙이다. 사용자가 위 섹션을 읽히지 않았더라도 LLM은 여기 적힌 내용을 자동 강제한다.

1. **브랜치 생성 시 반드시 §1 네이밍 규칙을 따른다.** owner slug를 모르면 사용자에게 묻고 진행.
   임의로 `feat/`, `fix/` 등 type prefix를 쓰지 않는다.
2. **`main`에 직접 커밋/푸시하지 않는다.** 항상 feature 브랜치 → PR 경유.
3. **브랜치를 생성하기 전에 `git pull origin main`으로 최신화**한다.
4. **PR 생성 전에 `git fetch origin && git rebase origin/main`**을 시도한다. 충돌이 발생하면
   사용자에게 보고하고 임의로 해결하지 않는다.
5. **`git push --force` 금지.** 필요 시 `--force-with-lease` 사용. main에는 어떤 force도 금지.
6. **`--no-verify`, `--no-gpg-sign`, hook bypass 금지.** 훅 실패는 근본 원인을 고친다.
7. **PR 단위는 §4를 따른다.** 변경 파일이 5개를 넘거나 순증 300줄을 넘으면 사용자에게 분할
   여부를 묻는다.
8. **커밋 메시지는 §5 Conventional Commits를 따른다.**
9. **Google Drive 문제**: git 명령 실행 전 `find .git -name "desktop.ini" -type f -delete`를
   선제 실행한다. 에러 메시지에 `desktop.ini`가 보이면 먼저 이 정리부터 한다.
10. **비밀정보**: `.env`, API 키, 점주/고객 개인정보를 절대 커밋하지 않는다. 사용자가 채팅에
    실수로 붙여넣은 경우에도 파일에 쓰지 않는다.
11. **파일 소유권은 없지만**, 동일 파일을 편집하는 타인의 open PR이 있는지 `gh pr list`로
    먼저 확인한다. 충돌 가능성이 보이면 사용자에게 보고.
12. **과거 사고 패턴**: WHYTREE 메타 헤더·PREMORTEM 정렬은 과거 회귀 사고가 있었던 지점이다.
    이 두 파일을 편집할 때는 편집 전후의 diff를 특히 주의 깊게 검토한다.
13. **`git checkout --orphan` 절대 금지.** 세션 시작 시 `git log --oneline -1`로 현재 브랜치가
    정상 커밋을 갖는지 확인한다. 실패하면 즉시 사용자에게 보고하고 임의로 수정하지 않는다.
14. **Fork 금지.** 모든 브랜치는 `GyehyuKim/glocalx` 원본 repo에 직접 생성한다.
15. **v5급 결정 전 적대적 리뷰 — 권장 (강제 아님).** spec 메이저 개편·아키텍처 결정·데모 차단 가능성 있는 변경 전에는 *적대적 리뷰*를 **사용자에게 제안**한다. 가용 도구가 있으면 codex/gemini 3회 리뷰 (`/codex challenge`, `/ccg` 등), 없으면 Claude 자체 self-critique 또는 팀 동료 리뷰로 대체 가능. 팀원마다 LLM 구독이 다르므로 도구를 강요하지 않는다. 사용자가 "skip" 결정하면 패스 — 단, 결정 사항을 PR 설명에 기록. 근거: [LF: 3-Round Adversarial Review](./docs/1. research_and_lectures/lecture-frameworks.md#lf-week9-adversarial-review).
16. **Spec/코드 PR 분리 (§4.1).** spec 파일과 구현 코드를 같은 PR에 묶지 않는다. spec PR이 먼저, 코드 PR이 나중. 묶어야 할 사유가 있으면 PR 설명에 명시.
17. **Stack Lock 준수.** `CLAUDE.md` Stack Lock 절에 명시된 결정 (iOS=Capacitor, 데이터=TSV 등) 외 프레임워크/라이브러리 도입 제안 시 사용자에게 먼저 확인. 임의 도입 금지. 근거: [LF: Lock Stack](./docs/1. research_and_lectures/lecture-frameworks.md#lf-week9-lock-stack).

모순이 생기면 **이 `CONTRIBUTING.md` > `CLAUDE.md` > `AGENTS.md` > 기타**의 우선순위를 따른다.

---

## 10. 체크리스트 (PR 제출 전)

제출자 스스로 체크:

- [ ] 브랜치 이름이 `<owner>/<topic-slug>` 형식인가?
- [ ] `main`과 rebase/merge로 최신 상태인가?
- [ ] 변경이 논리적으로 하나의 단위인가?
- [ ] 커밋 메시지가 Conventional Commits 형식인가?
- [ ] `.env`, API 키, 개인정보가 포함되지 않았는가?
- [ ] PR 제목과 본문이 **왜** 바꾸는지 한 문장으로 설명하는가?
