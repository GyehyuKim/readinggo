# E2E Scenario — 둥지 탭 로딩 + 한 문장 기록

> **타입**: Claude in Chrome 자연어 E2E ([LF](../../docs/lecture-frameworks.md#lf-week11-claude-in-chrome))
> **대상**: 데모 핵심 경로 — 신규 사용자가 첫 한 문장을 기록하는 흐름
> **실행 방법**: 아래 시나리오를 Claude Code 세션에 붙여넣고 Claude in Chrome 실행
> **수동 / 자동**: 현재 수동. Phase 1에 자동화 후보.

## 시나리오

```
Open the deployed demo at https://gyehyukim.github.io/glocalx/readinggo/.

1. Verify the 둥지 (Nest) tab is the default landing tab.
2. Take a screenshot before any interaction.
3. If the page asks for a book, search for "사피엔스" and select it.
   If a book is already active, skip this step.
4. Locate the "오늘의 한쪽" (daily check-in) input area.
5. Enter "35" into the page number field.
6. Enter "역사는 우연의 누적이다" into the sentence input field.
7. Click the 기록하기 (Record) button.
8. Assert: a confirmation appears (toast / banner / state change).
9. Assert: the 한 문장 목록 area now shows the entered sentence.
10. Take a screenshot after recording.
11. Return both screenshots and a summary of any unexpected behavior.
```

## 기대 결과

- 단계 1·2: 둥지 탭 활성 + 기본 상태 캡처
- 단계 3-7: 입력·등록이 에러 없이 진행
- 단계 8-9: 등록 후 UI에 반영 확인
- 단계 10-11: 비교 가능한 before/after

## 알려진 제한

- Phase 0은 localStorage 기반. 세션 끝나면 초기화될 수 있음
- 모바일 뷰포트로 강제하려면 시나리오 1단계 앞에 `Set viewport to 390x844 (iPhone 14)` 추가

## 다음 단계 (자동화 후보)

- Phase 1 진입 시 Playwright 스크립트로 마이그레이션
- 또는 Claude in Chrome을 CI step으로 통합 (계정 토큰 필요)
