# Loop — Ralph harness scaffolding

> **근거**: [LF: Ralph Wiggum Loop](../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-ralph-loop) + [LF: PROMPT.md 4규칙](../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-promptmd-rules) + [LF: /goal Measurable + Uncorrectable](../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-goal-measurable)

## 구조

```
loop/
├── README.md                 # 이 파일
├── <feature>/
│   ├── PROMPT.md             # 원자 작업 정의 (tracked)
│   ├── DONE                  # 성공 시 생성 (gitignored)
│   └── BLOCKED.md            # 진행 불가 시 생성 (gitignored)
```

## PROMPT.md 4규칙 (Week 11 p.54)

1. **원자적 단일 작업** — 한 명확한 골
2. **디스크 상 source 참조** — 입력 파일 경로 명시
3. **파일 기반 exit** — `DONE` 파일 생성으로 종료
4. **파일 기반 recovery** — 진행 불가 시 `BLOCKED.md` 작성

## 사용법

### 사용자 (수동 트리거)

oh-my-claudecode 설치 후:

```bash
# 한 번 실행
cat loop/nest-align/PROMPT.md | claude

# 또는 ralph-loop 명령 (DONE 파일 생길 때까지 반복)
/ralph-loop loop/nest-align/PROMPT.md
```

### 검증자 (모델 외부)

각 PROMPT.md 의 `Exit:` 문은 *모델이 안 쓴* Python verifier 를 가리킴:

| Loop | Verifier |
|---|---|
| `nest-align` | `tests/spec-align/nest.py` |
| `drift-defense` | `tests/spec-align/drift.py` |

verifier exit 0 → DONE 파일 작성. exit 1 → 다음 iteration.

## 현재 loop 목록

- [`nest-align/`](./nest-align/) — `nest.js` 와 `nest.md` 정합. Phase 0 데모 핵심 경로.
- [`drift-defense/`](./drift-defense/) — Spec drift GitHub Action. Pattern A (Mechanical gate), warn-only.

## 주의

- *greenfield 전용*. 프로덕션·`main` 브랜치에 직접 돌리지 말 것 ([LF: PROMPT.md 4규칙](../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-promptmd-rules) 금기).
- 새 loop 만들 때마다 PROMPT.md 작성 + verifier 추가.
- `DONE`/`BLOCKED.md` 는 `.gitignore` 처리되므로 *상태는 추적 X*. PROMPT.md만 추적.
