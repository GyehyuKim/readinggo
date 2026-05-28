# 시스템 로직 (스트릭·방패·XP·NPC·리그)

> **Split from** `docs/2. specifications/readinggo-spec.md` v6 (2026-05-28 분할). 원 위치: §6. 변경 이력은 git log 참조.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.

## 6. 시스템 로직

### 6.1 스트릭

| 항목 | 규칙 |
|---|---|
| 갱신 조건 | "오늘의 문장" 1개 이상 + 페이지 입력 1회 (= ReadingSession 1행 생성) |
| 갱신 시점 | 입력 즉시 `streak.current += 1`, `last_check_in_date = today` |
| 미참여 정산 | pg_cron (UTC 15:00 = KST 00:00) |
| 활성 책 무관 | 어느 책에 기록하든 1세션 = 스트릭 +1 (책별 스트릭 아님, 사용자 단위) |

### 6.2 방패 (Shield)

> **v5 위상 변경**: 첫 7일 보호의 *주축* 은 §5.6 운영자 짹으로 이전. 방패는 *보조 안전망* 으로 위상 조정. 메카닉 자체는 v4.4 유지.

| 항목 | 규칙 |
|---|---|
| 초기 보유 | 0개 |
| 최초 지급 | 첫 7일 연속 스트릭 달성 시 +1 |
| 보충 규칙 | 방패 1개 소모 후 7일 뒤 +1 |
| 최대 보유 | 3개 |
| 자동 적용 | 미참여 → 방패 1개 소모, 스트릭 유지. 0개면 스트릭 0 리셋 |
| 결제 구매 | Phase 2 이후 검토 |

배치(pg_cron, UTC 15:00):

```sql
select cron.schedule(
  'streak-shield-daily',
  '0 15 * * *',
  $$
    update streak
    set
      shields_remaining = case when shields_remaining > 0 then shields_remaining - 1 else 0 end,
      current = case when shields_remaining > 0 then current else 0 end
    where last_check_in_date < current_date - interval '1 day';

    update streak s
    set shields_remaining = least(s.shields_remaining + 1, 3)
    from shield_log l
    where l.user_id = s.user_id
      and l.consumed_at <= now() - interval '7 days'
      and l.refunded = false;

    update shield_log set refunded = true
    where consumed_at <= now() - interval '7 days' and refunded = false;

    update streak
    set shields_remaining = least(shields_remaining + 1, 3),
        first_shield_granted = true
    where current >= 7 and first_shield_granted = false;
  $$
);
```

### 6.3 XP / 배지

| 행동 | XP | 비고 |
|---|---|---|
| 일일 미션 완료 | +10 | |
| 챕터 완료 (해당 시) | +50 | |
| 책 완독 | +200 | |
| 박수 받음 (일일 +20 상한) | +5 | |
| **친구 짹 받음 (v5 신설)** | **+1** | |
| 7일 스트릭 | +100 + 배지 | |
| 30일 스트릭 | +500 + 배지 | |
| **50일 스트릭 (v6 신설)** | **+1,000 + 배지 + 공유 카드** | SNS 이미지 카드 자동 생성 |
| **100일 스트릭 (v6 신설)** | **+2,000 + 배지 + 공유 카드** | SNS 이미지 카드 자동 생성 |

레벨 계산: `level = floor(sqrt(xp / 100)) + 1` (Phase 1 시점 재조정 가능).

**v5 — XP 의미 변경**:

친구 짹 = +1 XP 는 *작은 화폐* 처럼 느끼게 하는 의도. 사용자가 입력 직후 받는 짹들이 *눈에 보이는 보상* 으로 누적된다는 즉시 보상 회로. 박수(+5) 와는 별개 — 짹은 빈도가 높으니 단가는 낮게.

**XP destination — 미해결 (§13)**:

현재 v5도 XP는 *누적 숫자 + 레벨업* 뿐. 무엇에 쓰는지·왜 모으는지·소진되는지는 미정. 이 결정은 *Duolingo 벤치마킹 금지* 제약 하에 별도 세션에서 독립 발상 필요 (§13).

### 6.4 NPC 운영 — pg_cron 배치

`npc_sentence_seeds(npc_id, text)` NPC별 60~100개 시드.

배치(매일 KST 00:00, streak 배치와 묶음):

```sql
-- NPC 진도 증가
update user_books ub
set current_page = least(current_page + u.daily_pace, b.total_pages)
from users u, books b
where ub.user_id = u.id and ub.book_id = b.id and u.is_npc = true;

-- 시드 문장 추첨 후 sentences insert
insert into sentences (user_id, user_book_id, text, page, created_at)
select u.id, ub.id,
       (select text from npc_sentence_seeds s where s.npc_id = u.id order by random() limit 1),
       ub.current_page, now()
from users u join user_books ub on ub.user_id = u.id
where u.is_npc = true;

-- NPC 랜덤 박수 (오늘 활동한 실유저 일부)
insert into claps (from_user_id, to_session_id)
select npc.id, s.id
from users npc, reading_sessions s
where npc.is_npc = true and s.session_date = current_date and s.user_id <> npc.id
order by random()
limit 5;
```

NPC 페르소나:

| 핸들 | 표시명 | daily_pace | 시드 책 큐 | 톤 |
|---|---|---|---|---|
| `@book_bear` | 책읽는곰돌이 | 5p | 사피엔스, 데미안, 어린왕자, … | 따뜻함, 짧은 감상 |
| `@activist_raccoon` | 활자라쿤 | 12p | 1984, 총균쇠, 코스모스, … | 분석적, 인용 위주 |

### 6.5 주간 리그

> **소셜 탭 UI에서 제거** (v4.4, 5/14 회의). 로직 및 DB는 Phase 1에서 유지하되 화면 노출 안 함. 향후 재노출 여부 별도 결정.

| 항목 | 규칙 |
|---|---|
| 집계 단위 | 본인 + 팔로잉 + NPC |
| 점수 | 그 주(월~일) XP 누적 |
| 리셋 | 매주 월 00:00 KST (pg_cron) — 표시는 시작 시점부터 0 |
| 표시 | 소셜 탭 상단 카드. 상위 N명(N=10) + 본인은 항상 강조 표시 |
| 배지 | 🥇🥈🥉 1~3위, 4위 이하 숫자. 본인 row 배경 #F0FDF4 |

집계 쿼리 예시:

```sql
select u.id, u.handle, u.display_name,
       coalesce(sum(rs.xp_earned), 0) as week_xp
from users u
left join reading_sessions rs
  on rs.user_id = u.id
  and rs.session_date >= date_trunc('week', current_date)
where u.id in (
    select following_id from follows where follower_id = $me
  ) or u.id = $me or u.is_npc = true
group by u.id
order by week_xp desc
limit 10;
```

---

