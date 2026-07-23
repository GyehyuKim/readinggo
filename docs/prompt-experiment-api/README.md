# ReadingGo Solar Prompt Experiment API

이 API는 Judy가 ReadingGo 개발 환경에서 실제 Upstage Solar 모델의 프롬프트를 반복·병렬 실험할 수 있도록 설계된 내부 도구입니다.

## 핵심 원칙
- **개발 전용**: `readinggo-dev.hyuniverse.workers.dev`에서만 작동합니다. 운영 서버에서는 404를 반환합니다.
- **합성 데이터**: 실제 사용자 기록을 사용하지 마세요. 모든 실험 데이터는 `data_classification: "synthetic"`이어야 합니다.
- **독립성**: 운영 앱의 재키 설정(Active/Candidate)과 사용자 DB를 읽거나 바꾸지 않습니다. 대화 세션은 서버에 두지 않지만, 원자적 호출 한도는 Durable Object에, 비원문 실행 메타데이터는 KV에 90일 보관합니다.

## 1. 인증 (Authentication)

모든 요청은 `Authorization` 헤더에 실험 전용 토큰을 포함해야 합니다.

```http
Authorization: Bearer <JUDY_EXPERIMENT_TOKEN>
```

- **토큰 발급**: 관리자(Hyu)에게 별도로 전달받으세요.
- **보안**: 이 토큰은 GitHub 코드나 문서에 공유하지 말고, 개인 로컬 환경변수에 저장해 사용하세요.

## 2. API 정보

- **Endpoint**: `POST https://readinggo-dev.hyuniverse.workers.dev/api/prompt-experiments/run`
- **Content-Type**: `application/json`
- **제한**: 분당 60회 / 일 1,000회 (ID별)

## 3. 요청 구조 (jacky-experiment/v1)

전체 구조는 `examples/` 디렉토리의 JSON 파일을 참고하세요.

### 주요 필드

| 필드 | 설명 | 제약 |
|---|---|---|
| `experiment` | 실험 식별 정보 (id, variant) | 필수 |
| `prompt` | 재키의 페르소나 및 턴별 지시문 | 필수 |
| `input` | 한 문장 테스트 데이터 (책 정보 포함) | 필수 |
| `history` | 멀티턴 대화 내역 (assistant/user 쌍) | 선택 (최대 12개) |
| `generation` | 온도(temperature), 최대 토큰 | 선택 |

### 프롬프트 조립 규칙
서버는 다음과 같은 순서로 최종 메시지를 구성하여 Solar에 전달합니다:
1. `system`: `prompt.system` + `prompt.constraints`
2. `user`: `input` (책 정보, 문장, 감상 포함)
3. `history`: `assistant`/`user` 대화 누적
4. `user`: `prompt.first_turn_instruction` (첫 턴) 또는 `prompt.followup_instruction` (후속 턴)

## 4. 실행 예시 (curl)

```bash
# 환경변수 설정
export JUDY_TOKEN="실제_토큰_값"

# 실행 (`JUDY_TOKEN`은 셸에서 읽으며 JSON 파일에는 저장되지 않습니다)
curl -X POST "https://readinggo-dev.hyuniverse.workers.dev/api/prompt-experiments/run" \
  -H "Authorization: Bearer $(printenv JUDY_TOKEN)" \
  -H "Content-Type: application/json" \
  --data @examples/first-turn.json
```

### 여러 Variant 병렬 실행

API는 요청 1건당 Solar를 한 번 호출합니다. 병렬 실행과 결과 비교는 클라이언트에서 담당합니다.

```python
import asyncio, json, os
import httpx

URL = "https://readinggo-dev.hyuniverse.workers.dev/api/prompt-experiments/run"
HEADERS = {"Authorization": f"Bearer {os.environ['JUDY_TOKEN']}"}

async def run(path):
    async with httpx.AsyncClient(timeout=60) as client:
        with open(path, encoding="utf-8") as f:
            return (await client.post(URL, headers=HEADERS, json=json.load(f))).json()

async def main():
    return await asyncio.gather(
        run("examples/quote.json"),
        run("examples/thought.json"),
    )

results = asyncio.run(main())
```

멀티턴은 이전 응답과 가상 독자 답변을 다음 요청의 `history`에 `assistant`, `user` 순서로 추가합니다. 서버 세션은 없으므로 같은 요청을 다시 보내면 같은 입력 구조를 재현할 수 있습니다.

## 5. 결과 해석

응답에는 다음이 포함됩니다:
- `result.content`: Solar가 생성한 답변
- `usage`: 입력/출력/전체 토큰 수
- `trace.compiled_messages`: Solar에 실제로 전달된 전체 메시지 배열 (프롬프트 튜닝 확인용)
- `limits`: 분당·일일 `used`, `limit`, `remaining` (일일 기준 시간대 `Asia/Seoul`)

`usage.source`가 `provider`이면 Solar가 반환한 토큰 수입니다. Provider가 usage를 주지 않으면 각 토큰 값은 `null`, source는 `unavailable`이며 서버가 임의로 추정하지 않습니다.

## 6. 오류 코드

| HTTP | 코드 | 의미 |
|---|---|---|
| 400 | `INVALID_JSON`, `VALIDATION_ERROR` | JSON 또는 요청 계약 오류 |
| 401 | `UNAUTHORIZED` | 토큰 누락·불일치 |
| 403 | `FORBIDDEN_ORIGIN` | 브라우저 Origin 요청 |
| 413 | `PAYLOAD_TOO_LARGE` | 본문 100KB 초과 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `application/json`이 아닌 본문 |
| 429 | `MINUTE_LIMIT_EXCEEDED`, `DAILY_LIMIT_EXCEEDED` | 호출 한도 초과 |
| 502 | `PROVIDER_ERROR` | Solar 호출·응답 오류 |
| 503 | `UNAVAILABLE`, `LIMIT_STORAGE_UNAVAILABLE`, `PROVIDER_UNAVAILABLE` | 서버 설정 또는 의존 서비스 미사용 가능 |
| 504 | `PROVIDER_TIMEOUT` | Solar가 30초 안에 응답하지 않음 |

### 저장 범위

- Durable Object: 현재 분 버킷과 KST 일자별 누적 호출 수만 저장합니다.
- KV: run ID, actor, 실험 ID/variant, 모델, prompt/input 해시, token usage, latency, 상태·오류 코드, 생성 시각을 90일 저장합니다.
- 프롬프트·문장·감상·history·Solar 응답 원문은 서버 로그에 저장하지 않습니다.

## 7. 주의사항

- **브라우저 호출 금지**: 보안을 위해 브라우저(CORS) 요청은 차단됩니다. `curl`, Python 스크립트, 또는 Claude 등에서 서버 간 통신(Server-to-Server)으로 호출하세요.
- **마크다운**: 재키는 마크다운을 사용하지 않는 것을 원칙으로 합니다. 응답에 별표(`**`) 등이 섞이는지 확인하세요.
- **길이**: 2~3문장을 유지하도록 지시문에 포함하는 것이 좋습니다.
