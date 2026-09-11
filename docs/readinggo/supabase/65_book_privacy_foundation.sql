-- #1619 foundation. Apply only with coordinated client cutover; old public reads fail closed.
-- No legacy note is classified or copied. Existing IDs/text/timestamps remain unchanged.
begin;
alter table public.user_books add column if not exists visibility text not null default 'private'
  check (visibility in ('public','private'));
alter table public.user_books add column if not exists visibility_revision bigint not null default 0;
alter table public.sentences add column if not exists publishable_thought text
  check (publishable_thought is null or char_length(publishable_thought)<=1000);

create table if not exists public.book_visibility_requests (
  user_book_id uuid not null references public.user_books(id),
  request_id uuid not null,
  expected_revision bigint not null,
  visibility text not null,
  applied_revision bigint not null,
  created_at timestamptz not null default now(),
  primary key(user_book_id,request_id)
);
alter table public.book_visibility_requests enable row level security;
revoke all on public.book_visibility_requests from public, anon, authenticated;

create table if not exists public.sentence_conversation_turns (
  id uuid primary key default gen_random_uuid(),
  sentence_id uuid not null references public.sentences(id),
  user_id uuid not null references public.users(id),
  role text not null check(role in ('user','assistant')),
  content text not null check(char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.sentence_conversation_turns enable row level security;
revoke all on public.sentence_conversation_turns from public,anon,authenticated;
grant select,insert,delete on public.sentence_conversation_turns to authenticated;
drop policy if exists conversation_owner on public.sentence_conversation_turns;
create policy conversation_owner on public.sentence_conversation_turns for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid() and exists (
    select 1 from public.sentences s join public.user_books ub on ub.id=s.user_book_id
    where s.id=sentence_id and s.user_id=auth.uid() and ub.user_id=auth.uid()));

-- Restrictive fences also intersect any historical permissive policies.
drop policy if exists book_private_fence on public.user_books;
create policy book_private_fence on public.user_books as restrictive for select to authenticated
  using(user_id=auth.uid());
drop policy if exists sentence_private_fence on public.sentences;
create policy sentence_private_fence on public.sentences as restrictive for select to authenticated
  using(user_id=auth.uid());
revoke select on public.user_books,public.sentences from anon;
-- Legacy definer view cannot bypass the fence. Replacement RPC below excludes session/my_note.
create or replace view public.sentences_public as
 select s.id,s.user_id,s.user_book_id,s.session_id,s.page,s.text,s.created_at
 from public.sentences s where false;

create or replace function public.book_public_allowed(p_user_book_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_books ub where ub.id=p_user_book_id
  and ub.visibility='public'
  and not exists(select 1 from public.moderation_suspended_users x where x.user_id=ub.user_id)
  and not exists(select 1 from public.user_blocks b where
    (b.blocker_id=auth.uid() and b.blocked_id=ub.user_id) or
    (b.blocked_id=auth.uid() and b.blocker_id=ub.user_id))
  and not exists(select 1 from public.moderation_reports r where r.reporter_id=auth.uid()
    and r.target_type='user' and r.target_id=ub.user_id and r.status<>'dismissed'));
$$;
revoke all on function public.book_public_allowed(uuid) from public,anon,authenticated;

create or replace function public.book_visibility_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if TG_OP='INSERT' then
  if current_user<>'postgres' and (new.visibility<>'private' or new.visibility_revision<>0) then
   raise exception 'visibility_rpc_required' using errcode='42501'; end if;
 elsif current_user<>'postgres' and (new.visibility is distinct from old.visibility
   or new.visibility_revision is distinct from old.visibility_revision
   or new.user_id is distinct from old.user_id) then
  raise exception 'visibility_rpc_required' using errcode='42501';
 end if;
 return new;
end $$;
drop trigger if exists book_visibility_guard on public.user_books;
create trigger book_visibility_guard before insert or update on public.user_books
 for each row execute function public.book_visibility_guard();

create or replace function public.book_visibility_owner(p_user_book_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',id,'visibility',visibility,'revision',visibility_revision)
 from public.user_books where id=p_user_book_id and user_id=auth.uid();
$$;
create or replace function public.book_set_visibility(
 p_user_book_id uuid,p_visibility text,p_expected_revision bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_book public.user_books; v_request public.book_visibility_requests;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_visibility is null or p_visibility not in ('public','private') or p_request_id is null
   or p_expected_revision is null or p_expected_revision<0 then
  raise exception 'invalid_visibility_request' using errcode='22023'; end if;
 select * into v_book from public.user_books where id=p_user_book_id and user_id=auth.uid() for update;
 if not found then raise exception 'book_not_found' using errcode='P0002'; end if;
 select * into v_request from public.book_visibility_requests
  where user_book_id=p_user_book_id and request_id=p_request_id;
 if found then
  if v_request.visibility<>p_visibility or v_request.expected_revision<>p_expected_revision then
   raise exception 'idempotency_conflict' using errcode='22023'; end if;
  -- Return CURRENT state, never replay stale public success after another device withdrew it.
  return public.book_visibility_owner(p_user_book_id)||jsonb_build_object(
   'replayed',true,'appliedRevision',v_request.applied_revision);
 end if;
 if v_book.visibility_revision<>p_expected_revision then
  raise exception 'visibility_revision_conflict' using errcode='40001'; end if;
 if p_visibility='public' and (not public.moderation_terms_accepted(auth.uid())
   or public.moderation_user_suspended(auth.uid())) then
  raise exception 'publication_not_allowed' using errcode='42501'; end if;
 update public.user_books set visibility=p_visibility,visibility_revision=visibility_revision+1
 where id=p_user_book_id returning * into v_book;
 insert into public.book_visibility_requests(user_book_id,request_id,expected_revision,visibility,applied_revision)
 values(p_user_book_id,p_request_id,p_expected_revision,p_visibility,v_book.visibility_revision);
 return public.book_visibility_owner(p_user_book_id)||jsonb_build_object(
  'replayed',false,'appliedRevision',v_book.visibility_revision);
end $$;
alter function public.book_set_visibility(uuid,text,bigint,uuid) owner to postgres;
revoke all on function public.book_set_visibility(uuid,text,bigint,uuid) from public,anon;
revoke all on function public.book_visibility_owner(uuid) from public,anon;
grant execute on function public.book_set_visibility(uuid,text,bigint,uuid),
 public.book_visibility_owner(uuid) to authenticated;

-- Validate ownership even for definer/legacy writers; no per-sentence visibility authority.
create or replace function public.sentence_book_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_book public.user_books;
begin
 select * into v_book from public.user_books where id=new.user_book_id for share;
 if not found or v_book.user_id<>new.user_id or
   (auth.uid() is not null and new.user_id<>auth.uid()) then
  raise exception 'sentence_parent_mismatch' using errcode='42501'; end if;
 if v_book.visibility='public' and (not public.moderation_terms_accepted(new.user_id)
   or public.moderation_user_suspended(new.user_id)) then
  raise exception 'publication_not_allowed' using errcode='42501'; end if;
 return new;
end $$;
drop trigger if exists sentence_book_guard on public.sentences;
create trigger sentence_book_guard before insert or update on public.sentences
 for each row execute function public.sentence_book_guard();
-- Legacy visibility must neither authorize nor prevent private owner writes.
drop policy if exists sent_ins on public.sentences;
drop policy if exists sent_upd on public.sentences;
create policy sent_ins on public.sentences for insert to authenticated with check(user_id=auth.uid());
create policy sent_upd on public.sentences for update to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.book_public(p_user_book_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',ub.id,'bookId',b.id,
  'book',jsonb_build_object('title',b.title,'author',b.author,'coverUrl',b.cover_url),
  'author',jsonb_build_object('displayName',u.display_name,'handle',u.handle,'avatarUrl',u.avatar_url))
 from public.user_books ub join public.books b on b.id=ub.book_id join public.users u on u.id=ub.user_id
 where ub.id=p_user_book_id and public.book_public_allowed(ub.id);
$$;
create or replace function public.book_public_quotes(p_user_book_id uuid,p_sentence_id uuid default null)
returns table(id uuid,user_book_id uuid,page integer,text text,thought text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select s.id,s.user_book_id,s.page,s.text,s.publishable_thought,s.created_at
 from public.sentences s join public.user_books ub on ub.id=s.user_book_id and ub.user_id=s.user_id
 where ub.id=p_user_book_id and public.book_public_allowed(ub.id)
  and (p_sentence_id is null or s.id=p_sentence_id)
  and not exists(select 1 from public.moderation_hidden_sentences h where h.sentence_id=s.id)
  and not exists(select 1 from public.moderation_reports r where r.reporter_id=auth.uid()
    and r.target_type='sentence' and r.target_id=s.id and r.status<>'dismissed')
 order by s.created_at,s.id;
$$;
revoke all on function public.book_public(uuid),public.book_public_quotes(uuid,uuid) from public;
grant execute on function public.book_public(uuid),public.book_public_quotes(uuid,uuid) to anon,authenticated,service_role;
commit;
