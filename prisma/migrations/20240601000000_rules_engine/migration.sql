-- Phase 3 rules engine foundational tables
set check_function_bodies = off;

create type rule_result as enum ('pass', 'warn', 'fail');
create type rule_overlay_scope as enum ('tenant', 'investor', 'state');

create table if not exists rule_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  jurisdiction text,
  citations text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists rule_versions (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references rule_catalog(id) on delete cascade,
  version_int integer not null,
  effective_from timestamptz,
  effective_to timestamptz,
  severity text not null,
  dsl_json jsonb not null,
  inputs_schema jsonb not null,
  outputs_schema jsonb not null,
  dependencies text[] not null default array[]::text[],
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint rule_versions_catalog_version_key unique (catalog_id, version_int)
);

create index if not exists rule_versions_effective_from_idx on rule_versions (effective_from);
create index if not exists rule_versions_effective_to_idx on rule_versions (effective_to);

create table if not exists overlays (
  id uuid primary key default gen_random_uuid(),
  scope rule_overlay_scope not null,
  scope_ref text not null,
  rule_version_id uuid not null references rule_versions(id) on delete cascade,
  overlay_dsl_json jsonb not null,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index if not exists overlays_rule_version_idx on overlays (rule_version_id);
create index if not exists overlays_scope_idx on overlays (scope, scope_ref);

create table if not exists rule_tests (
  id uuid primary key default gen_random_uuid(),
  rule_version_id uuid not null references rule_versions(id) on delete cascade,
  name text not null,
  input_fixture_json jsonb not null,
  expected_output_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index if not exists rule_tests_version_idx on rule_tests (rule_version_id);

create table if not exists rule_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete set null,
  rule_version_id uuid not null references rule_versions(id) on delete cascade,
  inputs_snapshot_json jsonb not null,
  inputs_snapshot_hash text not null,
  result rule_result not null,
  outputs_json jsonb not null,
  evaluated_at timestamptz not null default now(),
  latency_ms integer not null,
  created_at timestamptz not null default now()
);

create index if not exists rule_runs_tenant_evaluated_idx on rule_runs (tenant_id, evaluated_at);
create index if not exists rule_runs_version_idx on rule_runs (rule_version_id);

create table if not exists rule_findings (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references loans(id) on delete set null,
  rule_run_id uuid not null references rule_runs(id) on delete cascade,
  code text not null,
  severity text not null,
  message text not null,
  explain text not null,
  rule_version_id uuid not null references rule_versions(id) on delete cascade,
  citations text[] not null default array[]::text[],
  actions_json jsonb not null,
  resolved_bool boolean not null default false,
  resolved_at timestamptz,
  resolver_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rule_findings_run_idx on rule_findings (rule_run_id);
create index if not exists rule_findings_loan_idx on rule_findings (loan_id);

create table if not exists exceptions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  rule_code text not null,
  justification text not null,
  approver_user_id uuid,
  scope text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exceptions_loan_idx on exceptions (loan_id);

create trigger trg_rule_catalog_updated
  before update on rule_catalog
  for each row execute function app.touch_updated_at();

create trigger trg_rule_versions_updated
  before update on rule_versions
  for each row execute function app.touch_updated_at();

create trigger trg_overlays_updated
  before update on overlays
  for each row execute function app.touch_updated_at();

create trigger trg_rule_tests_updated
  before update on rule_tests
  for each row execute function app.touch_updated_at();

create trigger trg_rule_runs_updated
  before update on rule_runs
  for each row execute function app.touch_updated_at();

create trigger trg_rule_findings_updated
  before update on rule_findings
  for each row execute function app.touch_updated_at();

create trigger trg_exceptions_updated
  before update on exceptions
  for each row execute function app.touch_updated_at();

alter table rule_catalog enable row level security;
alter table rule_catalog force row level security;

alter table rule_versions enable row level security;
alter table rule_versions force row level security;

alter table overlays enable row level security;
alter table overlays force row level security;

alter table rule_tests enable row level security;
alter table rule_tests force row level security;

alter table rule_runs enable row level security;
alter table rule_runs force row level security;

alter table rule_findings enable row level security;
alter table rule_findings force row level security;

alter table exceptions enable row level security;
alter table exceptions force row level security;

create policy rule_catalog_read_all on rule_catalog for select using (true);
create policy rule_catalog_write_admin on rule_catalog for all using (true) with check (true);

create policy rule_versions_read_all on rule_versions for select using (true);
create policy rule_versions_write_admin on rule_versions for all using (true) with check (true);

create policy overlays_read_all on overlays for select using (true);
create policy overlays_write_admin on overlays for all using (true) with check (true);

create policy rule_tests_read_all on rule_tests for select using (true);
create policy rule_tests_write_admin on rule_tests for all using (true) with check (true);

create policy rule_runs_tenant_isolation on rule_runs
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy rule_findings_tenant_isolation on rule_findings
  using (exists (
    select 1 from rule_runs rr
    where rr.id = rule_findings.rule_run_id
      and rr.tenant_id = app.current_tenant()
  ))
  with check (exists (
    select 1 from rule_runs rr
    where rr.id = rule_findings.rule_run_id
      and rr.tenant_id = app.current_tenant()
  ));

create policy exceptions_tenant_isolation on exceptions
  using (exists (
    select 1 from loans l
    where l.id = exceptions.loan_id
      and l.tenant_id = app.current_tenant()
  ))
  with check (exists (
    select 1 from loans l
    where l.id = exceptions.loan_id
      and l.tenant_id = app.current_tenant()
  ));

insert into rule_catalog (code, title, description, jurisdiction, citations)
values
  ('ATR_QM_ABILITY_TO_REPAY', 'Ability to Repay - Debt Ratio', 'Ensures debt-to-income ratio conforms with ATR/QM standard.', 'federal', array['12 CFR §1026.43']),
  ('HUD_ML_2023_12', 'FHA Manual Underwriting DTI', 'Validates FHA manual underwriting DTI thresholds.', 'federal/FHA', array['HUD ML 2023-12'])
on conflict (code) do nothing;
