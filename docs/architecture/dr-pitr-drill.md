# DR Drill & PITR Runbook Notes

This document captures the high-level procedure for executing a disaster recovery (DR) drill using the new PITR scaffolding.

## Pre-requisites
- Ensure the application role being used for the drill can call the stored procedures `sp_begin_dr_drill`, `sp_record_dr_access`, and `sp_complete_dr_drill`.
- Confirm that WAL archiving and base backups are configured per infrastructure runbooks (PITR prerequisites).
- Validate monitoring hooks that will ingest entries from `dr_drills` and `access_audit`.

## Drill Steps
1. **Start the drill**
   - Set the session context (`app.tenant`, `app.user`, `app.roles`).
   - Call `sp_begin_dr_drill('Quarterly DR drill', <target timestamp>)`. This creates a new record in `dr_drills` and enables the `dr.active_database` feature flag to signal downstream workers.
2. **Execute PITR activities**
   - Use infrastructure tooling to restore the database to the requested timestamp in an isolated environment.
   - Replay application smoke tests.
   - Record each notable action with `sp_record_dr_access(dr_drill_id, resource, action, reason)` to maintain an audit trail.
3. **Cut back to primary**
   - Validate that the restored environment matches expected RPO/RTO measurements.
   - Disable any temporary routing or connectivity changes introduced for the drill.
4. **Complete the drill**
   - Call `sp_complete_dr_drill(dr_drill_id, success, 'Summary text')`. On success the feature flag is disabled and completion metadata is attached to `dr_drills`.
   - Capture post-mortem notes in the `notes` JSON column for future reference.

## Post-drill Checklist
- Export the `dr_drills` row and attach it to the incident ticket.
- Review `access_audit` entries scoped to the drill to confirm sensitive operations were justified.
- Feed findings back into the governance backlog, especially if manual steps were discovered.
