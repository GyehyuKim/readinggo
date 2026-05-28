# Spec Alignment Verifiers

> **목적**: 분할된 spec (`docs/readinggo/specs/`) 의 *핵심 invariant* 가 코드(`docs/readinggo/js/`) 에서 발견되는지 자동 검사.
> **근거**: [LF: Living Document](../../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week9-living-document) + [LF: /goal Measurable + Uncorrectable](../../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-goal-measurable).

## 설계 원칙

- **Presence checks**, 동작 정확도 아님. 컴포넌트·상수·시그너처가 존재하는지 *grep* 수준 확인.
- **모델 외부 verifier**. Ralph loop이 자기 검증 못 하도록 ([LF: Goodhart](../../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-goodhart)).
- **exit 0/1**. 통과/실패 명확. 부분 통과는 stderr WARN 로 보고하되 exit는 binary.
- 동작 검증은 E2E (`tests/e2e/scenario-*.md`) 가 담당.

## 사용

```bash
python tests/spec-align/nest.py    # nest 영역
python tests/spec-align/drift.py   # drift defense (CI workflow 존재 검증)
```

## Loop 통합

`loop/*/PROMPT.md` 의 `Exit:` 문에서 이 verifier 를 호출.

## 추가 규칙

새 spec 영역 verifier 추가 시:
1. `tests/spec-align/<feature>.py` 작성. 핵심 invariant 5~10개.
2. 각 invariant 는 *spec 절 번호 + 기대 패턴*  형태로 코드에 주석 인용.
3. 실패 메시지는 *어느 파일·줄에 무엇이 빠졌는지* 인간 가독.
