-- Align schema with governance metadata and DR scaffolding

alter table tenants
  add column if not exists governance_tier text not null default 'standard',
  add column if not exists data_retention_days integer not null default 365;

alter table feature_flags
  add column if not exists category text not null default 'application',
  add column if not exists last_evaluated_at timestamptz;

alter table loans
  add column if not exists governance_scope text not null default 'loan',
  add column if not exists dr_protected boolean not null default false;

alter table borrowers
  add column if not exists data_classification text not null default 'restricted',
  add column if not exists mask_profile text not null default 'standard';

alter table co_borrowers
  add column if not exists data_classification text not null default 'restricted',
  add column if not exists mask_profile text not null default 'standard';

alter table documents
  add column if not exists data_classification text not null default 'internal';

alter table events
  add column if not exists governance_tags text[] not null default array[]::text[],
  add column if not exists hash_version integer not null default 1;

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

alter table access_audit
  add column if not exists scope text not null default 'borrower',
  add column if not exists session_id uuid,
  add column if not exists dr_drill_id uuid;

alter table access_audit
  add constraint if not exists access_audit_tenant_fk foreign key (tenant_id) references tenants(id) on delete cascade;

alter table access_audit
  add constraint if not exists access_audit_user_fk foreign key (user_id) references users(id) on delete cascade;

alter table access_audit
  add constraint if not exists access_audit_dr_drill_fk foreign key (dr_drill_id) references dr_drills(id) on delete set null;

create index if not exists idx_access_audit_tenant_occurred on access_audit(tenant_id, occurred_at desc);

create index if not exists idx_dr_drills_tenant on dr_drills(tenant_id, started_at desc);
