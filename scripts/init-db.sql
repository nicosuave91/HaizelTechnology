CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant() RETURNS text AS $$
BEGIN
  RETURN current_setting('app.tenant', true);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION app.set_event_hash() RETURNS trigger AS $$
DECLARE
  previous_hash TEXT;
BEGIN
  IF NEW.prevHash IS NULL THEN
    SELECT hash INTO previous_hash FROM "Event"
      WHERE tenantId = NEW.tenantId AND loanId = NEW.loanId
      ORDER BY occurredAt DESC LIMIT 1;
    NEW.prevHash := previous_hash;
  END IF;
  NEW.hash := encode(digest(coalesce(NEW.prevHash, '') || NEW.type || NEW.occurredAt::text, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'haizel_app') THEN
    CREATE ROLE haizel_app LOGIN PASSWORD 'haizel_app';
  END IF;
END;
$$;

ALTER ROLE haizel_app SET search_path = public;

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Loan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VendorRequest" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant"
  USING (id = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation_user ON "User";
CREATE POLICY tenant_isolation_user ON "User"
  USING (tenantId = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation_loan ON "Loan";
CREATE POLICY tenant_isolation_loan ON "Loan"
  USING (tenantId = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation_event ON "Event";
CREATE POLICY tenant_isolation_event ON "Event"
  USING (tenantId = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation_vendor_requests ON "VendorRequest";
CREATE POLICY tenant_isolation_vendor_requests ON "VendorRequest"
  USING (tenantId = app.current_tenant());

DROP TRIGGER IF EXISTS event_hash_chain ON "Event";
CREATE TRIGGER event_hash_chain
  BEFORE INSERT ON "Event"
  FOR EACH ROW EXECUTE FUNCTION app.set_event_hash();
