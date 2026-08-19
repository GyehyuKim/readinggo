# Tests — ReadingGo

> **근거**: [LF: 통합 테스트 4계층](../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-test-platform-4-layers) + [LF: /health 부트스트랩](../docs/1.%20research_and_lectures/lecture-frameworks.md#lf-week11-health-bootstrap)
> **목표**: Phase 2 Scorecard "11/14 teams: zero automated tests" 함정 회피.
> **현재**: 부트스트랩 단계. Phase 0 (정적 HTML+JS 데모)에 맞춘 최소 인프라.
> **v17 경계:** 현재 spec-align·Node green은 v7~v16 및 레거시 XP·둥지·스트릭 구현의 기준선이다. 책나무·최근 14일 리듬·누적 성장일·XP 쓰기 동결·친구/비친구/차단 RLS를 검증하는 v17 invariant와 Production E2E는 아직 없다.

## 전략 — Inch wide, miles deep

| 계층 | 현재 | Phase 1 진입 시 |
|---|---|---|
| **Contracts** | DataStore 계약(`contract/`) · 스펙-구현 정합(`spec-align/`). (구 `data/validate-books.py`는 정적 books.tsv 제거 #972로 폐기 — 카탈로그 canonical=Supabase) | + 데이터 스키마 전반 |
| **Unit** | XP·둥지·스트릭 테스트는 레거시 as-built 기준선 | 책나무 파생·성장 리듬·공개범위 fail-closed 계약 |
| **E2E** | [Claude in Chrome 시나리오](./e2e/) — 자연어, 수동 실행 | Playwright 자동화 후보 |
| **Evals** | (해당 없음) | 운영자 짹 LLM 응답 회귀 |

## 자동화 (GitHub Actions)

`.github/workflows/test.yml` — PR마다 실행. spec-align·contract·boot/render-smoke·lint·issue-link·spec-coverage 등.

## 로컬 실행

```bash
node tests/sentence-actions-identity.test.mjs
```

## 추가 룰

- 새 contract: `tests/<영역>/validate-<X>.py` — exit 0/1, 인간 가독 메시지
- 새 E2E: `tests/e2e/scenario-<flow>.md` — 자연어 단계 + 기대 결과
- CI에 추가 시 `.github/workflows/test.yml`에 한 줄
