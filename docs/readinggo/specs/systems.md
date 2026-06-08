# 시스템 로직 (스트릭·방패·XP·휴식코스·NPC)

> **Split from** `docs/2. specifications/_archive/readinggo-spec.md` v6. 원 위치: §6.
> **v7 갱신 (2026-06-01)**: **XP 차감 폐지**, 박수/짹 → **짹 1종으로 통합**, **주간 리그 삭제**, **휴식코스 신설**(상세 미정). "모이"→"한 문장". 둥지·성은 XP와 무관(진척률/완독). 이 파일이 **XP 수치 SSOT** — 타 파일은 링크 참조.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 준수.

## 6. 시스템 로직

### 6.1 스트릭

| 항목 | 규칙 |
|---|---|
| 갱신 조건 | "한 문장" 1개 이상 + 페이지 입력 1회 (= ReadingSession 1행 생성) |
| 갱신 시점 | 입력 즉시 `streak.current += 1`, `last_check_in_date = today` (`DataStore.streak.bumpOnCheckIn`) |
| 미참여 정산 | Phase 0: 날짜 시뮬레이터 / Phase 1: pg_cron (UTC 15:00 = KST 00:00) |
| 활성 책 무관 | 어느 책에 기록하든 1세션 = 스트릭 +1 (책별 아님, 사용자 단위) |

**v7 — 미기록 시**: 스트릭만 위기. 방패 보유 → 방패 1개 소모(스트릭 유지) / 방패 없음 → 스트릭 0 리셋. **둥지·XP·성은 그대로 존속**(집은 안 무너진다). 1차 KPI는 "하루 1회 방문".

### 6.2 방패 (Shield)

> *보조 안전망*. (v7: 첫 7일 보호 주축이던 운영자 짹은 폐기됨.)

| 항목 | 규칙 |
|---|---|
| 초기 보유 | 0개 |
| 최초 지급 | 첫 7일 연속 스트릭 달성 시 +1 |
| 보충 규칙 | 방패 1개 소모 후 7일 뒤 +1 |
| 최대 보유 | 3개 |
| 자동 적용 | 미참여 → 방패 1개 소모, 스트릭 유지. 0개면 스트릭 0 리셋 |
| 결제 구매 | 보류 (수익 모델, [§13.6](./meta/open-issues.md)) |

배치(Phase 1, pg_cron UTC 15:00):

```sql
update streak
set shields_remaining = case when shields_remaining > 0 then shields_remaining - 1 else 0 end,
    current = case when shields_remaining > 0 then current else 0 end
where last_check_in_date < current_date - interval '1 day';

update streak s
set shields_remaining = least(s.shields_remaining + 1, 3)
from shield_log l
where l.user_id = s.user_id and l.consumed_at <= now() - interval '7 days' and l.refunded = false;

update shield_log set refunded = true
where consumed_at <= now() - interval '7 days' and refunded = false;

update streak
set shields_remaining = least(shields_remaining + 1, 3), first_shield_granted = true
where current >= 7 and first_shield_granted = false;
```

### 6.3 XP / 배지 — **XP 수치 SSOT**

> **v7.1 (2026-06-04) — 행동 가중치 위계**: 핵심 기여(읽고 한 줄) > 능동 반응(주는 짹) > 단순 방문. 일일 미션 +10→**+20**, **주는 짹 +5**·**방문 +2** 신설. "받은 짹 +1"은 **유지**(가법). [decisions §8.7](./meta/decisions.md) 비준.

| 행동 | XP | 비고 |
|---|---|---|
| 책 읽고 한 줄 기록 (일일 미션) | **+20** | 핵심 기여 — 하루 첫 세션만. 가장 높은 비중 |
| 타인 글에 짹 (능동 반응/engagement) | **+5** | 일 최대 +20(4회). 해제 시 차감 없음 *(v7.1 신설)* |
| 단순 방문 / 피드 열람 | **+2** | 하루 첫 열람 1회. 가장 낮지만 0 아님 *(v7.1 신설)* |
| 짹 받음 (내 한 문장에 받은 좋아요) | **+1** | 일 최대 +20. 사회적 화폐(Phase 1/서버) |
| 챕터 완료 | +50 | **후순위**(챕터 기능 보류) |
| 책 완독 | **+200** | + 🏰 성 1개([nest.md §5.2.1](./nest.md)) |
| 7일 스트릭 | +100 + 배지 | |
| 30일 스트릭 | +500 + 배지 | |
| 50일 스트릭 | +1,000 + 배지 + 공유 카드 | **후순위** |
| 100일 스트릭 | +2,000 + 배지 + 공유 카드 | **후순위** |

