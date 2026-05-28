# Tests — ReadingGo

> **근거**: [LF: 통합 테스트 4계층](../docs/lecture-frameworks.md#lf-week11-test-platform-4-layers) + [LF: /health 부트스트랩](../docs/lecture-frameworks.md#lf-week11-health-bootstrap)
> **목표**: Phase 2 Scorecard "11/14 teams: zero automated tests" 함정 회피.
> **현재**: 부트스트랩 단계. Phase 0 (정적 HTML+JS 데모)에 맞춘 최소 인프라.

## 전략 — Inch wide, miles deep

| 계층 | 현재 | Phase 1 진입 시 |
|---|---|---|
| **Contracts** | `data/validate-books.py` — books.tsv 스키마 검증 | + 데이터 스키마 전반 |
| **Unit** | (해당 없음) | XP 계산·둥지 진화 로직 |
| **E2E** | [Claude in Chrome 시나리오](./e2e/) — 자연어, 수동 실행 | Playwright 자동화 후보 |
| **Evals** | (해당 없음) | 운영자 짹 LLM 응답 회귀 |

## 자동화 (GitHub Actions)

`.github/workflows/test.yml` — PR마다 실행. Contracts 검증.

## 로컬 실행

```bash
python tests/data/validate-books.py
```

## 추가 룰

- 새 contract: `tests/<영역>/validate-<X>.py` — exit 0/1, 인간 가독 메시지
- 새 E2E: `tests/e2e/scenario-<flow>.md` — 자연어 단계 + 기대 결과
- CI에 추가 시 `.github/workflows/test.yml`에 한 줄
