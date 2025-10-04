-- Hash chain triggers and verification stored procedures

create or replace function app.event_hash_chain()
returns trigger
language plpgsql
as $$
declare
  v_prev text;
  v_payload text;
begin
  if new.prev_hash is not null then
    v_prev := new.prev_hash;
  else
    select hash into v_prev
    from events
    where tenant_id = new.tenant_id
      and loan_id is not distinct from new.loan_id
    order by occurred_at desc
    limit 1;
  end if;

  v_payload := encode(digest(coalesce(new.payload_jsonb::text, '{}') || coalesce(new.governance_tags::text, ''), 'sha256'), 'hex');
  new.prev_hash := coalesce(v_prev, 'GENESIS');
  new.hash := encode(digest(new.prev_hash || '|' || new.type || '|' || coalesce(new.source, '') || '|' || coalesce(new.actor::text, '') || '|' || new.occurred_at || '|' || v_payload || '|' || new.hash_version, 'sha256'), 'hex');
  return new;
end;
$$;

create or replace function fn_verify_event_chain(p_from timestamptz, p_to timestamptz)
returns void
language plpgsql
as $$
declare
  v_prev text;
  v_expected text;
  v_row record;
  v_mismatches integer := 0;
  v_checked integer := 0;
begin
  for v_row in
    select *
    from events
    where occurred_at between p_from and p_to
    order by tenant_id, loan_id, occurred_at
  loop
    v_checked := v_checked + 1;
    if v_prev is null or v_row.prev_hash = 'GENESIS' or v_row.prev_hash is null then
      v_prev := v_row.hash;
      continue;
    end if;

    v_expected := encode(digest(v_prev || '|' || v_row.type || '|' || coalesce(v_row.source, '') || '|' || coalesce(v_row.actor::text, '') || '|' || v_row.occurred_at || '|' || encode(digest(coalesce(v_row.payload_jsonb::text, '{}') || coalesce(v_row.governance_tags::text, ''), 'sha256'), 'hex') || '|' || v_row.hash_version, 'sha256'), 'hex');
    if v_expected <> v_row.hash then
      v_mismatches := v_mismatches + 1;
    end if;
    v_prev := v_row.hash;
  end loop;

  insert into events_integrity(run_at, checked_from, checked_to, total, mismatches, notes)
  values (now(), p_from, p_to, v_checked, v_mismatches, jsonb_build_object('context', 'fn_verify_event_chain'));
end;
$$;

create trigger trg_events_hash_chain
before insert on events
for each row
execute function app.event_hash_chain();
