# 프롬프트 실험 API 팀 전달 문안

이 문서는 ReadingGo Solar Prompt Experiment API를 팀에 전달할 때 사용하는 복사·붙여넣기용 안내문입니다.

- API 상세 명세: [README.md](./README.md)
- 요청 예제: [`examples/`](./examples/)
- 실제 토큰은 이 문서나 일반 메신저에 적지 않고 1Password 비밀 링크 등 별도 안전 채널로 전달합니다.

## Judy에게 보내기

아래 코드 블록 오른쪽 위의 복사 버튼으로 **메시지 전체를 한 번에 복사**해 전달하세요.

````text
ReadingGo Solar 프롬프트 실험 API가 준비됐어요.

목적
- 운영 앱을 바꾸지 않고 재키 프롬프트를 실제 Upstage Solar로 시험하는 개발 전용 도구입니다.
- 운영 앱의 Active/Candidate 프롬프트와 사용자 DB에는 영향을 주지 않습니다.

문서와 예제
- https://github.com/GyehyuKim/readinggo/tree/main/docs/prompt-experiment-api
- 먼저 README.md와 examples/first-turn.json을 확인해 주세요.

API
- POST https://readinggo-dev.hyuniverse.workers.dev/api/prompt-experiments/run
- 제한: 분당 60회, 하루 1,000회

토큰
- 토큰은 별도의 안전한 채널로 전달할게요.
- 토큰을 GitHub, JSON 파일, 문서, 일반 메신저에 올리지 마세요.
- 개인 컴퓨터의 환경변수 JUDY_TOKEN으로만 사용해 주세요.

첫 실행
```bash
export JUDY_TOKEN="별도로_전달받은_토큰"
git clone https://github.com/GyehyuKim/readinggo.git
cd readinggo/docs/prompt-experiment-api

curl -X POST \
  "https://readinggo-dev.hyuniverse.workers.dev/api/prompt-experiments/run" \
  -H "Authorization: Bearer $JUDY_TOKEN" \
  -H "Content-Type: application/json" \
  --data @examples/first-turn.json
```

이미 저장소가 있다면 clone 대신 최신 main을 pull한 뒤 docs/prompt-experiment-api로 이동하면 됩니다.

실험 규칙
1. data_classification은 반드시 "synthetic"으로 유지해 주세요.
2. 실제 사용자의 문장, 감상, 이름, 연락처 등 개인정보를 넣지 마세요.
3. 비교 실험에서는 같은 입력을 유지하고 프롬프트 요소를 한 번에 하나만 바꿔 주세요.
4. 실행마다 experiment.id와 variant를 구분해 주세요.
5. 다음 항목을 확인해 주세요.
   - 재키다운 담백하고 자연스러운 말투인가
   - 사용자의 문장과 감상에 먼저 반응하는가
   - 제공되지 않은 책 내용을 지어내지 않는가
   - 질문이 필요할 때만 자연스럽게 나오는가
   - 2~3문장 안에 끝나는가
   - 불필요한 마크다운이 없는가
6. 좋은 variant와 좋지 않은 variant를 요청 JSON 및 결과와 함께 공유해 주세요. 토큰은 절대 포함하지 마세요.
7. 멀티턴 실험은 이전 assistant/user 대화를 history에 순서대로 추가해 주세요.

결과를 공유할 때는 아래 형식을 사용해 주세요.

Variant:
판정: 채택 / 수정 / 제외
좋은 점:
문제점:
수정 제안:
대표 응답:
````

## Jerome에게 보내기

아래 코드 블록 오른쪽 위의 복사 버튼으로 **메시지 전체를 한 번에 복사**해 전달하세요.

````text
ReadingGo 재키 프롬프트를 실제 Solar로 비교하는 내부 실험 도구가 준비됐습니다.

문서와 예제
- https://github.com/GyehyuKim/readinggo/tree/main/docs/prompt-experiment-api

역할
- Judy가 실행한 prompt variant와 결과를 검토해 주세요.
- 코드나 운영 프롬프트를 직접 수정하지 말고, 채택·수정 제안을 이슈 또는 코멘트로 남겨 주세요.

검토 기준
1. 자연스러움: 상담봇이나 정형화된 AI처럼 들리지 않는가
2. 맥락 반응: 사용자의 문장과 감상에 먼저 반응하는가
3. 정확성: 제공되지 않은 책 내용을 지어내지 않는가
4. 질문 품질: 매번 억지로 묻지 않고 자연스러울 때만 질문하는가
5. 길이: 모바일 대화에 적합한 2~3문장인가
6. 후속 턴: 직전 사용자 답변을 실제로 받아 이어가는가
7. 형식: 불필요한 마크다운, 목록, 과도한 설명이 없는가

비교 원칙
- 같은 입력과 generation 설정을 사용하고 variant만 비교해 주세요.
- 서로 다른 요소를 동시에 바꾼 결과는 원인을 판단하기 어려우므로 분리해 주세요.
- 한두 개의 인상적인 결과보다 여러 합성 입력에서 반복되는 패턴을 우선해 주세요.

검토 결과는 아래 형식으로 남겨 주세요.

Variant:
판정: 채택 / 수정 / 제외
좋은 점:
문제점:
수정 제안:
대표 응답:
재현한 입력/예제:

보안
- 실제 사용자 데이터는 사용하지 마세요.
- 토큰이나 Authorization 헤더를 이슈·문서·메신저에 붙이지 마세요.
- 현재 토큰은 Judy 실행용입니다. 직접 API를 실행해야 한다면 Judy 토큰을 공유받지 말고 Hyu에게 별도 접근 권한을 요청해 주세요.
````

## Hyu 체크리스트

1. Judy에게 위 메시지를 보냅니다.
2. Judy 토큰은 1Password 비밀 링크 등 만료 가능한 안전 채널로 따로 전달합니다.
3. Jerome에게는 검토 안내만 보내고 Judy 토큰은 보내지 않습니다.
4. Jerome도 직접 실행해야 한다면 공유 토큰 대신 사용자별 인증·감사 분리를 먼저 추가합니다.
