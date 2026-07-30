-- =====================================================================
-- ReadingGo — 48_prompt_lab_promotion_atomic.sql  (#1374)
-- Prompt Lab promote/rollback과 audit 기록을 단일 DB transaction으로 묶는다.
-- 재실행 안전(create or replace / revoke / grant).
-- =====================================================================

create or replace function public.prompt_lab_promote_atomic(
  p_actor_id uuid,
  p_source_version_id uuid,
  p_action text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_source public.prompt_lab_prompt_versions%rowtype;
  v_active public.prompt_lab_prompt_versions%rowtype;
  v_new public.prompt_lab_prompt_versions%rowtype;
  v_reason text := left(trim(coalesce(p_reason, '')), 500);
begin
  if p_action not in ('promote', 'rollback') then
    raise exception using errcode = 'P0001', message = 'prompt_lab_invalid_action';
  end if;

  -- 모든 승격/rollback 요청을 한 줄로 세워 active 교체와 audit 순서를 직렬화한다.
  perform pg_advisory_xact_lock(hashtext('readinggo:prompt-lab:active-version'));

  -- Worker 검사만 믿지 않는다. 요청 시점의 admin + active promoter를 DB에서도 재검증한다.
  if not exists (
    select 1
      from public.users u
      join public.prompt_lab_grants g
        on g.user_id = u.id
       and g.role = 'promoter'
       and g.status = 'active'
     where u.id = p_actor_id
       and u.is_admin = true
  ) then
    raise exception using errcode = 'P0001', message = 'prompt_lab_forbidden';
  end if;

  select * into v_source
    from public.prompt_lab_prompt_versions
   where id = p_source_version_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'prompt_lab_version_not_found';
  end if;
  if p_action = 'promote' and v_source.status <> 'candidate' then
    raise exception using errcode = 'P0001', message = 'prompt_lab_candidate_required';
  end if;
  if p_action = 'rollback' and v_source.status <> 'archived' then
    raise exception using errcode = 'P0001', message = 'prompt_lab_archived_required';
  end if;

  select * into v_active
    from public.prompt_lab_prompt_versions
   where status = 'active'
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'prompt_lab_active_missing';
  end if;
  if v_active.based_on_version = v_source.id then
    raise exception using errcode = 'P0001', message = 'prompt_lab_already_active';
  end if;

  update public.prompt_lab_prompt_versions
     set status = 'archived'
   where id = v_active.id;

  insert into public.prompt_lab_prompt_versions
    (status, prompt_body, change_reason, created_by, based_on_version)
  values
    (
      'active',
      v_source.prompt_body,
      coalesce(nullif(v_reason, ''), case when p_action = 'promote' then 'candidate 승격' else 'active rollback' end),
      p_actor_id,
      v_source.id
    )
  returning * into v_new;

  insert into public.prompt_lab_audit_log
    (action, actor_id, prompt_version_id, metadata)
  values
    (
      p_action,
      p_actor_id,
      v_new.id,
      jsonb_build_object(
        'sourceVersionId', v_source.id,
        'previousActiveId', v_active.id,
        'reason', v_reason
      )
    );

  return to_jsonb(v_new);
end
$fn$;

revoke all on function public.prompt_lab_promote_atomic(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.prompt_lab_promote_atomic(uuid, uuid, text, text) to service_role;
