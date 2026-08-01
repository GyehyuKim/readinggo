# UGC 신고 검토 운영 Runbook

> #1392 · 마이그레이션 `49_ugc_moderation.sql` 적용 후 사용한다. 운영자 계정(`is_admin=true`)만 처리할 수 있다.

## 1. 신고 큐 확인

ReadingGo 운영자 계정으로 로그인한 뒤 **프로필 → 운영 대시보드 → 안전 신고**에서 `open` 상태의 오래된 신고부터 확인한다. 이 화면과 조치 RPC는 모두 서버에서 `is_admin()`을 재검증한다.

필요하면 Supabase Table Editor에서 `moderation_reports`를 읽기 전용으로 교차 확인한다. SQL 예시는 다음과 같다.

```sql
select id, target_type, target_id, reason, detail, status, created_at
from public.moderation_reports
where status = 'open'
order by created_at asc;
```

- `sentence`: `target_id`로 `sentences` 원문과 작성자를 확인한다.
- `user`: `target_id`로 최근 공개 문장과 반복 신고 여부를 확인한다.
- 신고자 개인정보와 신고 상세는 운영 목적 외 사용하거나 공유하지 않는다.

## 2. 판단과 조치

운영 대시보드에서 신고를 열면 먼저 `검토 시작`으로 `reviewed` 상태와 검토자를 기록한 뒤 `기각`, `문장 숨김`, `사용자 정지` 중 하나를 선택한다. 클라이언트는 `moderation_admin_review`·`moderation_admin_action` RPC를 호출하며, 서버는 현재 세션의 운영자 권한을 재검증하고 감사 필드를 남긴다.

- `dismiss`: 위반 아님. 신고자 화면에서 대상이 다시 노출될 수 있다.
- `hide_sentence`: 해당 문장을 모든 공개 조회에서 즉시 제외한다.
- `suspend_user`: 해당 사용자의 프로필과 공개 문장을 모든 사용자에게서 제외한다.
- 중대한 불법·긴급 안전 위험은 `readinggo.admin@gmail.com` 운영 책임자에게 즉시 알린다.

## 3. 처리 SLA

- 긴급 안전·불법 위험: 인지 즉시 우선 검토
- 일반 신고: 영업일 기준 3일 이내 1차 검토
- 반복 신고나 불명확한 사안: 근거를 `moderator_note`에 남기고 보수적으로 숨김 후 재검토

## 4. 검증

1. 신고자 계정에서 신고 대상이 즉시 사라지는지 확인한다.
2. 차단 후 양쪽 사용자의 피드·프로필·팔로우 관계가 제거되는지 확인한다.
3. 운영자 숨김/정지 후 별도 일반 계정에서 대상이 조회되지 않는지 확인한다.
4. `moderation_reports.reviewed_at`, `moderator_id`, `action`, `moderator_note`가 저장되었는지 확인한다.
5. 조치 전후 사용자에게 민감한 신고 상세가 노출되지 않는지 확인한다.
