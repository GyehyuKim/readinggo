# 문의 직접 대응 정책

> **운영 결정 (2026-08-14)**: 고객 문의를 GitHub 이슈로 자동 전환하거나 LLM으로 분류·요약하지 않는다. 앱에서 접수한 문의는 운영자가 관리자 대시보드에서 직접 확인하고 개별 직접 대응한다. 기존 자동화 결정(#701)과 후속 flywheel 구현(#1407, #1428)은 폐기한다.

## 1. 범위

- 사용자는 설정 화면의 `운영자에게 문의`에서 문의를 남길 수 있다.
- 클라이언트는 `DataStore.inquiries.create({ message })`로 `inquiries` 테이블에 저장한다.
- 운영자는 관리자 대시보드에서 문의 원문·앱 버전·회신 이메일을 확인한다.
- 답변은 문의별로 직접 작성해 이메일로 보낸다.
- 운영자는 대시보드에서 문의 상태를 `open → answered → closed`로 관리할 수 있다.

## 2. 자동화 금지

다음 경로를 운영하지 않는다.

- Worker cron을 통한 문의 폴링
- 문의 원문의 LLM 요약·분류
- 문의의 GitHub 이슈 자동 생성
- GitHub label·close 상태의 앱 역동기화
- 공개 Worker `/api/inquiries` 또는 reconciliation endpoint
- 문의 자동화 목적의 `GITHUB_TOKEN`·`INQUIRY_RECONCILE_SECRET`

Worker의 scheduled handler는 도서 아카이브·선충전·쪽수 보강 같은 일일 작업만 실행한다. `wrangler.toml`에는 문의용 `*/10` cron을 두지 않는다.

## 3. 개인정보와 공개 범위

- 문의 원문·이메일·사용자 ID·내부 inquiry ID를 공개 GitHub 저장소에 자동 게시하지 않는다.
- 운영자는 관리자 권한이 있는 대시보드에서만 문의 원문을 확인한다.
- 이메일 답장에는 해당 고객 문의에 필요한 내용만 포함한다.
- 문의 데이터를 별도 외부 LLM이나 트래커로 자동 전송하지 않는다.

## 4. 레거시 데이터

과거 migration이 추가한 `github_issue_number`, `public_status`, claim 관련 컬럼과 인덱스는 즉시 삭제하지 않는다. 현재 실행 코드에서는 사용하지 않으며, 데이터 삭제나 DB rollback은 별도 검토 없이 수행하지 않는다.

기존에 자동 생성된 GitHub 이슈는 감사 기록으로 남긴다. 새 문의는 자동 이슈화하지 않는다.

## 5. 검증 계약

- `worker/index.mjs`에 `syncInquiries`, 문의 GitHub POST, 문의 reconciliation 로직이 없어야 한다.
- `wrangler.toml`에 문의용 `*/10 * * * *` cron이 없어야 한다.
- 앱의 직접 문의 저장과 관리자 문의 목록·상태 변경·이메일 답장 UI는 유지되어야 한다.
- DEV와 Production의 `/api/inquiries` 경로는 `404`여야 한다. 문의 저장은 공개 Worker endpoint가 아니라 인증된 Supabase DataStore 경로를 사용한다.

문의 수집 UI는 [profile.md](./profile.md), 관리자 화면은 [admin-dashboard.md](./admin-dashboard.md), 데이터 계약은 [backend.md](./backend.md)를 따른다.
