-- PITR scaffolding and DR automation helpers

create or replace function sp_begin_dr_drill(p_reason text, p_target timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_notes jsonb := jsonb_build_object('reason', p_reason, 'requested_at', now());
begin
  insert into dr_drills(tenant_id, triggered_by, status, pitr_target, notes)
  values (app.current_tenant(), app.current_user_id(), 'initiated', p_target, v_notes)
  returning id into v_id;

  insert into feature_flags (tenant_id, flag, category, enabled, rollout)
  values (app.current_tenant(), 'dr.active_database', 'platform', true, jsonb_build_object('dr_drill_id', v_id))
  on conflict (tenant_id, flag) do update set enabled = excluded.enabled, updated_at = now(), rollout = excluded.rollout;

  return v_id;
end;
$$;

create or replace function sp_complete_dr_drill(p_dr_drill_id uuid, p_success boolean, p_summary text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update dr_drills
  set status = case when p_success then 'completed' else 'failed' end,
      completed_at = now(),
      notes = coalesce(notes, '{}'::jsonb) || jsonb_build_object('summary', p_summary, 'completed_at', now())
  where id = p_dr_drill_id
    and tenant_id = app.current_tenant();

  update feature_flags
  set enabled = false,
      updated_at = now(),
      rollout = coalesce(rollout, '{}'::jsonb) || jsonb_build_object('dr_drill_id', p_dr_drill_id, 'completed', p_success)
  where tenant_id = app.current_tenant()
    and flag = 'dr.active_database';
end;
$$;

create or replace function sp_record_dr_access(p_dr_drill_id uuid, p_resource text, p_action text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into access_audit(tenant_id, user_id, resource, action, scope, pii_fields, reason, dr_drill_id)
  values (app.current_tenant(), app.current_user_id(), p_resource, p_action, 'dr_drill', array[]::text[], p_reason, p_dr_drill_id);
end;
$$;
