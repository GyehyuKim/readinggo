# 의도적 기각 결정 (보존)

> **Split from** `docs/2. specifications/_archive/readinggo-spec.md` v6 (2026-05-28 분할). 원 위치: §14. 변경 이력은 git log 참조.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.

## 14. 의도적 기각 결정 (보존)

미래에 같은 제안이 다시 올라올 때 *이미 검토하고 기각한 이유* 를 보여주기 위한 절. 기각 결정은 가역적이며, 상황(예: 무료 OCR API 등장, 사용자 N 폭증) 변화 시 재검토 가능.

| 항목 | 검토 시점 | 기각 사유 | 재검토 트리거 |
|---|---|---|---|
| **OCR — 웹 환경** (Tesseract.js / Cloud Vision API) | 2026-05-22 → **superseded** | 당시 기각 사유: 라이브러리 무게·정확도 또는 외부 API 비용 | 현재 웹 OCR은 Worker `/api/ocr`(Upstage)로 구현. 역사 기록을 삭제하지 않고 superseded로 보존 |
| **마을 탭** (커뮤니티 게시판, [village.md](../village.md)) | 2026-06 (#440·#639) | 소셜/피드로 일원화 — 별도 탭 분산이 핵심 루프(읽기·한 문장)를 희석. **위임**: 공개 한 문장·발견은 [feed.md](../feed.md), 같은 책 독자 연결은 추천 피드로 흡수 | 커뮤니티 수요·사용자 N 폭증 시 재검토 |
| **OCR — 네이티브** (Capacitor + ML Kit/Vision) | 2026-05-22 → **채택 후 superseded** | Capacitor 셰은 현재 채택됐지만 ML Kit/Vision OCR 플러그인은 미설치 | 현재 OCR은 Worker 경유. 네이티브 플러그인은 별도 Stack Lock 결정 없이 채택된 것으로 간주하지 않음 |
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

## 14.2 v7 기각·보류 (2026-06-01, web-first 롤백)

| 항목 | 기각/보류 사유 | 재검토 트리거 |
|---|---|---|
| **Capacitor 처음부터 (v5.1)** | **superseded** — v7 당시 web-first 보류 역사 | Capacitor는 출시 플랫폼으로 채택되어 Vite `dist`를 iOS/Android와 공유. 구 Phase 3 트리거 비활성 |
| **OCR·STT (네이티브)** | **부분 superseded** — “Capacitor 보류” 전제는 해제, 네이티브 플러그인은 미채택 | OCR은 Worker로 제공. STT·네이티브 OCR은 별도 제품/스택 결정 필요 |
| **운영자 짹** | 첫 7일 보호 주축이었으나 운영 부담·확장성 우려. 짹/NPC로 대체 | 별도 결정 |
| **첫 7일 둥지 가속 (D1/D3/D7)** | 둥지=진척률로 단순화하며 가속 트리거 제거 | — |
| **주간 리그 (기능 자체)** | v4.4 노출 보류 → v7 기능 삭제. 경쟁 자극보다 다정함 톤 우선 | 사용자 인터뷰에서 경쟁 요구 명시 시 |
| **독서모임 (메가스트림/서브모임)** | 마을(파트 마일스톤)로 복귀. 구조 단순화 | — |
| **결정 마찰 카피 ("그냥 펴진 페이지 한 줄도")** | 카피 과다. 슬로건으로 충분 | 입력 이탈 데이터 확인 시 |
| **마을 공동자산 (도서관/세계수)** | 마을 단순화. 파트 마일스톤·둥지 그리드로 충분 | 마을 리텐션 약하면 재검토 |
| **"모이" 브랜드 용어** | "한 문장"으로 통일(직관성). DB `sentences` 유지 | — |
| **`chapter_id` 자동매핑** | 챕터 XP 후순위 → 자동매핑 불요 | 챕터 기능 본격화 시 |
| **푸시 알림 (Phase 0/1)** | **부분 superseded** — 네이티브 스트릭 로컬 알림은 #1033으로 구현 | 웹/PWA·서버 원격 푸시는 미구현; 별도 이슈·운영 정책 필요 |

> v7 결정 전체 근거: [`meta/decisions.md`](./decisions.md).

---

*v6 · feature/readinggo-ai-enhancement — 독서모임 탭 신설 / AI 도서 추천 / AI 추출 책 / SNS 마일스톤 카드 / T2 mini·마을 탭 안건 해소 (2026-05-28)*
*v7 · gyehyu/spec-v7-rollback — web-first 재정의 / Capacitor·운영자짹·리그·가속 폐기 / 마을 복귀 / DataStore 계약 / AI Gemini 무료 (2026-06-01)*

**연관 문서**:
- `docs/readinggo/ROADMAP.md` — 북모리 전체 피쳐 × Phase × 우선순위 매트릭스
- `docs/readinggo/iOS-PLAN.md` — Capacitor 출시 계획 (v5.1 기준 재작성됨)
- `docs/readinggo/BACKLOG.md` — 피어리뷰·구현 누락·v3 cut-line 트리아지
- `docs/readinggo/COMPETITIVE-ANALYSIS.md` — 경쟁자 분석 (북모리·Bookly·Fable 등 16개)
