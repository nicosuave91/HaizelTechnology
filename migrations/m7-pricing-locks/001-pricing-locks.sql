-- Phase 8 (M7) Pricing & Locks core tables
-- Ensure prior exceptions table is replaced with new governance-compliant layout
DROP TABLE IF EXISTS exceptions CASCADE;

CREATE TABLE IF NOT EXISTS vendor_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_hash TEXT NULL,
    response_payload_json JSONB NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, key_hash)
);

ALTER TABLE vendor_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_requests_tenant_isolation ON vendor_requests
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS pricing_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    loan_id UUID NULL REFERENCES loans(id) ON DELETE SET NULL,
    ppe TEXT NOT NULL,
    scenario_key TEXT NOT NULL,
    eligibility_json JSONB NOT NULL,
    rate NUMERIC(8,4) NOT NULL,
    price NUMERIC(10,4) NOT NULL,
    lock_period INTEGER NOT NULL,
    llpas_json JSONB NOT NULL,
    cost_items_json JSONB NOT NULL,
    raw_payload_uri TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pricing_quotes_tenant_created_at_idx
    ON pricing_quotes(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_quotes_loan_created_at_idx
    ON pricing_quotes(loan_id, created_at DESC);

ALTER TABLE pricing_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pricing_quotes_tenant_isolation ON pricing_quotes
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS rate_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('new','locked','extended','expired','voided','float_down_applied')),
    locked_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    lock_period_days INTEGER NOT NULL,
    product_ref TEXT NOT NULL,
    rate NUMERIC(8,4) NOT NULL,
    price NUMERIC(10,4) NOT NULL,
    actions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_locks_loan_status_idx
    ON rate_locks(loan_id, status);
CREATE INDEX IF NOT EXISTS rate_locks_tenant_status_idx
    ON rate_locks(tenant_id, status);
CREATE INDEX IF NOT EXISTS rate_locks_expires_at_idx
    ON rate_locks(expires_at);

ALTER TABLE rate_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY rate_locks_tenant_isolation ON rate_locks
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TABLE IF NOT EXISTS exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    rule_code TEXT NOT NULL,
    pricing_code TEXT NULL,
    type TEXT NOT NULL CHECK (type IN ('pricing','overlay','uw')),
    justification TEXT NOT NULL,
    requested_by UUID NOT NULL,
    approver_user_id UUID NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','approved','denied','expired')),
    scope TEXT NOT NULL CHECK (scope IN ('loan','tenant')),
    expires_at TIMESTAMPTZ NULL,
    audit_trail_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exceptions_loan_status_idx
    ON exceptions(loan_id, status);
CREATE INDEX IF NOT EXISTS exceptions_tenant_status_idx
    ON exceptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS exceptions_expires_at_idx
    ON exceptions(expires_at);

ALTER TABLE exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY exceptions_tenant_isolation ON exceptions
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE OR REPLACE VIEW pricing_quotes_masked AS
SELECT id,
       tenant_id,
       loan_id,
       ppe,
       scenario_key,
       rate,
       price,
       lock_period,
       created_at
FROM pricing_quotes;

CREATE OR REPLACE VIEW rate_locks_masked AS
SELECT id,
       tenant_id,
       loan_id,
       status,
       expires_at,
       lock_period_days,
       product_ref,
       rate,
       price,
       updated_at
FROM rate_locks;

CREATE OR REPLACE VIEW exceptions_masked AS
SELECT id,
       tenant_id,
       loan_id,
       rule_code,
       pricing_code,
       type,
       status,
       scope,
       expires_at,
       created_at,
       updated_at
FROM exceptions;
