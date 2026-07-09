-- 40_rls_anon_lockdown.sql
-- #1165 [P0 출시블로커] anon 전체 읽기 차단 — 전 사용자 PII 유출 봉쇄.
--
-- 문제: users·user_books·reading_sessions·streak·sentences·follows·claps 의 select 정책이
--   using(true) + `grant select on all tables to anon` 라, publishable key 만으로 anon 이
--   전 사용자의 독서기록·별점·리뷰텍스트·문장(+my_note)·스트릭·프로필을 읽었다(라이브 실증 #1165).
--
-- 픽스: 위 PII 테이블 select 를 로그인 사용자(auth.uid() is not null)에게만 허용 + 방어심층으로
--   anon 테이블 grant 회수. 익명 로그인 비활성(external_anonymous_users_enabled=false)이라
--   auth.uid() 우회 불가.
-- 유지(공개): books·npc_sentence_seeds(게스트 카탈로그·시드), villages(자체 visibility 정책).
-- 범위 밖: 인증 사용자 간 컬럼/행 프라이버시(예: 남의 my_note)는 #1166 에서 view/RPC 로 별도 처리.

-- 1) select 정책을 로그인 사용자 한정으로 (using(true) → auth.uid() is not null)
alter policy users_sel   on public.users            using (auth.uid() is not null);
alter policy ub_sel      on public.user_books       using (auth.uid() is not null);
alter policy sess_sel    on public.reading_sessions using (auth.uid() is not null);
alter policy streak_sel  on public.streak           using (auth.uid() is not null);
alter policy sent_sel    on public.sentences        using (auth.uid() is not null);
alter policy follows_sel on public.follows          using (auth.uid() is not null);
alter policy claps_sel   on public.claps            using (auth.uid() is not null);

-- 2) 방어심층 — anon 테이블 select grant 회수(정책이 뚫려도 anon 은 테이블 권한 자체가 없음)
revoke select on
  public.users, public.user_books, public.reading_sessions,
  public.streak, public.sentences, public.follows, public.claps
from anon;
