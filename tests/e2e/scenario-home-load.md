# E2E Scenario — 홈 로딩 + 한 문장 기록

> **대상**: 현재 5탭 제품의 홈 독서 기록 흐름
> **수동 / 자동**: 현재 수동. 자동화는 후속 범위.

## 시나리오

```text
Open the locally served ReadingGo build with a 390x844 viewport.

1. Verify the bottom navigation has five tabs in this order: 홈, 함께, 서재, 프로필, 설정.
2. Verify 홈 is the default active tab and take a screenshot before interaction.
3. If Home asks for a book, search for "사피엔스" and select it. If a book is already active, skip this step.
4. Locate the page and sentence recording controls on Home.
5. Enter "35" in the page field and "역사는 우연의 누적이다" in the sentence field.
6. Submit the record once.
7. Assert that a success confirmation appears and the saved sentence is visible on Home.
8. Open 함께, 서재, 프로필, and 설정 once each; assert every tab renders without an error.
9. Return to 홈 and assert that the recorded sentence is still visible.
10. Take an after screenshot and report unexpected behavior without changing external data.
```

## 기대 결과

- 5탭 순서와 홈 기본 진입이 현재 IA와 일치한다.
- 페이지·문장이 한 번만 저장되고 홈에 즉시 반영된다.
- 탭 전환 후에도 저장한 문장이 유지된다.

## 제한

- 로컬 게스트 데이터를 사용하며 계정·DEV·Production 데이터를 변경하지 않는다.
- 로컬 저장소를 유지하는 환경에서는 테스트 전용 브라우저 프로필을 사용한다.
