Goal: `docs/readinggo/specs/home-reading.md`의 활성 계약에 맞춰 홈 route·module·테스트·자동화의 중립 이름을 유지하고, 퇴역한 `둥지/nest` 제품명을 새 출력에서 만들지 않는다.

Source:
- `docs/readinggo/specs/home-reading.md` — 홈·독서 기록 SSOT
- `docs/readinggo/specs/backend.md` — DataStore·세션·문장 계약
- `docs/readinggo/specs/profile.md` — `library`·프로필 계약
- `docs/readinggo/main.js` — Vite entry와 module graph
- `docs/readinggo/js/home.js` — 홈 구현 본체
- `docs/readinggo/js/app.js` — route 정규화와 앱 셸

Output:
- `docs/readinggo/js/home.js`와 import·component·test·workflow의 중립 홈 이름을 함께 유지한다.
- 그 밖의 활성 홈 runtime·test·workflow는 필요한 파일만 수정한다.
- spec 자체는 수정하지 않는다. 계약이 모호하면 중단하고 `loop/home-align/BLOCKED.md`에 기록한다.
- Git history, archive 문서, 닫힌 이슈·PR, 적용 migration은 수정하지 않는다.

Required invariants:
1. canonical 홈 route와 새 state/history/output은 `home`이다.
2. 과거 입력 `nest`와 `nest-grow`는 `app.js`의 단일 정규화 경계에서 각각 `home`과 `library`로 바꾼다.
3. 정규화 뒤 alias를 URL·history·저장값·분석·접근성 이름으로 다시 출력하지 않는다.
4. 활성 module·component·test·workflow 파일명과 식별자에는 퇴역 제품명이 남지 않는다.
5. 활성 책 전환, 페이지·세션 저장, 문장 저장, exact saved-row 성찰, OCR, 완료 후 행동과 뒤로가기를 유지한다.
6. 책·진도·세션·문장·생각·게스트 기록·공개범위를 손실하거나 확대하지 않는다.
7. DB schema·migration·RLS·네이티브 plugin·외부 dependency를 변경하지 않는다.

Constraints:
- Vite + React 18 + Capacitor + Cloudflare Worker 구조를 유지한다.
- 데이터 접근은 DataStore 경계를 사용한다. feature에서 localStorage·Supabase 직접 접근을 추가하지 않는다.
- 새 라이브러리를 도입하지 않는다. `CLAUDE.md` Stack Lock을 따른다.
- spec-first 규칙을 지킨다. 새 동작 결정이 필요하면 구현하지 말고 BLOCKED로 종료한다.
- 이 `PROMPT.md`와 `loop/*` 제어 파일은 실행 중 수정하지 않는다.

Verification:
- repository의 spec-align, DataStore contract, full Node tests, production build, 5탭 render smoke를 실행한다.
- legacy 입력 alias가 실제로 canonical route로 수렴하고 새 history/state에는 alias가 남지 않는 회귀 테스트를 포함한다.
- 변경 후 `git diff --check`와 활성 파일명·내용 검색으로 허용 예외 밖 퇴역 용어 0건을 확인한다.

Exit:
- 모든 gate가 통과하면 `loop/home-align/DONE`을 빈 파일로 만든다.
- 실패·모호성·cross-feature 결정이 필요하면 `loop/home-align/BLOCKED.md`에 근거, 가능한 해석, 추천안을 기록하고 종료한다.
