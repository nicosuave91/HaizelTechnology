# DR Drill Runbook: PITR within 24 Hours

## Overview
This drill validates that we can restore the production database to an arbitrary point in the last 24 hours and steer the Haizel-BLP application toward the recovered instance using a feature flag.

## Preconditions
- PITR prerequisites enabled on the primary Postgres cluster:
  - `wal_level = replica`
  - `archive_mode = on`
  - `archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'` (adapt path per environment)
- Continuous base backups running via `pg_basebackup` (nightly).
- `pg_cron` extension installed on primary and replicas.
- Feature flag `dr.active_database` defined in `feature_flags` for each tenant.
- Sufficient disk space for WAL archives spanning at least 48 hours.

## Drill Steps
1. **Select recovery point**
   - Determine a timestamp `T` within the last 24 hours.
   - Capture primary cluster WAL location and confirm WAL archives exist past `T`.

2. **Provision recovery host**
   - Allocate new Postgres instance/VM in the DR region.
   - Install matching Postgres major/minor version and extensions (`pgcrypto`, `pg_cron`).

3. **Restore base backup**
   - Copy the most recent base backup taken prior to `T` into the recovery host's data directory.
   - Apply WAL files from archive storage up to (but not beyond) timestamp `T` using `recovery.signal` + `restore_command`:
     ```bash
     cat <<'RC' > $PGDATA/recovery.conf
     restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
     recovery_target_time = '2024-05-14 15:30:00+00'
     recovery_target_action = 'pause'
     RC
     ```
   - Start Postgres and monitor logs for successful recovery pause at `T`.

4. **Promote recovery instance**
   - Run `pg_ctl promote` to end recovery mode.
   - Verify `SELECT pg_is_in_recovery();` returns `false`.

5. **Run integrity checks**
   - Execute `SELECT fn_verify_event_chain(now() - interval '24 hours', now());` and confirm the latest `events_integrity` row has `mismatches = 0`.
   - Run application smoke tests or execute `pnpm --filter api test -- --runInBand --grep "RLS"` against the recovered instance using tenant/user credentials.

6. **Flip feature flag**
   - Update `feature_flags` setting `dr.active_database` to `true` for targeted tenants.
   - Application bootstrap reads the flag and points connection strings to the DR instance (requires prior configuration in config service).

7. **Validate application**
   - Perform read/write checks (create loan, add borrower) while monitoring access audits and event hashes.
   - Ensure borrower masking/unmasking works via API.

8. **Collect evidence**
   - Export `events_integrity` row, access audit entries, and application logs demonstrating successful operations.
   - Document duration, issues, and next actions.

9. **Failback**
   - Once primary is healthy, reverse the feature flag and follow standard replication bootstrap to resync the DR host.

## Post-Drill Checklist
- [ ] WAL archive retention verified (>48h)
- [ ] Recovery duration recorded
- [ ] Integrity + RLS tests attached to evidence
- [ ] Lessons learned circulated to SRE/Security
