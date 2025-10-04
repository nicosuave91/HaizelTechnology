-- Tasks, queues, orders, and vendor integration schema for milestone M6
set check_function_bodies = off;

-- Enumerations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_state') THEN
    CREATE TYPE task_state AS ENUM ('NEW','IN_PROGRESS','BLOCKED','DONE');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_service') THEN
    CREATE TYPE order_service AS ENUM ('APPRAISAL','TITLE','FLOOD','MI','SSA89','4506-C');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('PENDING','DRAFT','SUBMITTED','IN_PROGRESS','COMPLETED','FAILED','CANCELED');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dlq_entry_status') THEN
    CREATE TYPE dlq_entry_status AS ENUM ('PENDING','REPLAYED','ARCHIVED');
  END IF;
END;
$$;

-- Drop dependent tables to rebuild according to new contract
DROP TABLE IF EXISTS task_events CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS queue_defs CASCADE;
DROP TABLE IF EXISTS vendor_responses CASCADE;
DROP TABLE IF EXISTS vendor_requests CASCADE;
DROP TABLE IF EXISTS vendor_accounts CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS dlq_entries CASCADE;

-- Core task tables
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES users(id),
  queue_key text NOT NULL,
  type text NOT NULL,
  state task_state NOT NULL DEFAULT 'NEW',
  priority integer NOT NULL DEFAULT 3,
  due_at timestamptz,
  sla_due_at timestamptz,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata_jsonb jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX idx_tasks_tenant_state_queue_due ON tasks (tenant_id, state, queue_key, due_at);
CREATE INDEX idx_tasks_tenant_owner_state ON tasks (tenant_id, owner_user_id, state);
CREATE INDEX idx_tasks_tenant_sla ON tasks (tenant_id, sla_due_at);

CREATE TABLE task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  state_from task_state,
  state_to task_state,
  payload_jsonb jsonb,
  prev_hash text,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_task_events_tenant_task_created ON task_events (tenant_id, task_id, created_at);

CREATE TABLE queue_defs (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  skills text[] NOT NULL DEFAULT ARRAY[]::text[],
  routing_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, key)
);

-- Vendor and order domain
CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  services order_service[] NOT NULL,
  health_json jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT vendors_tenant_slug_key UNIQUE (tenant_id, slug)
);

CREATE TABLE vendor_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  skills text[] NOT NULL DEFAULT ARRAY[]::text[],
  credentials_jsonb jsonb,
  status text NOT NULL DEFAULT 'active',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT vendor_accounts_tenant_vendor_display_key UNIQUE (tenant_id, vendor_id, display_name)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
  service order_service NOT NULL,
  status order_status NOT NULL DEFAULT 'PENDING',
  vendor_id uuid REFERENCES vendors(id),
  vendor_account_id uuid REFERENCES vendor_accounts(id),
  sla_due_at timestamptz,
  cost numeric(14,2),
  request_json jsonb,
  response_json jsonb,
  metadata_jsonb jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX idx_orders_tenant_status_service ON orders (tenant_id, status, service);
CREATE INDEX idx_orders_tenant_loan ON orders (tenant_id, loan_id);

CREATE TABLE vendor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_account_id uuid REFERENCES vendor_accounts(id),
  service order_service NOT NULL,
  status order_status NOT NULL DEFAULT 'PENDING',
  attempt integer NOT NULL DEFAULT 1,
  correlation_id text NOT NULL,
  key_hash text,
  request_hash text,
  response_hash text,
  response_payload jsonb,
  request_json jsonb,
  response_json jsonb,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT vendor_requests_tenant_correlation_key UNIQUE (tenant_id, correlation_id)
);

CREATE INDEX idx_vendor_requests_tenant_vendor_service ON vendor_requests (tenant_id, vendor_id, service);
CREATE UNIQUE INDEX idx_vendor_requests_tenant_key_hash ON vendor_requests (tenant_id, key_hash) WHERE key_hash IS NOT NULL;

CREATE TABLE vendor_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES vendor_requests(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id),
  status_code integer,
  error_code text,
  payload_json jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_responses_tenant_request ON vendor_responses (tenant_id, request_id);
CREATE INDEX idx_vendor_responses_tenant_vendor ON vendor_responses (tenant_id, vendor_id);

CREATE TABLE webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  request_id uuid REFERENCES vendor_requests(id) ON DELETE SET NULL,
  external_id text,
  signature text,
  signature_valid boolean NOT NULL DEFAULT false,
  payload_json jsonb NOT NULL,
  headers_json jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_tenant_vendor_received ON webhooks (tenant_id, vendor_id, received_at);

CREATE TABLE dlq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL,
  ref_id text,
  reason_code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  payload_json jsonb NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status dlq_entry_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  replayed_at timestamptz
);

CREATE INDEX idx_dlq_entries_tenant_status ON dlq_entries (tenant_id, status);
CREATE INDEX idx_dlq_entries_source_status ON dlq_entries (source, status);
