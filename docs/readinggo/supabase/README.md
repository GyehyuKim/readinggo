# Supabase 마이그레이션 런북

ReadingGo의 DB 변경(테이블·RLS 정책·함수)은 이 폴더의 SQL 파일로 관리한다.
**파일을 머지해도 라이브 DB에 자동 반영되지 않는다 — 누군가 한 번 실행해야 한다.** 그 절차가 이 문서다.

> 목표: DB 적용이 한 사람(계휴) 병목이 되지 않게, 동료 누구나 안전하게 적용할 수 있게 한다.

---

## 1. 파일 규약

| 파일 | 의미 |
|---|---|
| `schema.sql` | 전체 스키마 스냅샷. **새 환경 부트스트랩**에만 사용 |
| `NN_description.sql` | 증분 마이그레이션. 번호 오름차순(02, 03, … 14, …) |
| `admin-cli.mjs` · `seed_npc.mjs` | 운영 도구 (아래 §4) |

새 마이그레이션은 **다음 번호 + 짧은 설명**으로 만든다 (예: `15_add_poke_table.sql`).

### 멱등성 (필수)
재실행해도 안전하도록 작성한다. 누가 이미 돌렸는지 추적 테이블이 없기 때문이다.
- 함수: `create or replace function ...`
- 정책: `drop policy if exists ... ;` 후 `create policy ...`
- 테이블/컬럼: `create table if not exists` · `add column if not exists`

---

## 2. 적용 방법 — 동료용 (Supabase SQL Editor, 권장)

키·CLI 없이 대시보드에서 바로 한다.

1. <https://supabase.com/dashboard> 로그인 → ReadingGo 프로젝트 선택
2. 좌측 **SQL Editor** → **New query**
3. 적용할 `NN_*.sql` 파일 내용을 **그대로 붙여넣기** → **Run**
4. 성공하면 해당 PR/이슈에 **"✅ 적용 완료 (YYYY-MM-DD, 본인이름)"** 코멘트를 남긴다 ← 중복 실행·누락 방지

> 권한이 없어 프로젝트가 안 보이면 계휴에게 **Developer 역할 초대**를 요청한다 (§3).

---

## 3. 프로젝트 멤버 초대 — 관리자(계휴)용

동료가 직접 SQL을 돌리려면 Supabase 프로젝트 멤버여야 한다. **Management PAT(`sbp_`) 키를 나눠주지 않는다** — 대신 대시보드 멤버로 초대한다.

1. <https://supabase.com/dashboard> → **Organization** → **Team / Members**
2. **Invite member** → 동료 이메일 입력
3. 역할 **Developer** 선택 (SQL Editor 사용 가능, 결제·삭제 등 조직 관리 불가)
4. 초대 메일 수락 후 §2 절차로 각자 적용

역할 참고: Owner(전권) > Administrator(설정) > **Developer(SQL/데이터 작업)** > Read-only.

---

## 4. admin-cli — 계휴 전용 (Management PAT 필요)

로컬에서 파일을 바로 적용하는 도구. **`sbp_` PAT가 있는 계휴만** 사용. 키는 `.env`에 두고 절대 공유·커밋 금지.

```bash
cd docs/readinggo/supabase
node admin-cli.mjs sql 14_fix_village_rls_recursion.sql   # 파일 실행
node admin-cli.mjs sql-inline "select 1;"                  # 인라인 SQL
node admin-cli.mjs state                                   # 카운트 점검
```

---

## 5. 적용 순서

- **기존 라이브 DB**: 새로 추가된 `NN_*.sql`만 번호순으로 적용.
- **완전 새 환경**: `schema.sql` → `02_*.sql` … `NN_*.sql` 순서대로 전부.

---

## 6. 향후 (선택) — CI 자동 적용

`supabase/migrations/` 구조 + GitHub Actions Secret(DB 접속정보)로 main 머지 시 `supabase db push` 자동화하면 사람이 DB를 안 건드려도 된다. 잘못된 마이그레이션이 prod에 바로 적용되므로 PR 리뷰 게이트가 전제. 지금은 §2(수동 SQL Editor) 운영.
