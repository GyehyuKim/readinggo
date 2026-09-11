-- #1619 private import and retained reader completion. No legacy raw note publication.
begin;
create or replace function public.sentence_import_private(
 p_user_book_id uuid,p_sentence_id uuid,p_text text,p_page integer default null,
 p_session_id uuid default null,p_my_note text default null,p_thought text default null,
 p_created_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.user_books; s public.sentences;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_sentence_id is null or p_text is null or char_length(p_text) not between 1 and 1000 then
  raise exception 'invalid_import' using errcode='22023'; end if;
 -- Same lock as book_set_visibility: no check/insert race with publication.
 select * into b from public.user_books where id=p_user_book_id and user_id=auth.uid() for update;
 if not found then raise exception 'book_not_found' using errcode='P0002'; end if;
 select * into s from public.sentences where id=p_sentence_id;
 if found then
  if s.user_id<>auth.uid() or s.user_book_id<>p_user_book_id or s.text is distinct from p_text
   or s.page is distinct from p_page or s.session_id is distinct from p_session_id
   or s.my_note is distinct from p_my_note or s.publishable_thought is distinct from p_thought
   or (p_created_at is not null and s.created_at is distinct from p_created_at) then
   raise exception 'idempotency_conflict' using errcode='22023'; end if;
  return to_jsonb(s); -- replay has no write, even after later explicit publication
 end if;
 if b.visibility<>'private' then raise exception 'import_requires_private_book' using errcode='42501'; end if;
 if p_session_id is not null and not exists(select 1 from public.reading_sessions
  where id=p_session_id and user_id=auth.uid() and user_book_id=p_user_book_id) then
  raise exception 'invalid_import_session' using errcode='42501'; end if;
 insert into public.sentences(id,user_id,user_book_id,session_id,text,page,my_note,publishable_thought,created_at,kind)
 values(p_sentence_id,auth.uid(),p_user_book_id,p_session_id,p_text,p_page,p_my_note,p_thought,coalesce(p_created_at,now()),'quote')
 returning * into s;
 return to_jsonb(s);
end $$;
revoke all on function public.sentence_import_private(uuid,uuid,text,integer,uuid,text,text,timestamptz) from public,anon;
grant execute on function public.sentence_import_private(uuid,uuid,text,integer,uuid,text,text,timestamptz) to authenticated;
create or replace function public.book_public(p_user_book_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',ub.id,'bookId',b.id,'status',ub.status,'completedAt',ub.completed_at,
  'rating',ub.rating,'reviewText',ub.review_text,'currentPage',ub.current_page,
  'book',jsonb_build_object('title',b.title,'author',b.author,'coverUrl',b.cover_url),
  'author',jsonb_build_object('displayName',u.display_name,'handle',u.handle,'avatarUrl',u.avatar_url))
 from public.user_books ub join public.books b on b.id=ub.book_id join public.users u on u.id=ub.user_id
 where ub.id=p_user_book_id and public.book_public_allowed(ub.id);
$$;
create or replace function public.sentence_public(p_sentence_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',s.id,'userId',s.user_id,'userBookId',s.user_book_id,
  'bookId',ub.book_id,'page',s.page,'text',s.text,'thought',s.publishable_thought,
  'clapCount',(select count(*) from public.claps c where c.to_sentence_id=s.id),
  'createdAt',s.created_at,'parent',public.book_public(ub.id))
 from public.sentences s join public.user_books ub on ub.id=s.user_book_id and ub.user_id=s.user_id
 where s.id=p_sentence_id and public.sentence_public_allowed(s.id);
$$;
create or replace function public.sentences_public_feed(
 p_book_id uuid default null,p_owner_id uuid default null,p_limit integer default 20,p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select public.sentence_public(s.id)
 from public.sentences s join public.user_books ub on ub.id=s.user_book_id and ub.user_id=s.user_id
 where (p_book_id is null or ub.book_id=p_book_id) and (p_owner_id is null or ub.user_id=p_owner_id)
 and public.sentence_public_allowed(s.id)
 order by s.created_at desc,s.id desc
 limit least(50,greatest(1,coalesce(p_limit,20))) offset greatest(0,coalesce(p_offset,0));
$$;
create or replace function public.user_books_public(p_owner_id uuid,p_limit integer default 20,p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select public.book_public(ub.id) from public.user_books ub
 where ub.user_id=p_owner_id and public.book_public_allowed(ub.id)
 order by ub.id
 limit least(50,greatest(1,coalesce(p_limit,20))) offset greatest(0,coalesce(p_offset,0));
$$;
create or replace function public.book_public_quotes(p_user_book_id uuid,p_sentence_id uuid default null)
returns table(id uuid,user_book_id uuid,page integer,text text,thought text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select s.id,s.user_book_id,s.page,s.text,s.publishable_thought,s.created_at
 from public.sentences s where s.user_book_id=p_user_book_id
 and (p_sentence_id is null or s.id=p_sentence_id) and public.sentence_public_allowed(s.id)
 order by s.created_at,s.id;
$$;
commit;
