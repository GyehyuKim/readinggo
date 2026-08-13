# 고객 피드백 플라이휠 스펙

> **개정 (2026-08-13, #1407)**: 인증 actor 기반 제출 분리, 앱 내 상태 조회, GitHub 완료 reconciliation을 정의한다.
> **편집 정책**: 데이터 모델 본체는 [backend.md](./backend.md), 설정 UI는 [profile.md](./profile.md)를 함께 따른다. 이번 변경은 스키마와 소비 코드가 동시에 결정되어야 하는 작은 계약 변경이므로 `CONTRIBUTING.md §4.1` 예외를 PR에 기록한다.

## 1. 목적과 경계

- 서버가 Supabase bearer session에서 `user_id`를 얻고 `public.users.is_admin`을 조회한다. 클라이언트가 actor나 문의 종류를 지정하지 않는다.
- 비관리자 로그인 사용자의 직접 제출만 `customer_feedback`이며 GitHub 이슈를 만든다.
- admin 제출은 `admin_note`로 저장하고 GitHub 자동화에서 제외한다.
- 기존 문의는 `legacy`로 보존하며 새 자동화에 소급 편입하지 않는다.
- 공개 GitHub 제목·본문·Worker 로그에는 문의 원문, 이메일, `user_id`, 내부 inquiry UUID 등 PII/식별자를 싣지 않는다. 운영자는 비공개 admin 데이터에서 원문을 확인한다.

## 2. 데이터와 사용자 상태

`51_feedback_flywheel.sql`은 forward-only·재실행 안전 마이그레이션이다.

| 컬럼 | 값 | 의미 |
|---|---|---|
| `submission_kind` | `legacy/customer_feedback/admin_note` | 기존 행 보존 / 직접 고객 제보 / 운영 내부 메모 |
| `public_status` | `received/checking/answered` | 설정 표시 `접수/확인중/답변` |
| `response_source` | `github_notify_ready` 또는 null | 자동 답변 출처 |
| `github_reconciled_at` | timestamptz 또는 null | 마지막 성공 자동 답변 기록 시각 |

상태 전이는 `received`(저장) → `checking`(GitHub issue 번호 기록) → `answered`(아래 완료 게이트 통과)다. 사용자는 RLS로 자신의 문의만 `listMine()`에서 보고, 답변 상태일 때 `response`를 함께 본다.

## 3. 제출과 GitHub 이슈화

`POST /api/inquiries`는 rate limit 후 사용자 세션을 검증하고 서버가 actor 종류를 결정한다. 이메일을 복제 저장하지 않는다. 고객 직접 제보만 10분 cron에서 다음 공개 이슈로 변환한다.

- title: `고객 피드백 확인 요청`
- body: 비공개 운영 데이터에서 원문을 확인하라는 고정 문구
- labels: `source:customer-feedback` 단독

자유 텍스트를 마스킹 후 공개하는 방식은 잔여 PII를 보장할 수 없으므로 폐기한다. 생성 성공 후 `github_issue_number`와 `public_status=checking`을 기록한다. 부분 실패는 다음 실행에서 재시도하며 issue number unique index가 DB 중복 연결을 막는다.

## 4. 답변 reconciliation

GitHub webhook 설치·검증을 전제하지 않는다. 같은 멱등 함수를 다음 두 경계가 호출한다.

1. Cloudflare Worker의 기존 `*/10 * * * *` scheduled trigger.
2. 운영자가 필요할 때 `POST /api/internal/reconcile-inquiries`에 Worker secret `INQUIRY_RECONCILE_SECRET`을 `X-Reconcile-Secret` 헤더로 전달한다.

운영 설정 절차:

```bash
npx wrangler secret put INQUIRY_RECONCILE_SECRET
curl -X POST -H "X-Reconcile-Secret: $INQUIRY_RECONCILE_SECRET" \
  https://<DEV_WORKER_HOST>/api/internal/reconcile-inquiries
```

실제 host와 secret은 저장소에 기록하지 않는다. Hermes가 stable DEV rollout에서 secret 설정과 수동 trigger 응답을 검증하며 Production은 이 PR 범위 밖이다.

자동 답변은 GitHub issue가 동시에 다음을 만족할 때만 기록한다.

- `state=closed`
- `state_reason != not_planned`
- `feedback:notify-ready` 라벨 존재

라벨 없는 close, reopen/open, `not_planned` close는 아무 답변도 기록하지 않는다. 이미 `answered`인 행은 조회 대상에서 제외하여 재실행해도 답변을 덮어쓰지 않는다. 응답과 오류 로그에는 사용자 내용·식별자를 남기지 않는다.

## 5. 운영 책임

- 구현 PR은 migration과 Worker/UI 계약 및 합성 테스트까지만 제공한다.
- Hermes가 리뷰·머지 후 stable DEV에 `51_feedback_flywheel.sql` 적용, `GITHUB_TOKEN`의 Issues 권한, 새 reconciliation secret, cron/수동 trigger를 검증한다.
- Production migration·Worker 배포·label 운영 적용은 별도 승인 게이트이며 이 PR에서 수행하지 않는다.
