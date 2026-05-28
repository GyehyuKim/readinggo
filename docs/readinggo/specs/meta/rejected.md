# 의도적 기각 결정 (보존)

> **Split from** `docs/2. specifications/readinggo-spec.md` v6 (2026-05-28 분할). 원 위치: §14. 변경 이력은 git log 참조.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.

## 14. 의도적 기각 결정 (보존)

미래에 같은 제안이 다시 올라올 때 *이미 검토하고 기각한 이유* 를 보여주기 위한 절. 기각 결정은 가역적이며, 상황(예: 무료 OCR API 등장, 사용자 N 폭증) 변화 시 재검토 가능.

| 항목 | 검토 시점 | 기각 사유 | 재검토 트리거 |
|---|---|---|---|
| **OCR — 웹 환경** (Tesseract.js / Cloud Vision API) | 2026-05-22 | 라이브러리 무게(Tesseract.js 4MB+, 한국어 정확도) 또는 외부 API 비용 | — (Phase 0/1 웹 환경 한정 영구 기각). Capacitor 네이티브로 우회 |
| **OCR — 네이티브** (Capacitor + ML Kit/Vision) | 2026-05-22 → **2026-05-23 채택** | (이전 기각 사유: 학기 범위 비용) | **Capacitor 처음부터 진행 결정으로 비용 0 확인. Phase 2 P1로 채택 ([§3](../README.md), ROADMAP)** |
| **음성 받아쓰기 — 웹** (Web Speech API) | 2026-05-22 | 브라우저별 지원 불일치, Chrome은 사실상 외부 API | — |
| **음성 받아쓰기 — 네이티브** (Capacitor) | 2026-05-23 | (이전 기각 사유 해제) | **Phase 3 채택 — `@capacitor-community/speech-recognition`** |
| **글자 수 미니멈 도입** | 2026-05-22 | 어차피 미설정. 마찰 늘림 | 입력 품질 문제 발생 시 |
| **Duolingo 세부 메카닉 인용** | 2026-05-22 | 독립 발상 요구 (사용자 명시) | — (영속 제약) |
| **짹마다 다른 색 confetti** | 2026-05-22 | 재미 요소지만 우선순위 낮음 | v6 시각 디테일 라운드 |
| **첫 7일 XP 더블** | 2026-05-22 | "XP가 뭔지 의미가 모호한데 두 배 줘봤자 감 안 옴" — 본인 | XP destination 결정([§13.1](../meta/open-issues.md)) 후 재검토 |
| **새벽 3-4시 컷오프 유예** | 2026-05-22 | "그 시간에 책 펴서 쓸 유저였으면 이전에 했음" 사용자 행동 모순 | 데이터로 새벽 활동 사용자 클러스터 확인 시 |
| **사전 질문 (가입 전)** | v4 | 마찰 제거 | — |
| **소셜 탭 주간 리그 노출** | v4.4 (5/14 회의) | 강조점 분산 | 사용자 인터뷰에서 *경쟁 자극* 요구 명시 시 |
| **`B. 사전 질문` 화면** | v4 | 1일 1페이지 1문장이 유일 목표 | — |

---

*v6 · feature/readinggo-ai-enhancement — 독서모임 탭 신설 / AI 도서 추천 / AI 추출 책 / SNS 마일스톤 카드 / T2 mini·마을 탭 안건 해소 (2026-05-28)*

**연관 문서**:
- `docs/readinggo/ROADMAP.md` — 북모리 전체 피쳐 × Phase × 우선순위 매트릭스
- `docs/readinggo/iOS-PLAN.md` — Capacitor 출시 계획 (v5.1 기준 재작성됨)
- `docs/readinggo/BACKLOG.md` — 피어리뷰·구현 누락·v3 cut-line 트리아지
- `docs/readinggo/COMPETITIVE-ANALYSIS.md` — 경쟁자 분석 (북모리·Bookly·Fable 등 16개)
