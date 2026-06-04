# 📦 레거시 스펙 아카이브

> ⚠️ **여기 파일들은 모두 DEPRECATED (2026-06-04 아카이브).**
> **현재 정본(SSOT) 스펙은 [`docs/readinggo/specs/`](../../readinggo/specs/) 입니다.**

이 폴더는 v6 이전(2026-05-28 thin-spec 분할 전)의 단일 파일 스펙·논의 문서를 **역사 보존용**으로 옮겨둔 곳입니다. 더 이상 편집하지 마세요 — 작업은 `docs/readinggo/specs/`의 피처별 파일에서 합니다.

| 파일 | 설명 | 대체 위치 |
|---|---|---|
| `readinggo-spec.md` | v6 단일 파일 스펙(1,651줄) | `docs/readinggo/specs/*` (피처별 분할) |
| `readinggo-feature-spec.md` | v6 기능 스펙 | 동일 |
| `readinggo-demo-jerome-spec.md` | 승원 v4.2 데모 명세(폰트·컬러·The Path 등) | 디자인 토큰→`design.md §11/§12`, The Path→v7 폐기 |
| `readinggo-discussion.md` | 피벗 논의 아카이브 | — (역사) |
| `GAP-ANALYSIS.md` | v6 갭 분석 | — (역사) |

**왜 옮겼나**: 구 파일들이 정본을 가리키지 않아, 팀원이 구 파일을 보고 작업하는 혼란이 발생(예: The Path는 v7에서 폐기됐는데 구 데모 스펙엔 남아있음). 정본 일원화를 위해 분리. ([decisions §8.4](../../readinggo/specs/meta/decisions.md))
