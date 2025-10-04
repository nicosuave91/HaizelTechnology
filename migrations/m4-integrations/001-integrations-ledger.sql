-- Integrations phase 1: vendor ledger, webhooks, and order scaffolding
set check_function_bodies = off;

-- Canonical vendors catalogue
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  slug text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create unique index if not exists vendors_slug_idx on vendors(slug) where slug is not null;

-- Vendor accounts are tenant scoped credentials and configuration
create table if not exists vendor_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  credentials_ref text not null,
  sandbox_bool boolean not null default false,
  status text not null default 'active',
  metadata jsonb,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1,
  constraint vendor_accounts_tenant_vendor_sandbox_key unique (tenant_id, vendor_id, sandbox_bool)
);

create index if not exists vendor_accounts_tenant_status_idx on vendor_accounts(tenant_id, status);

-- Vendor requests record outbound calls to vendor services
create table if not exists vendor_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  vendor_account_id uuid references vendor_accounts(id) on delete set null,
  loan_id uuid references loans(id) on delete set null,
  actor_id uuid,
  service text not null,
  idempotency_key text not null,
  external_id text,
  payload_digest text,
  payload_uri text,
  payload bytea,
  headers_json jsonb,
  sent_at timestamptz,
  completed_at timestamptz,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1,
  constraint vendor_requests_idempotent_key unique (tenant_id, vendor_id, idempotency_key)
);

create index if not exists vendor_requests_tenant_loan_idx on vendor_requests(tenant_id, loan_id, created_at);
create index if not exists vendor_requests_tenant_service_idx on vendor_requests(tenant_id, service);

-- Vendor responses capture inbound payloads or polling responses
create table if not exists vendor_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references vendor_requests(id) on delete cascade,
  status text not null,
  payload_uri text,
  payload bytea,
  error_code text,
  error_message text,
  received_at timestamptz not null default now(),
  latency_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

create index if not exists vendor_responses_request_idx on vendor_responses(request_id);

-- Webhook ledger captures inbound notifications
create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  request_id uuid references vendor_requests(id) on delete set null,
  topic text not null,
  received_sig text not null,
  signature_digest text not null,
  payload_uri text,
  payload bytea,
  received_at timestamptz not null default now(),
  verified_bool boolean not null default false,
  replayed_bool boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1,
  constraint webhooks_signature_digest_unique unique (tenant_id, vendor_id, signature_digest)
);

create index if not exists webhooks_tenant_received_idx on webhooks(tenant_id, received_at desc);

-- Orders table ensures integrations can drive lifecycle workflows
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete set null,
  order_type text,
  service text,
  vendor_id uuid references vendors(id) on delete set null,
  vendor_request_id uuid references vendor_requests(id) on delete set null,
  vendor text,
  status text,
  request_json jsonb,
  response_json jsonb,
  sla_due_at timestamptz,
  completed_at timestamptz,
  cost numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

-- Extend orders to support integrations lifecycle metadata
alter table orders
  add column if not exists service text,
  add column if not exists vendor_id uuid references vendors(id),
  add column if not exists vendor_request_id uuid references vendor_requests(id),
  add column if not exists request_json jsonb,
  add column if not exists response_json jsonb,
  add column if not exists sla_due_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cost numeric(12,2);

create index if not exists orders_tenant_loan_created_idx on orders(tenant_id, loan_id, created_at);
create index if not exists orders_tenant_service_idx on orders(tenant_id, service);

-- Document enrichment for storage metadata
alter table documents
  add column if not exists "type" text,
  add column if not exists filename text,
  add column if not exists storage_uri text,
  add column if not exists content_hash text,
  add column if not exists classification text,
  add column if not exists signed_at timestamptz;

create index if not exists documents_tenant_loan_created_idx on documents(tenant_id, loan_id, created_at);
create index if not exists documents_tenant_type_idx on documents(tenant_id, "type");

-- Disclosures table (Loan Estimates, Closing Disclosures, etc.)
create table if not exists disclosures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete set null,
  disclosure_type text,
  disclosure_version integer,
  issued_at timestamptz,
  delivered_at timestamptz,
  proof_uri text,
  gates_snapshot jsonb,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

-- Disclosure lifecycle metadata
alter table disclosures
  add column if not exists disclosure_type text,
  add column if not exists disclosure_version integer,
  add column if not exists issued_at timestamptz,
  add column if not exists proof_uri text,
  add column if not exists gates_snapshot jsonb;

create index if not exists disclosures_tenant_loan_issued_idx on disclosures(tenant_id, loan_id, issued_at);
create index if not exists disclosures_tenant_type_idx on disclosures(tenant_id, disclosure_type);

-- Compliance and SLA clocks
create table if not exists clocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  loan_id uuid references loans(id) on delete set null,
  clock_type text not null,
  state text not null default 'running',
  started_at timestamptz not null default now(),
  due_at timestamptz,
  stopped_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1
);

-- Clock enhancements for SLA tracking
alter table clocks
  add column if not exists state text not null default 'running',
  add column if not exists due_at timestamptz,
  add column if not exists reason text;

create index if not exists clocks_tenant_loan_idx on clocks(tenant_id, loan_id);
create index if not exists clocks_tenant_type_state_idx on clocks(tenant_id, clock_type, state);

-- Row level security policies
alter table vendor_accounts enable row level security;
alter table vendor_accounts force row level security;
create policy vendor_accounts_tenant_isolation on vendor_accounts
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

alter table vendor_requests enable row level security;
alter table vendor_requests force row level security;
create policy vendor_requests_tenant_isolation on vendor_requests
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

alter table vendor_responses enable row level security;
alter table vendor_responses force row level security;
create policy vendor_responses_tenant_isolation on vendor_responses
  using (exists (
    select 1
      from vendor_requests vr
     where vr.id = vendor_responses.request_id
       and vr.tenant_id = app.current_tenant()
  ))
  with check (exists (
    select 1
      from vendor_requests vr
     where vr.id = vendor_responses.request_id
       and vr.tenant_id = app.current_tenant()
  ));

alter table webhooks enable row level security;
alter table webhooks force row level security;
create policy webhooks_tenant_isolation on webhooks
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

alter table orders enable row level security;
alter table orders force row level security;
create policy orders_tenant_isolation on orders
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

alter table disclosures enable row level security;
alter table disclosures force row level security;
create policy disclosures_tenant_isolation on disclosures
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

alter table clocks enable row level security;
alter table clocks force row level security;
create policy clocks_tenant_isolation on clocks
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

-- Updated-at triggers for new tables
create trigger trg_vendor_accounts_updated
  before update on vendor_accounts
  for each row execute function app.updated_at_trigger();

create trigger trg_vendor_requests_updated
  before update on vendor_requests
  for each row execute function app.updated_at_trigger();

create trigger trg_vendor_responses_updated
  before update on vendor_responses
  for each row execute function app.updated_at_trigger();

create trigger trg_webhooks_updated
  before update on webhooks
  for each row execute function app.updated_at_trigger();

create trigger trg_vendors_updated
  before update on vendors
  for each row execute function app.updated_at_trigger();

create trigger trg_orders_updated
  before update on orders
  for each row execute function app.updated_at_trigger();

create trigger trg_disclosures_updated
  before update on disclosures
  for each row execute function app.updated_at_trigger();

create trigger trg_clocks_updated
  before update on clocks
  for each row execute function app.updated_at_trigger();
