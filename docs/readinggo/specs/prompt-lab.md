# Prompt Lab — 윤지의 재키 프롬프트 실험

> **상태:** 테스트 단계 · #1304
>
> Prompt Lab은 윤지(융디)가 실제 ReadingGo 사용자 기록을 열람하거나 운영 대화에 영향을 주지 않고, 재키의 candidate prompt를 만들고 비교·평가하는 제한된 실험 공간이다.

## 역할과 서버 권한

| 역할 | 대상 | 허용 |
|---|---|---|
| editor | `융디` 계정이 존재할 때 해당 내부 user ID | candidate 작성·수정, 합성 fixture 실행, 비교·평가 |
| promoter | 현재 `public.users.is_admin = true`인 ReadingGo admin 계정 | candidate 승격/rollback 및 baseline 승격 |

- 역할은 화면 표시만으로 결정하지 않는다. 모든 Lab API 요청은 Worker가 인증된 내부 user ID와 active grant를 확인한다.
- promoter는 active grant가 있어도 **요청 시점에 현재 admin**이어야 한다. admin 해제 계정은 즉시 승격·rollback 권한을 잃는다.
- 대상 handle에 대응하는 계정이 아직 없으면 grant는 `pending`으로 남으며, 계정을 자동 생성하거나 다른 계정에 부여하지 않는다.
- 일반 로그인 사용자는 Lab API와 화면에 접근할 수 없다.

## prompt 경계

```text
일반 /api/companion 요청 → active prompt만 사용
Prompt Lab의 명시적 실행 → active와 candidate를 각각 같은 합성 입력으로 실행
```

candidate는 Lab 실행 외 경로에 전달되면 안 된다. 일반 사용자 대화, 메모, 실제 독서 기록을 fixture·평가·audit에 복사하지 않는다.

## 실험 흐름

1. editor가 immutable baseline fixture를 선택하거나 가상 sandbox를 만든다.
2. editor가 candidate prompt를 버전·변경 사유와 함께 저장한다.
3. Worker가 같은 합성 입력으로 active/candidate 결과를 실행하고 나란히 반환한다.
4. editor가 맥락 이해, 후속 질문 깊이, 개인화 off 기준선, 안전성, 말투를 1–5점 및 코멘트로 평가한다.
5. promoter가 테스트 결과를 검토한다.

기본 baseline fixture는 10개 이상이며 수정·삭제할 수 없다. sandbox만 변경 가능하다.

## 운영 반영과 테스트 단계

candidate의 운영 반영은 promoter만 요청할 수 있고 audit event를 남긴다. 다만 현재 PR의 사용자 테스트는 **candidate 작성·비교·평가 여정**만 대상으로 한다. promotion/rollback의 원자적 DB transaction 보강은 후속 안전 작업으로 분리하며, 그 전에는 운영 prompt를 바꾸는 테스트를 하지 않는다.

## 데이터 접근

Prompt Lab 테이블은 RLS를 켜고 `anon` 및 `authenticated`의 직접 권한을 회수한다. 브라우저는 Supabase table을 직접 읽거나 쓰지 않으며, Worker의 권한 검사를 통과한 서버 경로만 사용한다.
