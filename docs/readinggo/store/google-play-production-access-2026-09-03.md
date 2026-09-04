# Google Play 프로덕션 액세스 신청 기록 — 2026-09-03

## 1. 신청 개요

- 앱: `리딩고 — 하루 한 문장 독서 습관`
- 패키지: `com.readinggo.app`
- 개발자 계정: `ReadingGo` (`readinggo.admin@gmail.com`)
- 제출 언어: 영어
- 신청 대상: Google Play 프로덕션 액세스
- 제출 시각: 2026-09-03 09:24 KST
- 접수 상태: `프로덕션 액세스 권한 신청을 접수했습니다`
- 검토 안내: 일반적으로 7일 이내에 완료되지만 경우에 따라 더 오래 걸릴 수 있음
- 결과 통지: 계정 소유자 이메일

Google Play Console은 신청 전 다음 조건을 모두 충족한 것으로 표시했다.

- 비공개 테스트 버전 게시
- 테스터 12명 이상 참여 선택
- 12명 이상을 대상으로 14일 이상 테스트 실행

## 2. 제출 답변

### 2.1 비공개 테스트 정보

#### 비공개 테스트에 참여할 사용자를 어떻게 모집했나요? — 234자

> We recruited volunteers through our personal and professional networks, including friends, classmates, colleagues, and other acquaintances interested in reading. Participation was voluntary, and we did not use a paid testing provider.

#### 앱 테스터를 얼마나 쉽게 모집했나요?

- 선택: `보통이었음`

#### 비공개 테스트 중 테스터의 참여도에 대해 설명해 주세요. — 272자

> Testers used the core flows: searching for books, recording reading progress and sentences, adding reflections, reviewing saved entries, and sharing. This matched expected real use. Some explored settings and public features less often because the test period was limited.

#### 테스터로부터 받은 의견을 요약해 주세요. — 290자

> Feedback was collected through direct messages and structured beta inquiry reports. Testers requested better book search, easier mobile text entry, clearer public/private visibility, more reliable saving and sharing, and a more engaging Jacky character. We fixed key issues before applying.

### 2.2 앱 정보

#### 앱의 주요 대상은 누구인가요? — 279자

> ReadingGo is for Korean-speaking adults and students who want to build a consistent reading habit. It especially serves readers who struggle to maintain routines or remember what they read and want a simple mobile way to track books, pages, meaningful sentences, and reflections.

#### 앱이 사용자에게 어떤 가치를 제공하는지 설명하세요. — 276자

> ReadingGo turns daily reading into a manageable habit. Users can track books and page progress, save a meaningful sentence and reflection, maintain streaks, and revisit or share entries. This reduces the effort of journaling while making reading progress and insights visible.

#### 첫해에 앱이 몇 회 설치될 것으로 예상하시나요?

- 선택: `0~1만`

### 2.3 프로덕션 준비

#### 비공개 테스트에서 알게 된 내용을 바탕으로 앱을 어떻게 변경했나요? — 288자

> Based on tester feedback, we improved book search and result handling, made mobile text entry clearer, clarified public/private visibility, strengthened save and share flows, and refined the Jacky character experience. We also fixed reported defects and simplified confusing interactions.

#### 앱이 프로덕션용으로 준비되었다고 어떻게 판단했나요? — 290자

> We considered the app ready after completing the required 14-day closed test with at least 12 opted-in testers, verifying core flows on mobile devices, resolving key beta issues, and confirming stable search, input, save, visibility, and sharing behavior with no reported critical blockers.

## 3. 언어 결정

서비스와 Play Console UI는 한국어이지만, 신청 화면이 글자 수를 영문 기준으로 안내하고 심사자가 의미를 일관되게 이해할 수 있도록 답변은 영어로 제출했다. 한국어 서비스라는 점은 주요 대상 답변의 `Korean-speaking adults and students`로 명시했다.

## 4. 후속 확인

- [ ] 계정 소유자 이메일에서 심사 결과 확인
- [ ] Play Console에서 프로덕션 액세스 상태 확인
- [ ] 승인 후 프로덕션 트랙 출시 범위와 버전 별도 검토
- [ ] 거절되면 사유와 재신청 답변을 이 문서에 추가

## 5. 추적

- 관련 이슈: #1588
