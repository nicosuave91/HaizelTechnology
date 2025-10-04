-- Security barrier masking views and unmasking routines with audit capture

create or replace view borrowers_masked
with (security_barrier = true)
as
select
  b.id,
  b.tenant_id,
  b.loan_id,
  b.first_name,
  b.last_name,
  case when 'role_admin' = any(app.current_roles()) or 'role_compliance' = any(app.current_roles())
       then b.ssn
       else case when b.ssn is null then null else '***-**-' || right(b.ssn, 4) end end as ssn,
  case when 'role_admin' = any(app.current_roles()) or 'role_compliance' = any(app.current_roles())
       then b.dob
       else date_trunc('month', b.dob)::date end as dob,
  case when 'role_admin' = any(app.current_roles()) or 'role_compliance' = any(app.current_roles())
       then b.email
       else regexp_replace(b.email, '^[^@]+', '***') end as email,
  case when 'role_admin' = any(app.current_roles()) or 'role_compliance' = any(app.current_roles())
       then b.phone
       else case when b.phone is null then null else '(***) ***-' || right(regexp_replace(b.phone, '\\D', '', 'g'), 4) end end as phone,
  b.bureau_file_id,
  b.bank_account_number,
  b.data_classification,
  b.mask_profile,
  b.created_at,
  b.updated_at
from borrowers b
where b.tenant_id = app.current_tenant();

create or replace view co_borrowers_masked
with (security_barrier = true)
as
select
  cb.id,
  cb.tenant_id,
  cb.loan_id,
  cb.first_name,
  cb.last_name,
  case when 'role_admin' = any(app.current_roles()) or 'role_compliance' = any(app.current_roles())
       then cb.ssn
       else case when cb.ssn is null then null else '***-**-' || right(cb.ssn, 4) end end as ssn,
  case when 'role_admin' = any(app.current_roles()) or 'role_compliance' = any(app.current_roles())
       then cb.dob
       else date_trunc('month', cb.dob)::date end as dob,
  case when 'role_admin' = any(app.current_roles()) or 'role_compliance' = any(app.current_roles())
       then cb.email
       else regexp_replace(cb.email, '^[^@]+', '***') end as email,
  case when 'role_admin' = any(app.current_roles()) or 'role_compliance' = any(app.current_roles())
       then cb.phone
       else case when cb.phone is null then null else '(***) ***-' || right(regexp_replace(cb.phone, '\\D', '', 'g'), 4) end end as phone,
  cb.data_classification,
  cb.mask_profile,
  cb.created_at,
  cb.updated_at
from co_borrowers cb
where cb.tenant_id = app.current_tenant();

grant select on borrowers_masked to public;
grant select on co_borrowers_masked to public;

revoke all on borrowers from public;
revoke all on co_borrowers from public;

create or replace function sp_unmask_borrower(p_borrower_id uuid, p_reason text, p_session uuid default null)
returns borrowers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := app.current_user_id();
  v_roles text[] := app.current_roles();
  v_row borrowers%rowtype;
  allowed boolean := false;
begin
  if v_roles && array['role_admin','role_compliance','role_underwriter'] then
    allowed := true;
  end if;
  if not allowed then
    raise exception 'insufficient privileges to unmask borrower';
  end if;

  select * into v_row
  from borrowers
  where id = p_borrower_id
    and tenant_id = app.current_tenant();

  if not found then
    raise exception 'borrower not found';
  end if;

  insert into access_audit(tenant_id, user_id, resource, action, scope, pii_fields, reason, session_id)
  values (app.current_tenant(), v_user, 'borrower', 'unmask', v_row.mask_profile, array['ssn','dob','email','phone','bureau_file_id','bank_account_number'], p_reason, p_session);

  return v_row;
end;
$$;

create or replace function sp_unmask_co_borrower(p_co_borrower_id uuid, p_reason text, p_session uuid default null)
returns co_borrowers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := app.current_user_id();
  v_roles text[] := app.current_roles();
  v_row co_borrowers%rowtype;
  allowed boolean := false;
begin
  if v_roles && array['role_admin','role_compliance','role_underwriter'] then
    allowed := true;
  end if;
  if not allowed then
    raise exception 'insufficient privileges to unmask co-borrower';
  end if;

  select * into v_row
  from co_borrowers
  where id = p_co_borrower_id
    and tenant_id = app.current_tenant();

  if not found then
    raise exception 'co-borrower not found';
  end if;

  insert into access_audit(tenant_id, user_id, resource, action, scope, pii_fields, reason, session_id)
  values (app.current_tenant(), v_user, 'co_borrower', 'unmask', v_row.mask_profile, array['ssn','dob','email','phone'], p_reason, p_session);

  return v_row;
end;
$$;
