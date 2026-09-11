-- #1619: immutable identities, atomic private turn batches, owner/parent fences.
begin;
alter table public.sentence_conversation_turns add column if not exists turn_order bigint generated always as identity;
create or replace function public.sentence_conversation_import(p_sentence_id uuid,p_turns jsonb)
returns setof public.sentence_conversation_turns
language plpgsql security definer set search_path=public,pg_temp as $$
declare t jsonb; old public.sentence_conversation_turns; tid uuid; stamp timestamptz;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 perform 1 from public.sentences s join public.user_books b on b.id=s.user_book_id
 where s.id=p_sentence_id and s.user_id=auth.uid() and b.user_id=auth.uid() for update of s;
 if not found then raise exception 'sentence_not_found' using errcode='42501'; end if;
 if jsonb_typeof(p_turns) is distinct from 'array' or jsonb_array_length(p_turns) not between 1 and 100 then
  raise exception 'invalid_conversation_turns' using errcode='22023'; end if;
 for t in select value from jsonb_array_elements(p_turns) loop
  tid := (t->>'id')::uuid; stamp := (t->>'created_at')::timestamptz;
  if tid is null or t->>'role' is null or t->>'role' not in ('assistant','user')
   or t->>'content' is null or char_length(t->>'content') not between 1 and 4000
   or btrim(t->>'content')='' then raise exception 'invalid_conversation_turn' using errcode='22023'; end if;
  select * into old from public.sentence_conversation_turns where id=tid;
  if found then
   if old.user_id<>auth.uid() or old.sentence_id<>p_sentence_id or old.role is distinct from t->>'role'
    or old.content is distinct from t->>'content' or (stamp is not null and old.created_at is distinct from stamp) then
    raise exception 'idempotency_conflict' using errcode='22023'; end if;
  else
   insert into public.sentence_conversation_turns(id,sentence_id,user_id,role,content,created_at)
   values(tid,p_sentence_id,auth.uid(),t->>'role',t->>'content',coalesce(stamp,now()));
  end if;
 end loop;
 return query select c.* from public.sentence_conversation_turns c
 where c.sentence_id=p_sentence_id and c.user_id=auth.uid()
 and c.id in (select (value->>'id')::uuid from jsonb_array_elements(p_turns)) order by c.turn_order;
end $$;
create or replace function public.sentence_conversation_save_pair(p_sentence_id uuid,p_turns jsonb)
returns setof public.sentence_conversation_turns
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if jsonb_typeof(p_turns) is distinct from 'array' or jsonb_array_length(p_turns)<>2
  or p_turns->0->>'role' is distinct from 'assistant' or p_turns->1->>'role' is distinct from 'user'
  or p_turns->0->>'id' is not distinct from p_turns->1->>'id' then
  raise exception 'invalid_conversation_pair' using errcode='22023'; end if;
 return query select * from public.sentence_conversation_import(p_sentence_id,p_turns);
end $$;
revoke all on function public.sentence_conversation_import(uuid,jsonb),public.sentence_conversation_save_pair(uuid,jsonb) from public,anon;
grant execute on function public.sentence_conversation_import(uuid,jsonb),public.sentence_conversation_save_pair(uuid,jsonb) to authenticated;
-- Direct old writes cannot bypass immutable batch identity. Owner deletion is retained.
revoke insert,update on public.sentence_conversation_turns from authenticated;
drop policy if exists conversation_owner on public.sentence_conversation_turns;
create policy conversation_owner on public.sentence_conversation_turns for all to authenticated
 using(user_id=auth.uid() and exists(select 1 from public.sentences s join public.user_books b on b.id=s.user_book_id
 where s.id=sentence_id and s.user_id=auth.uid() and b.user_id=auth.uid()))
 with check(false);
commit;
