-- Row level security policies for milestone M6 objects

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events FORCE ROW LEVEL SECURITY;
ALTER TABLE queue_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_defs FORCE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_responses FORCE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks FORCE ROW LEVEL SECURITY;
ALTER TABLE dlq_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlq_entries FORCE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY task_events_tenant_isolation ON task_events
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY queue_defs_tenant_isolation ON queue_defs
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY orders_tenant_isolation ON orders
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY vendors_tenant_visibility ON vendors
  USING (tenant_id IS NULL OR tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY vendor_accounts_tenant_isolation ON vendor_accounts
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY vendor_requests_tenant_isolation ON vendor_requests
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY vendor_responses_tenant_isolation ON vendor_responses
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY webhooks_tenant_isolation ON webhooks
  USING (tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());

CREATE POLICY dlq_entries_tenant_isolation ON dlq_entries
  USING (tenant_id IS NULL OR tenant_id = app.current_tenant())
  WITH CHECK (tenant_id = app.current_tenant());
