-- #1627: owner-scoped edition TOC with atomic validated replacement.
create table if not exists public.user_book_chapters (
  id uuid primary key default gen_random_uuid(),
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  start_page integer not null check (start_page >= 1),
  depth integer not null check (depth >= 0),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_book_id, position),
  unique (user_book_id, start_page)
);
create index if not exists idx_user_book_chapters_order
  on public.user_book_chapters(user_book_id, position);

alter table public.user_book_chapters enable row level security;
revoke all on public.user_book_chapters from public, anon, authenticated;
-- Owner reads use the base table. All writes go through the atomic validated
-- replace RPC so a direct row write cannot bypass cross-row invariants.
grant select on public.user_book_chapters to authenticated;
drop policy if exists user_book_chapters_owner_select on public.user_book_chapters;
create policy user_book_chapters_owner_select on public.user_book_chapters for select to authenticated
  using (exists (select 1 from public.user_books ub
    where ub.id=user_book_id and ub.user_id=auth.uid()));
drop policy if exists user_book_chapters_owner_insert on public.user_book_chapters;
drop policy if exists user_book_chapters_owner_update on public.user_book_chapters;
drop policy if exists user_book_chapters_owner_delete on public.user_book_chapters;

create or replace function public.user_book_chapters_replace(p_user_book_id uuid, p_rows jsonb)
returns setof public.user_book_chapters
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_total integer;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  perform 1 from public.user_books ub
    where ub.id=p_user_book_id and ub.user_id=auth.uid() for update;
  if not found then raise exception 'book_not_found' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>500 then
    raise exception 'invalid_chapter_rows' using errcode='22023';
  end if;

  select coalesce(nullif(ub.total_pages_override,0),nullif(b.total_pages,0))
    into v_total from public.user_books ub join public.books b on b.id=ub.book_id
    where ub.id=p_user_book_id;
  create temporary table if not exists pg_temp.chapter_replace_rows(
    title text,start_page integer,depth integer,position integer
  ) on commit drop;
  truncate pg_temp.chapter_replace_rows;
  insert into pg_temp.chapter_replace_rows(title,start_page,depth,position)
    select btrim(x.title),x.start_page,x.depth,x.position
    from jsonb_to_recordset(p_rows) as x(title text,start_page integer,depth integer,position integer);
  get diagnostics v_count=row_count;
  if v_count<>jsonb_array_length(p_rows) then
    raise exception 'invalid_chapter_rows' using errcode='22023';
  end if;
  if exists(
    select 1 from (
      select r.*,lag(start_page) over(order by position) previous_start,
        lag(depth) over(order by position) previous_depth,
        row_number() over(order by position)-1 expected_position
      from pg_temp.chapter_replace_rows r
    ) checked
    where title is null or title='' or start_page is null or start_page<1
      or depth is null or depth<0 or position is null or position<>expected_position
      or (position=0 and depth<>0)
      or (position>0 and (start_page<=previous_start or depth>previous_depth+1))
      or (v_total is not null and start_page>v_total)
  ) then raise exception 'invalid_chapter_rows' using errcode='22023'; end if;

  delete from public.user_book_chapters where user_book_id=p_user_book_id;
  insert into public.user_book_chapters(user_book_id,title,start_page,depth,position)
    select p_user_book_id,title,start_page,depth,position
    from pg_temp.chapter_replace_rows order by position;
  return query select c.* from public.user_book_chapters c
    where c.user_book_id=p_user_book_id order by c.position;
end $$;

create or replace function public.user_book_chapters_public(p_user_book_id uuid)
returns table(title text,start_page integer,depth integer,"position" integer)
language sql stable security definer set search_path=public,pg_temp as $$
  select c.title,c.start_page,c.depth,c.position
  from public.user_book_chapters c
  where c.user_book_id=p_user_book_id
    and public.book_public_allowed(p_user_book_id)
  order by c.position;
$$;

revoke all on function public.user_book_chapters_replace(uuid,jsonb),
  public.user_book_chapters_public(uuid) from public,anon,authenticated;
grant execute on function public.user_book_chapters_replace(uuid,jsonb) to authenticated;
grant execute on function public.user_book_chapters_public(uuid) to anon,authenticated;
