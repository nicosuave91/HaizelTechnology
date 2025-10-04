-- Bootstrap tenancy primitives and helper functions
set check_function_bodies = off;

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create schema if not exists app;

drop function if exists app.current_tenant() cascade;
create or replace function app.current_tenant()
returns uuid
language sql
stable
as $$
  select current_setting('app.tenant', true)::uuid
$$;

drop function if exists app.current_user_id() cascade;
create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select current_setting('app.user', true)::uuid
$$;

drop function if exists app.current_roles() cascade;
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
  new.version := coalesce(old.version, 0) + 1;
  return new;
end;
$$;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  theme jsonb,
  governance_tier text not null default 'standard',
  data_retention_days integer not null default 365,
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
  category text not null default 'application',
  enabled boolean not null default false,
  rollout jsonb,
  last_evaluated_at timestamptz,
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

create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_number text not null,
  status text not null,
  amount numeric(14,2),
  loan_type text,
  governance_scope text not null default 'loan',
  dr_protected boolean not null default false,
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
  data_classification text not null default 'restricted',
  mask_profile text not null default 'standard',
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
  data_classification text not null default 'restricted',
  mask_profile text not null default 'standard',
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
  data_classification text not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

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
  governance_tags text[] not null default array[]::text[],
  hash_version integer not null default 1,
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

create table if not exists dr_drills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'initiated',
  triggered_by uuid references users(id),
  pitr_target timestamptz,
  notes jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create table if not exists access_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  resource text not null,
  action text not null,
  scope text not null default 'borrower',
  pii_fields text[] not null,
  reason text not null,
  session_id uuid,
  dr_drill_id uuid references dr_drills(id) on delete set null,
  occurred_at timestamptz not null default now()
);

comment on table dr_drills is 'Tracks PITR dry-runs and regional failover exercises.';
