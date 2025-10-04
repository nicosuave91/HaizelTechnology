-- M1 Data & Audit Fabric migration
set check_function_bodies = off;

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create schema if not exists app;

create or replace function app.current_tenant()
returns uuid
language sql
stable
as $$
  select current_setting('app.tenant', true)::uuid
$$;

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select current_setting('app.user', true)::uuid
$$;

create or replace function app.current_roles()
returns text[]
language sql
stable
as $$
  select coalesce(string_to_array(current_setting('app.roles', true), ','), array[]::text[])
$$;

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function app.ensure_common_columns(p_table regclass)
returns void
language plpgsql
as $$
declare
  cols record;
begin
  for cols in
    select column_name
    from information_schema.columns
    where table_name = split_part(p_table::text, '.', 2)
      and table_schema = split_part(p_table::text, '.', 1)
      and column_name in ('tenant_id','created_at','updated_at','created_by','updated_by','version')
  loop
    null;
  end loop;

  execute format('alter table %s
    add column if not exists tenant_id uuid not null,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists created_by uuid,
    add column if not exists updated_by uuid,
    add column if not exists version integer not null default 1', p_table);
end;
$$;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  theme jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1,
  constraint roles_tenant_code_key unique (tenant_id, code)
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  name text not null,
  password_hash text,
  status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1,
  constraint users_tenant_email_key unique (tenant_id, email)
);

create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  primary key (user_id, role_id)
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission text not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (role_id, permission)
);

create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  flag text not null,
  enabled boolean not null default false,
  rollout jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1,
  constraint feature_flags_tenant_flag_key unique (tenant_id, flag)
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  key_hash text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists access_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  resource text not null,
  action text not null,
  pii_fields text[] not null,
  reason text not null,
  occurred_at timestamptz not null default now()
);

-- Core domain tables
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_number text not null,
  status text not null,
  amount numeric(14,2),
  loan_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1,
  constraint loans_tenant_loan_number_key unique (tenant_id, loan_number)
);

create table if not exists borrowers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  ssn text,
  dob date,
  bureau_file_id text,
  bank_account_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists co_borrowers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  ssn text,
  dob date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists loan_parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid not null references loans(id) on delete cascade,
  user_id uuid references users(id),
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists loan_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid not null references loans(id) on delete cascade,
  status text not null,
  reason text,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  category text,
  uri text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists conditions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  description text,
  status text,
  due_at timestamptz,
  assignee uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  title text not null,
  description text,
  status text,
  assignee uuid,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  channel text,
  subject text,
  body text,
  actor uuid,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists clocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  clock_type text not null,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists disclosures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  disclosure_type text,
  delivered_at timestamptz,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  order_type text,
  vendor text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists pricing_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  quote jsonb,
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists rate_locks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  lock_number text,
  expires_at timestamptz,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  finding_type text,
  severity text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

-- Events and integrity
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete cascade,
  type text not null,
  source text,
  actor uuid,
  payload_jsonb jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  prev_hash text,
  hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists events_integrity (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  checked_from timestamptz not null,
  checked_to timestamptz not null,
  total integer not null,
  mismatches integer not null,
  notes jsonb
);

-- Hot path indexes
create index if not exists idx_loans_tenant_status on loans (tenant_id, status);
create index if not exists idx_loans_tenant_updated_at_desc on loans (tenant_id, updated_at desc);
create index if not exists idx_borrowers_tenant_loan on borrowers (tenant_id, loan_id);
create index if not exists idx_co_borrowers_tenant_loan on co_borrowers (tenant_id, loan_id);
create index if not exists idx_conditions_hot_path on conditions (tenant_id, status, due_at);
create index if not exists idx_tasks_hot_path on tasks (tenant_id, assignee, due_at);
create index if not exists idx_documents_tenant_status on documents (tenant_id, status);
create index if not exists idx_events_tenant_occurred on events (tenant_id, occurred_at desc);

