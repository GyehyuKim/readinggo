-- Run after schema.sql (or migrations through 71) on a disposable PostgreSQL/Supabase database.
begin;
do $$
declare
  owner_id uuid := '16270000-0000-4000-8000-000000000001';
  other_id uuid := '26270000-0000-4000-8000-000000000002';
  catalog_id uuid;
  owner_book uuid;
  before_rows jsonb;
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (owner_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','chapter-owner@example.invalid','','{}','{}',now(),now()),
    (other_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','chapter-other@example.invalid','','{}','{}',now(),now());
  insert into public.users(id,handle,display_name) values
    (owner_id,'chapter_owner','Chapter Owner'),(other_id,'chapter_other','Chapter Other')
    on conflict(id) do update set handle=excluded.handle;
  insert into public.books(title,author,total_pages) values('Chapter fixture','Synthetic',304) returning id into catalog_id;
  insert into public.user_books(user_id,book_id,status) values(owner_id,catalog_id,'reading') returning id into owner_book;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  set local role authenticated;
  perform * from public.user_book_chapters_replace(owner_book,
    '[{"title":"Part","start_page":1,"depth":0,"position":0},
      {"title":"Child","start_page":20,"depth":1,"position":1},
      {"title":"Next","start_page":40,"depth":0,"position":2}]');
  if (select count(*) from public.user_book_chapters where user_book_id=owner_book)<>3 then
    raise exception 'owner_replace_failed';
  end if;
  begin
    insert into public.user_book_chapters(user_book_id,title,start_page,depth,position)
      values(owner_book,'Bypass',80,0,3);
    raise exception 'owner_direct_write_accepted';
  exception when insufficient_privilege then null; end;
  select jsonb_agg(to_jsonb(c) - 'created_at' - 'updated_at' order by position) into before_rows
    from public.user_book_chapters c where user_book_id=owner_book;
  begin
    perform * from public.user_book_chapters_replace(owner_book,
      '[{"title":"Bad","start_page":20,"depth":1,"position":0},
        {"title":"Duplicate","start_page":20,"depth":2,"position":1}]');
    raise exception 'invalid_rows_accepted';
  exception when invalid_parameter_value then null; end;
  if before_rows is distinct from (select jsonb_agg(to_jsonb(c) - 'created_at' - 'updated_at' order by position)
      from public.user_book_chapters c where user_book_id=owner_book) then
    raise exception 'invalid_replace_changed_rows';
  end if;

  perform set_config('request.jwt.claim.sub',other_id::text,true);
  if exists(select 1 from public.user_book_chapters where user_book_id=owner_book) then
    raise exception 'nonowner_base_read';
  end if;
  begin
    perform * from public.user_book_chapters_replace(owner_book,'[]');
    raise exception 'nonowner_replace_accepted';
  exception when insufficient_privilege then null; end;
  reset role;

  perform set_config('request.jwt.claim.sub','',true);
  set local role anon;
  if exists(select 1 from public.user_book_chapters_public(owner_book)) then
    raise exception 'private_chapters_leaked';
  end if;
  begin
    perform 1 from public.user_book_chapters;
    raise exception 'anon_base_read';
  exception when insufficient_privilege then null; end;
  reset role;

  update public.user_books set visibility='public' where id=owner_book;
  set local role anon;
  if (select count(*) from public.user_book_chapters_public(owner_book))<>3 then
    raise exception 'public_projection_missing';
  end if;
  reset role;

  insert into public.moderation_suspended_users(user_id,suspended_by,reason)
    values(owner_id,other_id,'chapter fixture');
  set local role anon;
  if exists(select 1 from public.user_book_chapters_public(owner_book)) then
    raise exception 'suspended_owner_chapters_leaked';
  end if;
  reset role;
  delete from public.moderation_suspended_users where user_id=owner_id;

  insert into public.user_blocks(blocker_id,blocked_id) values(other_id,owner_id);
  perform set_config('request.jwt.claim.sub',other_id::text,true);
  set local role anon;
  if exists(select 1 from public.user_book_chapters_public(owner_book)) then
    raise exception 'blocked_owner_chapters_leaked';
  end if;
  reset role;
  delete from public.user_blocks where blocker_id=other_id and blocked_id=owner_id;

  delete from public.user_books where id=owner_book;
  if exists(select 1 from public.user_book_chapters where user_book_id=owner_book) then
    raise exception 'chapter_cascade_failed';
  end if;
end $$;
rollback;
