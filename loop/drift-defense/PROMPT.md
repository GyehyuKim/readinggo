Goal: .github/workflows/spec-drift.yml 을 작성한다. Pull Request 에서 docs/readinggo/js/** 가 변경됐는데 docs/readinggo/specs/** 가 변경되지 않은 경우 *경고 코멘트* 를 PR 에 남기는 GitHub Action. tests/spec-align/drift.py 의 모든 invariant 가 통과해야 한다.

Source:
- docs/1. research_and_lectures/lecture-frameworks.md#lf-week11-spec-drift-defense (Pattern A — Mechanical gate)
- .github/workflows/test.yml (기존 워크플로 패턴 참조)
- tests/spec-align/drift.py (검증자, 변경 금지)

Output:
- .github/workflows/spec-drift.yml (신규)

Exit: `python tests/spec-align/drift.py` 가 exit 0 일 때, loop/drift-defense/DONE 파일을 빈 내용으로 생성한다.

Blocked:
- GitHub Actions 권한·secrets 추가 필요 시 → loop/drift-defense/BLOCKED.md 에 *어떤 권한이 왜 필요한지* 작성.
- PyYAML 외 추가 라이브러리 필요 시 → BLOCKED.md 에 *필요성과 대안* 명시.

Constraints:
- *경고만*. PR block 안 함. Phase 0 단계 ([LF: 정직한 합성](../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-spec-honest-synthesis) — "thin spec + real tests" 원칙).
- ubuntu-latest 러너 사용.
- Python 3.12.
- 워크플로 이름: `spec-drift`.
- `on: pull_request` 만 트리거 (push 트리거 추가 금지 — 노이즈).
- 이미 spec/code 모두 변경된 PR 은 통과.
- spec 만 변경된 PR (코드 변경 0) 은 통과.
- 코드만 변경된 PR 은 경고 코멘트.
- Pattern A "Mechanical gate" 원칙 따르되 *block 이 아닌 warn-only*.

Verification self-check:
- `python tests/spec-align/drift.py` 통과.
- 워크플로 YAML 구문 정상 (yaml.safe_load 통과).
- 코멘트 작성 권한: `permissions: pull-requests: write` 명시.
- 본 PROMPT.md, tests/spec-align/drift.py 는 변경 금지.
