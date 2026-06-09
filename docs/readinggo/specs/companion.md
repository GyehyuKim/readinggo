# LLM 독서 파트너 — "혼자만의 독서모임"

> **신규 (v7.3, 2026-06-08)**: ReadingGo 피치 센터피스. 근거: whytree 세션(`research/whytree-llm-companion.md`), 오피스아워 피드백 대응(#303), 이슈 #287.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 준수.

## 1. 포지셔닝 (What's New)

> **"혼자 읽어도, 한 문장을 남기면 '왜 그게 좋았어?'라고 물어봐 주는 — 언제나 열려 있는 1인 독서모임."**

- **What's New**: 독서의 기록 단위를 '몇 쪽·완독'이 아니라 **'한 문장이 나를 끌어올린 순간 + 왜'** 로 바꾼다. 남기면 끝(저장)이 아니라 **시작**(질문 → 대화).
- **What's Different (북모리 대비)**: 북모리는 문장을 *저장*한다. ReadingGo는 문장으로 *대화*한다. (북모리 AI 기능 없음 — 클린한 차별점)
- **Why You (해자)**: 콘텐츠가 아니라 **내 축적 맥락**(문장·왜·이력)에 기반한 관계. 쓸수록 나를 더 아는 진행자 = 인터랙션 해자.
- **코어 감정**: 고양감(uplift) — 질문이 그 순간을 한 번 더 끌어올린다.

### 1.1 "그냥 ChatGPT 아냐?" 방어 (피치 필수)

| | ChatGPT | ReadingGo 파트너 |
|---|---|---|
| 시작 | 내가 시켜야 함 | **먼저 물어봄** (내가 남긴 그 문장에 대해) |
| 지속 | 휘발 | **쌓임** → 갈수록 나를 더 아는 진행자 |
| 맥락 | 책 밖 | **읽는 흐름 안**, 내 문장이 재료 |

---

## 2. 코어 루프 (MVP — SLC)

```
한 문장 저장 (둥지/읽기 모드)
      ↓
참새가 묻는다: "왜 이 문장을 남겼어요?"   ← 자동, 1개 질문
      ↓
답한다 (또는 스킵)
      ↓
답을 받아 한 걸음 더 깊이 되묻는 후속 질문 (멀티턴, 최대 3턴) ✅ #327
      ↓
대화가 그 문장 카드 하단에 붙어 축적됨 → my_note로 저장(Q/A)
```

- **멀티턴 대화 (✅ 구현, #327)**: 질문 → 답 → 후속 질문 → … 최대 3턴, '마치기'로 언제든 종료. 매 답마다 대화를 해당 문장 my_note에 저장. 후속은 `/api/companion`에 `exchanges`(이전 Q/A) 전달.
- 질문은 **책 맥락 + 개인 맥락(왜 걸렸나)** 을 함께 건드린다. 책·작가 지식 곁들임.
- **스킵/마치기** 가능 — 강요하지 않음 (진입 마찰↓, 오피스아워 §4). 미동의 시 로컬 목 단발(멀티턴 X).

---

## 3. 앱 내 위치 (Integration)

| 진입점 | 동작 |
|---|---|
| 한 문장 저장 직후 (읽기 모드 `save` / 둥지) | 참새 질문 카드가 인라인으로 등장 |
| '내 한 문장' 카드 탭 | 과거 문장에 대해 다시 대화 (시간차 되감기 — §5) |

- 별도 탭 신설 안 함. **기존 '한 문장' 플로우에 얹는다** (UX 통합, 한 목소리 — 오피스아워 §2-5).

---

## 4. LLM 연결 — Upstage Solar (구현 완료, #287)

- **provider-agnostic 클라이언트**: `worker/index.mjs`의 `callLLM()`이 `LLM_BASE_URL`·`LLM_MODEL`·`UPSTAGE_API_KEY`를 **전부 env에서** 읽음(하드코딩 금지). OpenAI 호환 `chat/completions`. → Gemini·Ollama 전환 시 env만 교체.
- **현재 모델**: `solar-pro3` (Upstage, `https://api.upstage.ai/v1`). 인터랙티브 질문 품질용. 대량 프로파일링은 더 싼 티어로(후속, `LLM_MODEL`만 교체).
- **reasoning 토글**: `LLM_REASONING_EFFORT` — 미설정/빈 값=추론 최소(기본). `low|medium|high` 설정 시 `reasoning_effort`로 전달. 질문이 밋밋하면 env만 올림(코드 수정 없음).
- **라우트**: `POST /api/companion` (`worker/index.mjs`). 입력 `{sentence, bookTitle}` → 출력 `{question}`. system = 독서 회고 진행자(한국어 질문 1개).
- **키 보호**: 키는 **서버(Worker secret)에서만**. `wrangler secret put UPSTAGE_API_KEY`. 클라 번들·React CDN 노출 금지. `LLM_BASE_URL`·`LLM_MODEL`은 `wrangler.toml [vars]`.
- **graceful fallback**: 키 없음/호출 실패 시 **목 질문으로 폴백**(서버·클라 양쪽). 데모·피치 무중단.
- 클라(`nest.js`): 저장 직후 `genCompanionQuestion()`이 `/api/companion` 호출(로딩→질문, 실패 시 목).
- 레거시 `workers/companion-proxy.js`(Anthropic)는 참조용 — 실제 경로는 `worker/index.mjs`.

---

## 5. 시간차 되감기 (Resurface) — Phase 1 후속 (#289)

과거에 남긴 문장·답변을 재소환: "그때 이 문장에 이렇게 답했네요. 지금은 어때요?"
→ 축적이 관계로 전환되는 지점. 코어 루프 안정화 후.

---

## 6. 후속 (코어 안정화 후)

| 기능 | 근거 | 우선도 |
|---|---|---|
| 질문 렌즈 (감정/연결/반론/투사) | 프로토타입 | 후속 |
| 막힐 때 도와주기 ("이 책 어렵니? / 작가 TMI") | 오피스아워 ⑤, "안 읽음" 마찰 | 후속(강력) |
| 참새 성격 부여 (잔소리꾼/칭찬봇) | 개인화 넛지 ⑥ | 후속 |
| 말투·페르소나 튜닝 | #287 deferred | 후속 |

---

## 7. 데이터 / 동의

- 대화 아카이브: `companion_sessions` ([analytics.md §4](./analytics.md), #295).
- 수집 동의: 온보딩/첫 실행 동의 플로우 ([analytics.md §5](./analytics.md), #294). 미동의 시 로컬만, 서버 아카이브 제외.
- 행동 이벤트: `answer_saved`, `resurface_triggered` 등 (analytics.md §3.1).

---

## 8. 비목표 (Non-goals)

- OCR·STT 자동 추출 (오피스아워: 오버스펙). Phase 3 재검토.
- 책 요약·추천을 코어로 두지 않음 (커머디티 — 콘텐츠 해자 없음).
- 소셜·마을 연동은 후순위 (코어 = 한 문장 대화).
