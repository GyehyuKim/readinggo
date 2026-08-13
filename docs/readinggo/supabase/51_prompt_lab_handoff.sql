-- ReadingGo — audited DEV artifact to PROD active handoff (#1372).
-- Applying this file never promotes a prompt. Both RPCs are service_role-only.

create or replace function public.prompt_lab_create_handoff(
  p_actor_id uuid, p_active_version_id uuid, p_approval_reason text default ''
)
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_active public.prompt_lab_prompt_versions%rowtype;
  v_source_id uuid;
  v_approved_at timestamptz := clock_timestamp();
  v_evidence jsonb;
  v_artifact jsonb;
begin
  if not exists (
    select 1 from public.users u join public.prompt_lab_grants g on g.user_id = u.id
     and g.role = 'promoter' and g.status = 'active'
    where u.id = p_actor_id and u.is_admin = true
  ) then raise exception using errcode = 'P0001', message = 'prompt_lab_forbidden'; end if;

  select * into v_active from public.prompt_lab_prompt_versions
   where id = p_active_version_id and status = 'active' for share;
  if not found then raise exception using errcode = 'P0001', message = 'prompt_lab_active_missing'; end if;
  v_source_id := coalesce(v_active.based_on_version, v_active.id);

  select jsonb_agg(jsonb_build_object(
    'runId', r.id, 'fixtureId', r.fixture_id, 'fixtureSlug', f.slug,
    'expectedDirection', f.expected_direction, 'forbiddenResponse', f.forbidden_response,
    'activeOutput', r.active_output, 'candidateOutput', r.candidate_output,
    'evaluationId', e.id, 'contextScore', e.context_score, 'contextComment', e.context_comment,
    'depthScore', e.depth_score, 'depthComment', e.depth_comment,
    'personalizationOffScore', e.personalization_off_score,
    'personalizationOffComment', e.personalization_off_comment,
    'safetyScore', e.safety_score, 'safetyComment', e.safety_comment,
    'toneScore', e.tone_score, 'toneComment', e.tone_comment,
    'evaluatorId', e.evaluator_id, 'evaluatedAt', e.created_at
  ) order by r.created_at, e.created_at) into v_evidence
  from public.prompt_lab_runs r
  join public.prompt_lab_fixtures f on f.id = r.fixture_id and f.fixture_type = 'baseline'
  join public.prompt_lab_evaluations e on e.run_id = r.id
  where r.candidate_version_id = v_source_id;

  if (select count(distinct r.fixture_id) from public.prompt_lab_runs r
      join public.prompt_lab_fixtures f on f.id = r.fixture_id
        and f.fixture_type = 'baseline' and f.deleted_at is null
      join public.prompt_lab_evaluations e on e.run_id = r.id
      where r.candidate_version_id = v_source_id) <
    (select count(*) from public.prompt_lab_fixtures where fixture_type = 'baseline' and deleted_at is null)
  then raise exception using errcode = 'P0001', message = 'prompt_lab_handoff_evidence_incomplete'; end if;

  v_artifact := jsonb_build_object(
    'schemaVersion', 1, 'sourceEnvironment', 'development',
    'versionId', v_active.id, 'sourceVersionId', v_source_id,
    'versionNo', v_active.version_no, 'promptBody', v_active.prompt_body,
    'evaluationEvidence', v_evidence, 'devApprovedBy', p_actor_id,
    'devApprovedAt', v_approved_at,
    'approvalReason', left(trim(coalesce(p_approval_reason, '')), 500)
  );
  insert into public.prompt_lab_audit_log(action, actor_id, prompt_version_id, metadata)
  values ('handoff_approved', p_actor_id, v_active.id, v_artifact);
  return v_artifact;
end $fn$;

create or replace function public.prompt_lab_activate_handoff(
  p_actor_id uuid, p_artifact jsonb, p_reason text default ''
)
returns jsonb language plpgsql security definer set search_path = public
as $fn$
declare
  v_active public.prompt_lab_prompt_versions%rowtype;
  v_new public.prompt_lab_prompt_versions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('readinggo:prompt-lab:active-version'));
  if not exists (
    select 1 from public.users u join public.prompt_lab_grants g on g.user_id = u.id
     and g.role = 'promoter' and g.status = 'active'
    where u.id = p_actor_id and u.is_admin = true
  ) then raise exception using errcode = 'P0001', message = 'prompt_lab_forbidden'; end if;
  if p_artifact is null or jsonb_typeof(p_artifact) <> 'object'
    or p_artifact->>'schemaVersion' <> '1'
    or p_artifact->>'sourceEnvironment' <> 'development'
    or nullif(p_artifact->>'versionId', '') is null
    or nullif(p_artifact->>'versionNo', '') is null
    or nullif(p_artifact->>'promptBody', '') is null
    or nullif(p_artifact->>'devApprovedBy', '') is null
    or nullif(p_artifact->>'devApprovedAt', '') is null
    or jsonb_typeof(p_artifact->'evaluationEvidence') <> 'array'
    or jsonb_array_length(p_artifact->'evaluationEvidence') = 0
  then raise exception using errcode = 'P0001', message = 'prompt_lab_handoff_invalid'; end if;
  if exists (
    select 1 from public.prompt_lab_audit_log
    where action = 'prod_handoff_activate'
      and metadata->'artifact'->>'versionId' = p_artifact->>'versionId'
  ) then raise exception using errcode = 'P0001', message = 'prompt_lab_handoff_already_active'; end if;

  select * into v_active from public.prompt_lab_prompt_versions where status = 'active' for update;
  if not found then raise exception using errcode = 'P0001', message = 'prompt_lab_active_missing'; end if;
  update public.prompt_lab_prompt_versions set status = 'archived' where id = v_active.id;
  insert into public.prompt_lab_prompt_versions(status, prompt_body, change_reason, created_by)
  values ('active', p_artifact->>'promptBody', left(trim(coalesce(p_reason, '')), 500), p_actor_id)
  returning * into v_new;
  insert into public.prompt_lab_audit_log(action, actor_id, prompt_version_id, metadata)
  values ('prod_handoff_activate', p_actor_id, v_new.id, jsonb_build_object(
    'artifact', p_artifact, 'previousActiveId', v_active.id,
    'prodPromoter', p_actor_id, 'prodActivatedAt', clock_timestamp(),
    'reason', left(trim(coalesce(p_reason, '')), 500)
  ));
  return to_jsonb(v_new);
end $fn$;

revoke all on function public.prompt_lab_create_handoff(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.prompt_lab_create_handoff(uuid, uuid, text) to service_role;
revoke all on function public.prompt_lab_activate_handoff(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.prompt_lab_activate_handoff(uuid, jsonb, text) to service_role;
