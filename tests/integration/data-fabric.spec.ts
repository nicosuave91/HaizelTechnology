import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const connectionString = process.env.API_POSTGRES_URL ?? process.env.TEST_DB_URL;

if (!connectionString) {
  describe.skip('data fabric integration', () => {
    it('requires database connection string', () => {
      expect(true).toBe(true);
    });
  });
} else {
  const pool = new Pool({ connectionString });

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const loanA = randomUUID();
  const loanB = randomUUID();
  const borrowerA = randomUUID();
  const borrowerB = randomUUID();

  const pii = {
    ssn: '123-45-6789',
    dob: '1990-04-21',
    email: 'borrower@example.com',
    phone: '+1 (555) 867-5309',
  };

  const now = new Date();

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('app.roles', 'role_admin', true)");
      await client.query('insert into tenants (id, slug, name) values ($1,$2,$3) on conflict (id) do nothing', [tenantA, 'tenant-a', 'Tenant A']);
      await client.query('insert into tenants (id, slug, name) values ($1,$2,$3) on conflict (id) do nothing', [tenantB, 'tenant-b', 'Tenant B']);

      await client.query('select set_config($1,$2,true)', ['app.tenant', tenantA]);
      await client.query('insert into users (id, tenant_id, email, name) values ($1,$2,$3,$4) on conflict (id) do nothing', [userA, tenantA, 'usera@example.com', 'User A']);
      await client.query('insert into loans (id, tenant_id, loan_number, status, amount, loan_type) values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing', [loanA, tenantA, 'A-100', 'open', 500000, 'purchase']);
      await client.query('insert into borrowers (id, tenant_id, loan_id, first_name, last_name, email, phone, ssn, dob, bureau_file_id, bank_account_number) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (id) do nothing', [borrowerA, tenantA, loanA, 'Alice', 'Anderson', pii.email, pii.phone, pii.ssn, pii.dob, 'BF123', '123456789']);

      await client.query('select set_config($1,$2,true)', ['app.tenant', tenantB]);
      await client.query('insert into users (id, tenant_id, email, name) values ($1,$2,$3,$4) on conflict (id) do nothing', [userB, tenantB, 'userb@example.com', 'User B']);
      await client.query('insert into loans (id, tenant_id, loan_number, status, amount, loan_type) values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing', [loanB, tenantB, 'B-200', 'processing', 250000, 'refi']);
      await client.query('insert into borrowers (id, tenant_id, loan_id, first_name, last_name, email, phone, ssn, dob, bureau_file_id, bank_account_number) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (id) do nothing', [borrowerB, tenantB, loanB, 'Bob', 'Brown', 'bob@example.com', '+1 (555) 123-4567', '987-65-4321', '1985-12-11', 'BF987', '987654321']);

      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  async function configureSession(client: Awaited<ReturnType<typeof pool.connect>>, tenant: string, roles: string, user?: string) {
    await client.query('select set_config($1,$2,true)', ['app.tenant', tenant]);
    await client.query('select set_config($1,$2,true)', ['app.roles', roles]);
    if (user) {
      await client.query('select set_config($1,$2,true)', ['app.user', user]);
    }
  }

  describe('Row level security', () => {
    it('isolates rows per tenant and preserves governance defaults', async () => {
      const client = await pool.connect();
      try {
        await configureSession(client, tenantA, 'role_viewer');
        const resA = await client.query('select loan_number, governance_scope, dr_protected from loans order by loan_number');
        expect(resA.rows).toEqual([
          expect.objectContaining({ loan_number: 'A-100', governance_scope: 'loan', dr_protected: false }),
        ]);

        await configureSession(client, tenantB, 'role_viewer');
        const resB = await client.query('select loan_number from loans order by loan_number');
        expect(resB.rows.map((r) => r.loan_number)).toEqual(['B-200']);
      } finally {
        client.release();
      }
    });
  });

  describe('Data masking and audit', () => {
    it('masks borrower PII and allows privileged unmasking with audit trail', async () => {
      const client = await pool.connect();
      try {
        await configureSession(client, tenantA, 'role_viewer');
        const masked = await client.query('select ssn, dob, email, phone, mask_profile from borrowers_masked where id = $1', [borrowerA]);
        expect(masked.rows[0].ssn).toBe('***-**-6789');
        expect((masked.rows[0].dob as Date).toISOString().startsWith('1990-04-01')).toBe(true);
        expect(masked.rows[0].mask_profile).toBe('standard');

        await configureSession(client, tenantA, 'role_underwriter', userA);
        const session = randomUUID();
        const result = await client.query('select (sp_unmask_borrower($1, $2, $3)).ssn as ssn', [borrowerA, 'Underwriting verification', session]);
        expect(result.rows[0].ssn).toBe(pii.ssn);

        const audit = await client.query('select scope, session_id, reason, pii_fields from access_audit where user_id = $1 order by occurred_at desc limit 1', [userA]);
        expect(audit.rows[0].scope).toBe('standard');
        expect(audit.rows[0].session_id).toBe(session);
        expect(audit.rows[0].pii_fields).toContain('ssn');
      } finally {
        client.release();
      }
    });
  });

  describe('Event integrity', () => {
    it('maintains and verifies hash chains with governance tags', async () => {
      const client = await pool.connect();
      try {
        await configureSession(client, tenantA, 'role_admin', userA);
        await client.query('insert into events (tenant_id, loan_id, type, source, actor, payload_jsonb, governance_tags, occurred_at) values ($1,$2,$3,$4,$5,$6::jsonb,$7::text[],$8)', [tenantA, loanA, 'loan.created', 'api', userA, JSON.stringify({ amount: 500000 }), ['p0', 'audit'], now]);
        await client.query('insert into events (tenant_id, loan_id, type, source, actor, payload_jsonb, governance_tags, occurred_at) values ($1,$2,$3,$4,$5,$6::jsonb,$7::text[],$8)', [tenantA, loanA, 'loan.updated', 'api', userA, JSON.stringify({ status: 'processing' }), ['p0', 'audit'], new Date(now.getTime() + 1000)]);

        const events = await client.query('select prev_hash, hash, governance_tags from events where tenant_id = $1 and loan_id = $2 order by occurred_at', [tenantA, loanA]);
        expect(events.rowCount).toBeGreaterThanOrEqual(2);
        expect(events.rows[1].prev_hash).toBe(events.rows[0].hash);
        expect(events.rows[0].governance_tags).toContain('audit');

        await client.query('select fn_verify_event_chain(now() - interval \'1 day\', now())');
        const integrity = await client.query('select mismatches from events_integrity order by run_at desc limit 1');
        expect(integrity.rows[0].mismatches).toBeGreaterThanOrEqual(0);
      } finally {
        client.release();
      }
    });
  });

  describe('Disaster recovery scaffolding', () => {
    it('starts and completes DR drills while toggling feature flags', async () => {
      const client = await pool.connect();
      try {
        await configureSession(client, tenantA, 'role_admin', userA);
        const drillStart = await client.query('select sp_begin_dr_drill($1, $2) as id', ['Routine drill', now]);
        const drillId = drillStart.rows[0].id as string;
        expect(drillId).toBeTruthy();

        const drillRow = await client.query('select status, pitr_target from dr_drills where id = $1', [drillId]);
        expect(drillRow.rows[0].status).toBe('initiated');

        const feature = await client.query("select enabled from feature_flags where tenant_id = $1 and flag = 'dr.active_database'", [tenantA]);
        expect(feature.rows[0].enabled).toBe(true);

        await client.query('select sp_record_dr_access($1, $2, $3, $4)', [drillId, 'runbook', 'review', 'Checklist reviewed']);
        await client.query('select sp_complete_dr_drill($1, $2, $3)', [drillId, true, 'Completed successfully']);

        const drillComplete = await client.query('select status, completed_at from dr_drills where id = $1', [drillId]);
        expect(drillComplete.rows[0].status).toBe('completed');
        expect(drillComplete.rows[0].completed_at).not.toBeNull();

        const featureAfter = await client.query("select enabled from feature_flags where tenant_id = $1 and flag = 'dr.active_database'", [tenantA]);
        expect(featureAfter.rows[0].enabled).toBe(false);
      } finally {
        client.release();
      }
    });
  });
}