-- Audit trigger
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

  new.prev_hash := v_prev;
  v_payload := coalesce(new.payload_jsonb::text, '');

  new.hash := encode(
    digest(coalesce(v_prev, '') || '|' || coalesce(new.type,'') || '|' || v_payload || '|' ||
           to_char(new.occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'sha256'),
    'hex');
  return new;
end;
$$;

drop trigger if exists trg_events_hash_chain on events;
create trigger trg_events_hash_chain
before insert on events
for each row
execute function app.event_hash_chain();

-- Event chain verification
create or replace function fn_verify_event_chain(p_from timestamptz, p_to timestamptz)
returns void
language plpgsql
as $$
declare
  rec record;
  expected text;
  mismatches integer := 0;
  total integer := 0;
  prev_hashes jsonb := '{}'::jsonb;
  loan_key text;
  notes jsonb := '[]'::jsonb;
begin
  for rec in
    select *
    from events
    where occurred_at between p_from and p_to
    order by tenant_id, loan_id, occurred_at, id
  loop
    total := total + 1;
    loan_key := coalesce(rec.tenant_id::text || ':' || coalesce(rec.loan_id::text, 'global'), rec.id::text);
    expected := coalesce(prev_hashes ->> loan_key, null);
    if expected is distinct from rec.prev_hash then
      mismatches := mismatches + 1;
      notes := notes || jsonb_build_array(jsonb_build_object('event_id', rec.id, 'issue', 'prev_hash_mismatch'));
    end if;
    prev_hashes := jsonb_set(prev_hashes, array[loan_key], to_jsonb(rec.hash));
    if rec.hash is distinct from encode(digest(coalesce(rec.prev_hash,'') || '|' || coalesce(rec.type,'') || '|' || coalesce(rec.payload_jsonb::text,'') || '|' || to_char(rec.occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'sha256'),'hex') then
      mismatches := mismatches + 1;
      notes := notes || jsonb_build_array(jsonb_build_object('event_id', rec.id, 'issue', 'hash_mismatch'));
    end if;
  end loop;

  insert into events_integrity(checked_from, checked_to, total, mismatches, notes)
  values (p_from, p_to, total, mismatches, case when jsonb_array_length(notes) = 0 then jsonb_build_object('details', 'ok') else jsonb_build_object('issues', notes) end);
end;
$$;

select cron.schedule('events_chain_nightly', '30 2 * * *', $$select fn_verify_event_chain(now() - interval '24 hours', now());$$)
where not exists (
  select 1 from cron.job where jobname = 'events_chain_nightly'
);

-- Masked views
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
       else case when b.phone is null then null else '(***) ***-' || right(regexp_replace(b.phone, '\D', '', 'g'), 4) end end as phone,
  b.bureau_file_id,
  b.bank_account_number,
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
       else case when cb.phone is null then null else '(***) ***-' || right(regexp_replace(cb.phone, '\D', '', 'g'), 4) end end as phone,
  cb.created_at,
  cb.updated_at
from co_borrowers cb
where cb.tenant_id = app.current_tenant();

-- Unmask functions
create or replace function sp_unmask_borrower(p_borrower_id uuid, p_reason text)
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

  insert into access_audit(tenant_id, user_id, resource, action, pii_fields, reason)
  values (app.current_tenant(), v_user, 'borrower', 'unmask', array['ssn','dob','email','phone','bureau_file_id','bank_account_number'], p_reason);

  return v_row;
end;
$$;

create or replace function sp_unmask_co_borrower(p_co_borrower_id uuid, p_reason text)
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

  insert into access_audit(tenant_id, user_id, resource, action, pii_fields, reason)
  values (app.current_tenant(), v_user, 'co_borrower', 'unmask', array['ssn','dob','email','phone'], p_reason);

  return v_row;
end;
$$;

-- RLS enablement
alter table tenants enable row level security;
alter table tenants force row level security;
alter table roles enable row level security;
alter table roles force row level security;
alter table users enable row level security;
alter table users force row level security;
alter table user_roles enable row level security;
alter table user_roles force row level security;
alter table role_permissions enable row level security;
alter table role_permissions force row level security;
alter table feature_flags enable row level security;
alter table feature_flags force row level security;
alter table api_keys enable row level security;
alter table api_keys force row level security;
alter table access_audit enable row level security;
alter table access_audit force row level security;
alter table loans enable row level security;
alter table loans force row level security;
alter table borrowers enable row level security;
alter table borrowers force row level security;
alter table co_borrowers enable row level security;
alter table co_borrowers force row level security;
alter table loan_parties enable row level security;
alter table loan_parties force row level security;
alter table loan_states enable row level security;
alter table loan_states force row level security;
alter table documents enable row level security;
alter table documents force row level security;
alter table conditions enable row level security;
alter table conditions force row level security;
alter table tasks enable row level security;
alter table tasks force row level security;
alter table communications enable row level security;
alter table communications force row level security;
alter table clocks enable row level security;
alter table clocks force row level security;
alter table disclosures enable row level security;
alter table disclosures force row level security;
alter table orders enable row level security;
alter table orders force row level security;
alter table pricing_quotes enable row level security;
alter table pricing_quotes force row level security;
alter table rate_locks enable row level security;
alter table rate_locks force row level security;
alter table findings enable row level security;
alter table findings force row level security;
alter table events enable row level security;
alter table events force row level security;

create or replace function app.tenant_isolation()
returns boolean
language plpgsql
stable
as $$
begin
  return app.current_tenant() is not null;
end;
$$;

-- Base tenant isolation policies
create policy tenants_self on tenants
  using (id = app.current_tenant());

create policy roles_tenant_isolation on roles
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy users_tenant_isolation on users
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy user_roles_tenant_isolation on user_roles
  using (exists (select 1 from users u where u.id = user_roles.user_id and u.tenant_id = app.current_tenant()))
  with check (exists (select 1 from users u where u.id = user_roles.user_id and u.tenant_id = app.current_tenant()));

create policy role_permissions_tenant_isolation on role_permissions
  using (exists (select 1 from roles r where r.id = role_permissions.role_id and r.tenant_id = app.current_tenant()))
  with check (exists (select 1 from roles r where r.id = role_permissions.role_id and r.tenant_id = app.current_tenant()));

create policy feature_flags_tenant_isolation on feature_flags
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy api_keys_tenant_isolation on api_keys
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy access_audit_tenant_isolation on access_audit
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy loans_tenant_isolation on loans
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy loans_writer on loans for insert
  to role_admin, role_processor, role_underwriter
  with check (tenant_id = app.current_tenant());

create policy loans_updater on loans for update
  to role_admin, role_processor, role_underwriter
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy borrowers_tenant_isolation on borrowers
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy borrowers_writer on borrowers for insert
  to role_admin, role_processor, role_underwriter
  with check (tenant_id = app.current_tenant());

create policy borrowers_updater on borrowers for update
  to role_admin, role_processor, role_underwriter
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy co_borrowers_tenant_isolation on co_borrowers
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy co_borrowers_writer on co_borrowers for insert
  to role_admin, role_processor, role_underwriter
  with check (tenant_id = app.current_tenant());

create policy co_borrowers_updater on co_borrowers for update
  to role_admin, role_processor, role_underwriter
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy loan_parties_tenant_isolation on loan_parties
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy loan_states_tenant_isolation on loan_states
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy documents_tenant_isolation on documents
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy conditions_tenant_isolation on conditions
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy tasks_tenant_isolation on tasks
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy communications_tenant_isolation on communications
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy clocks_tenant_isolation on clocks
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy disclosures_tenant_isolation on disclosures
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy orders_tenant_isolation on orders
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy pricing_quotes_tenant_isolation on pricing_quotes
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy rate_locks_tenant_isolation on rate_locks
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy findings_tenant_isolation on findings
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy events_tenant_isolation on events
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

-- Trigger to maintain updated_at
create or replace function app.updated_at_trigger()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := coalesce(old.version, 1) + 1;
  return new;
end;
$$;

create or replace function app.apply_updated_at_triggers()
returns void
language plpgsql
as $$
declare
  tbl text;
  tables text[] := array['loans','borrowers','co_borrowers','loan_parties','loan_states','documents','conditions','tasks','communications','clocks','disclosures','orders','pricing_quotes','rate_locks','findings','tenants','users','roles','feature_flags','api_keys','events'];
begin
  foreach tbl in array tables loop
    execute format('drop trigger if exists trg_%s_updated_at on %I', tbl, tbl);
    execute format('create trigger trg_%s_updated_at before update on %I for each row execute function app.updated_at_trigger()', tbl, tbl);
  end loop;
end;
$$;

select app.apply_updated_at_triggers();

-- Seed default roles
insert into roles (tenant_id, code, name, description)
select t.id, r.code, r.name, r.description
from tenants t
cross join (
  values
    ('role_admin','Administrator','Full access including PII'),
    ('role_compliance','Compliance','Compliance audit access'),
    ('role_processor','Processor','Operational edit access'),
    ('role_underwriter','Underwriter','Underwriting decisions'),
    ('role_viewer','Viewer','Read only masked data')
) as r(code, name, description)
on conflict do nothing;

-- Create database roles if missing
do $$ begin
  create role role_admin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role role_compliance;
exception when duplicate_object then null; end $$;
do $$ begin
  create role role_processor;
exception when duplicate_object then null; end $$;
do $$ begin
  create role role_underwriter;
exception when duplicate_object then null; end $$;
do $$ begin
  create role role_viewer;
exception when duplicate_object then null; end $$;

-- Grant limited select on masked views
grant select on borrowers_masked to public;
grant select on co_borrowers_masked to public;

-- Deny select on base tables by revoking
revoke all on borrowers from public;
revoke all on co_borrowers from public;

-- PITR helper comment
comment on database current_database() is 'PITR enabled via wal_level=replica and archive_mode=on per infra configuration';
