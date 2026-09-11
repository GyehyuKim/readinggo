-- #1619: room membership is not permission to read private books or personal activity.
begin;
create or replace function public.room_members_public(p_room_id uuid)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('joined_at',m.joined_at,'user',jsonb_build_object(
  'id',u.id,'handle',u.handle,'display_name',u.display_name,
  'cumulativePage',ub.current_page,'todaySentence',q.sentence,
  'streak',null,'todayRecorded',null,'activityAvailable',false))
 from public.villages v join public.village_members m on m.village_id=v.id
 join public.users u on u.id=m.user_id
 left join lateral (select b.id,b.current_page from public.user_books b
  where b.user_id=u.id and b.book_id=v.book_id and public.book_public_allowed(b.id)
  order by b.id limit 1) ub on true
 left join lateral (select jsonb_build_object('text',s.text,'page',s.page) sentence
  from public.sentences s where s.user_book_id=ub.id and public.sentence_public_allowed(s.id)
  order by s.created_at desc,s.id desc limit 1) q on true
 where v.id=p_room_id and auth.uid() is not null
 and (v.visibility='public' or v.created_by=auth.uid() or exists(
  select 1 from public.village_members mine where mine.village_id=v.id and mine.user_id=auth.uid()))
 and not public.moderation_user_suspended(u.id)
 and not exists(select 1 from public.user_blocks bl where
  (bl.blocker_id=auth.uid() and bl.blocked_id=u.id) or (bl.blocker_id=u.id and bl.blocked_id=auth.uid()))
 order by m.joined_at,u.id;
$$;
revoke all on function public.room_members_public(uuid) from public,anon;
grant execute on function public.room_members_public(uuid) to authenticated;
commit;