**v7 — 차감 없음.** 미기록·미방문으로 XP를 깎지 않는다(회복탄력성). XP 최솟값 0, 단조 증가.

레벨: `level = floor(sqrt(xp / 100)) + 1`. **초반 쉽게, 후반 더디게**(레벨 간 필요 XP 100→300→500…).

**둥지·성·XP 관계 (v7.4, #313)**: **둥지 단계 = 누적 XP(레벨)** — 읽기·문장·짹 등 전체 활동 반영, 책 무관·유지([nest.md §5.2](./nest.md)). 성 = 완독 권수(책별). XP = 행동 누적(상단바·레벨). 둥지와 XP는 **같은 누적축의 다른 표현**(둥지=시각화), 성은 별개 축.

> **XP destination 미해결** ([§13.1](./meta/open-issues.md)): XP를 *무엇에 쓰는지*는 여전히 미정(누적+레벨업뿐). Duolingo 벤치마킹 금지 하 별도 세션. 학기 데모는 누적만으로 진행.

### 6.4 NPC 운영 — 배치

`npc_sentence_seeds(npc_id, text)` NPC별 60~100개 시드. Phase 0 시드/시뮬, Phase 1 pg_cron(KST 00:00).

```sql
-- NPC 진도 증가
update user_books ub set current_page = least(current_page + u.daily_pace, b.total_pages)
from users u, books b
where ub.user_id = u.id and ub.book_id = b.id and u.is_npc = true;

-- 시드 한 문장 추첨 insert
insert into sentences (user_id, user_book_id, text, page, created_at)
select u.id, ub.id,
       (select text from npc_sentence_seeds s where s.npc_id = u.id order by random() limit 1),
       ub.current_page, now()
from users u join user_books ub on ub.user_id = u.id
where u.is_npc = true;

-- NPC 랜덤 짹 (오늘 활동한 실유저 한 문장 일부)
insert into claps (from_user_id, to_sentence_id)
select npc.id, s.id
from users npc, sentences s
where npc.is_npc = true and s.created_at::date = current_date and s.user_id <> npc.id
order by random() limit 5;
```

NPC 페르소나:

| 핸들 | 표시명 | daily_pace | 톤 |
|---|---|---|---|
| `@book_bear` | 책읽는곰돌이 | 5p | 따뜻함, 짧은 감상 |
| `@activist_raccoon` | 활자라쿤 | 12p | 분석적, 인용 위주 |

### 6.5 ~~주간 리그~~ — v7 폐기

리그 기능 **삭제**(경쟁 자극보다 다정함 톤 우선). 관련 DB·쿼리·소셜 탭 노출 모두 제거. 재검토 트리거: 사용자 인터뷰에서 경쟁 요구 명시 시 ([rejected.md §14.2](./meta/rejected.md)).

### 6.6 휴식코스 (Pause) — v7 채택, **상세 미정 (승원 결정 필요)**

장기출장·시험기간·회사 프로젝트로 바쁜 사용자를 위해 스트릭을 일시 동결. **채택 확정**, 파라미터 미정.

**확정해야 할 것**:
- 최대 기간(일) · 빈도(월 N회 무료?)
- 동결 방식: 스트릭 정지 vs 방패 자동 소모 면제
- 사전 선언 UX · 복귀 화면

**임시 기본값 (feature-spec 기반, 확정 전 placeholder)**: 1~7일 사전 선언, 월 1회 무료, 선언 기간 스트릭 동결.

데이터: 확정 시 `pause_log` 테이블을 [backend.md §7.3](./backend.md)에 추가.
