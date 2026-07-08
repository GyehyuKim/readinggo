# 문의 자동 이슈화 스펙 (inquiries → GitHub 이슈 동기화)

> **신설 (2026-06-17, #701)**: 오픈베타 피드백 루프. 앱 내 "운영자에게 문의"로 들어온 `inquiries` 행을 Worker 크론이 GitHub 이슈로 자동 동기화한다.
> **개정 (2026-06-30, #1105)**: 이슈화 전에 **LLM이 문의를 한 번 정리·분류**(제목 정돈·요약/추정 의도·분류)한다. 원문(마스킹됨)은 본문에 항상 보존하고, LLM 실패/미설정 시 원문만으로 폴백한다 (§4.5).
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수. 데이터 모델 본체는 [backend.md](./backend.md), 문의 수집 UI·admin 대시보드는 [profile.md](./profile.md) 참조.

## 1. 목적·범위

오픈베타에서 사용자 문의량이 늘어난다. 운영자가 admin 대시보드를 수동으로 들여다보는 대신, 문의를 **GitHub 이슈로 자동 전환**해 라벨·담당·마일스톤 등 기존 트리아지 워크플로우에 태운다.

- **In**: `inquiries` 테이블에 새로 쌓이는 행(앱 내 문의 폼 경유, [profile.md](./profile.md) 설정 화면)
- **Out**: `GyehyuKim/readinggo` 레포의 GitHub 이슈 (라벨 `source:beta-inquiry`)
- **범위 밖**: 이슈 → 문의 역방향 동기화(이슈 답변을 앱에 노출)는 후속. 지금은 단방향(inquiry → issue)만.

## 2. 결정 (계휴, 2026-06-17 / #701)

| 안건 | 결정 | 근거 |
|---|---|---|
| PII 처리 | **이메일·user_id 마스킹**. `message`·`app_version`만 게재 + message 본문 이메일 정규식 스크럽 | 레포가 **PUBLIC** → 개인정보 공개 노출 차단 |
| 트리거 | **기존 Worker `scheduled()` 크론 폴링** (신규 cron 식 추가) | 공개 엔드포인트 신설 회피, `SERVICE_ROLE_KEY`·크론 인프라 재사용 |
| 트리아지 | **1:1 + 라벨** + 길이·중복·공백 기본 가드. **LLM 정리·분류**(#1105, §4.5) — 원문→제목·요약·분류, 실패 시 원문 폴백 | SLC. LLM 정리는 가독성↑(예: #1104 화면 복붙으로 의도 불명). 중복 묶기(병합)는 여전히 후속 |
| 멱등성 | `inquiries.github_issue_number` 컬럼 게이트 | 같은 문의 중복 이슈 방지 |

## 3. 데이터 모델

신규 마이그레이션 `32_inquiry_github_sync.sql`(드리프트 정정 2026-07-09 — 29번은 `29_admin_insights_v2.sql`가 선점, 실제 파일은 32번):

```sql
alter table public.inquiries
  add column if not exists github_issue_number int;   -- null = 미동기화, 값 = 생성된 이슈 번호

create index if not exists idx_inquiries_unsynced
  on public.inquiries(created_at) where github_issue_number is null;
```

- `github_issue_number IS NULL` → 미처리 대상. 성공 시 이슈 번호 기록.
- RLS: 컬럼 업데이트는 service_role(Worker)만 수행 → 기존 `inq_upd`(is_admin) 정책 외, service_role은 RLS 우회이므로 추가 정책 불요.

## 4. Worker 로직 (`worker/index.mjs` `scheduled()` 확장)

### 4.1 크론

`wrangler.toml` `[triggers] crons`에 식 추가:

```toml
crons = ["0 18 * * *", "*/10 * * * *"]   # 기존 일일 아카이브 + 10분 주기 문의 동기화
```

`scheduled(event, env, ctx)`에서 `event.cron`으로 분기:
- `"0 18 * * *"` → 기존 일일 아카이브(#239)
- `"*/10 * * * *"` → 문의 동기화

### 4.2 동기화 절차

1. **조회**: service_role로 `inquiries` 중 `github_issue_number IS NULL` 을 `created_at ASC`, **LIMIT 20**(런당 상한 — 폭주·레이트리밋 방어).
2. **가드** (건별 skip, 단 처리완료 표시는 하지 않고 다음 런으로 미룸 또는 sentinel 처리 — §4.3):
   - `char_length(trim(message)) < 5` → 스킵(노이즈)
   - 동일 message 텍스트가 이번 배치 내 이미 처리됨 → 중복으로 간주, 하나만 이슈화
3. **PII 마스킹**:
   - 이슈 본문에 `email`·`user_id` **미포함**
   - `message` 본문에서 이메일 패턴(`/[\w.+-]+@[\w-]+\.[\w.-]+/g`) → `[이메일 가림]` 치환
   - 포함 허용: 마스킹된 message, `app_version`, `created_at`, 내부 `inquiry id`(uuid — 식별 불가, 역추적용)
4. **LLM 정리·분류**(§4.5): 마스킹된 message → `{ title, summary, category }`. 실패/미설정/JSON 깨짐이면 생략(이번 건 원문 폴백).
5. **이슈 생성**: `POST /repos/GyehyuKim/readinggo/issues`
   - title: LLM `title`(한 줄, ≤70자) — 없으면 마스킹된 message 앞 ~50자 + `…`
   - labels: `source:beta-inquiry` + 분류 라벨(**레포 실재 라벨만** — 기능요청 `type:feat` / 버그 `type:bug` / UX `ux` / 문의 `question`, 기타·폴백은 `type:feedback`). 미존재 라벨을 쓰면 GitHub 가 회색 기본 라벨을 새로 만들어 기존 택소노미를 오염시키므로 금지(#1112)
   - body: 아래 §4.4 템플릿(LLM 성공/폴백 2종)
6. **기록**: 성공(201) → `update inquiries set github_issue_number = <number> where id = <id>`. 실패 → 컬럼 그대로 두고 다음 런 재시도.

### 4.3 멱등성·실패

- 게이트는 `github_issue_number IS NULL`. 이슈 생성 성공 후에만 컬럼을 채우므로, 생성됐는데 DB 업데이트가 실패하면 **다음 런에서 중복 생성 가능**. 이를 줄이려 생성 직후 즉시 update, update 실패 시 ctx.waitUntil 재시도 1회. 완전한 exactly-once는 비목표(드문 중복은 수동 정리 허용).

### 4.4 이슈 본문 템플릿

**LLM 성공 시** (요약·분류 + 구분선 + 원문 보존):

```markdown
> 오픈베타 사용자 문의 자동 등록 (LLM 정리·분류 · 원문 보존 · PII 마스킹됨)

**요약·추정 의도**
<LLM summary>

**분류**: <LLM category(버그/기능요청/UX/문의/기타)>

---
**문의 원문 (마스킹됨)**
<마스킹된 message>

---
- app_version: `<app_version>`
- 접수: `<created_at>`
- inquiry: `<uuid>`
```

**폴백 시** (LLM 미설정/실패 — 기존 템플릿, 원문만):

```markdown
> 오픈베타 사용자 문의 자동 등록 (PII 마스킹됨)

**문의 내용**
<마스킹된 message>

---
- app_version: `<app_version>`
- 접수: `<created_at>`
- inquiry: `<uuid>`
```

### 4.5 LLM 정리·분류 (#1105)

- **재사용**: 독서 파트너(#287)와 같은 텍스트 LLM 프록시 `callLLM`(env `LLM_BASE_URL`·`LLM_MODEL`·`UPSTAGE_API_KEY`). 신규 키·엔드포인트 없음, 키는 서버(Worker) 보관(클라 노출 금지).
- **입력**: 마스킹된 message(§4.2-3 PII 마스킹 후). **출력**: JSON `{ title, summary, category }` 하나. category 는 고정 enum `버그|기능요청|UX|문의|기타` — enum 밖이면 `기타`로 정규화.
- **폴백(graceful)**: env 미설정·LLM HTTP 실패·JSON 파싱 실패·핵심 필드 공백 → `null` 반환 → 호출부가 폴백 템플릿(원문만)으로 진행. 문의 손실 없음.
- **환각 가드**: 시스템 프롬프트가 "원문에 없는 사실 추가 금지, 불명확하면 솔직히 명시"를 지시. 원문은 본문에 항상 그대로 보존되므로 운영자가 LLM 요약과 원문을 대조 가능.
- **프라이버시**: 마스킹된 message 텍스트가 LLM 프록시로 전송된다(companion·parse-books 과 동일 경로·posture). 추가 방어로 프롬프트가 이름·전화·이메일을 제목·요약에 옮기지 말도록 지시(§6 자유텍스트 PII 한계는 그대로 적용).

## 5. 보안

- `GITHUB_TOKEN`: fine-grained PAT, **단일 레포(`GyehyuKim/readinggo`)·Issues Read/Write**만. `npx wrangler secret put GITHUB_TOKEN`. 클라 노출 절대 금지(Worker 서버 전용).
- `SUPABASE_SERVICE_ROLE_KEY`: 기존 시크릿 재사용.
- `UPSTAGE_API_KEY`(LLM 정리·분류, §4.5): 기존 시크릿 재사용. 서버 보관, 클라 노출 금지.
- 토큰 회전: 만료/유출 시 PAT 재발급 + 시크릿 갱신.

## 6. 프라이버시 한계 (중요)

구조화 필드(email·user_id)는 마스킹하지만, **사용자가 message 자유 텍스트에 직접 적은 PII**(전화번호·이름 등)는 정규식 스크럽으로 100% 못 잡는다. 완화책:

- 문의 폼에 고지 문구 1줄 추가 권장: "문의는 공개 트래커에 익명으로 등록될 수 있어요 — 개인정보는 적지 말아주세요." ([profile.md](./profile.md) 문의 UI PR에서 처리)
- ⚠️ **현재 마스킹은 이메일 전용**(드리프트 정정 2026-07-09): worker `INQ_EMAIL_RE`만 치환하고 **전화번호 패턴 스크럽은 미구현**. 전화번호 패턴(`\d{2,3}[-.]?\d{3,4}[-.]?\d{4}`) 스크럽 본문 포함은 후속 과제(현재 코드 미반영).

## 7. Admin 대시보드 연동 (옵션·후속)

`AdminDashboardModal` 문의 목록에서 `github_issue_number`가 있으면 `이슈 #N` 배지·링크 노출. 운영자가 앱↔이슈를 오갈 수 있게. 본 스펙의 필수 범위 아님(코드 PR 시 여력되면 포함).

## 8. Open questions

- 스팸 폭주 시 10분 주기·LIMIT 20으로 충분한가 → 베타 초기 물량 보고 cron 주기 조정. 이제 건당 LLM 1콜이 추가돼 런이 길어질 수 있으나, 런이 중간에 끊겨도 미처리 건은 `github_issue_number IS NULL`로 다음 런 재시도(멱등, §4.3) → 안전. 물량 급증 시 LIMIT/주기 재검토.
- ~~라벨 체계: 자동 분류(bug/feature) 라벨은 Phase 2 LLM 분류로.~~ **해결(#1105, §4.5)** — LLM 분류로 레포 실재 라벨 `type:bug`/`type:feat`/`ux`/`question` 부여(기타·폴백 `type:feedback`). 미존재 라벨(`type:feature`/`type:ux`/`type:question`)을 가리키던 버그는 #1112 에서 정정. 중복 문의 **병합**(같은 버그 묶기)은 여전히 후속.
- 닫힌(`status=closed`) 문의도 이슈화할 것인가 → 현재는 status 무관 전건 동기화(미동기화면). 필요시 `status != 'closed'` 필터 추가.
