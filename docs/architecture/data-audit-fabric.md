# Data Audit Fabric Architecture

The data fabric combines application-level tenancy with database-enforced guarantees to provide secure, governed access to lending data. The primary elements are:

## Tenancy and Governance Metadata
- **Helper functions**: `app.current_tenant()`, `app.current_user_id()`, and `app.current_roles()` read session configuration so RLS policies can trust runtime context.
- **Governance columns**: Tables such as `tenants`, `loans`, `borrowers`, `documents`, and `events` now carry `governance_tier`, `data_retention_days`, `governance_scope`, `dr_protected`, `data_classification`, `mask_profile`, and `governance_tags`. These provide lightweight metadata for downstream classification, retention, and DR workflows.
- **Disaster recovery drills**: The `dr_drills` table tracks PITR exercises with timestamps, triggering user, and JSON notes.

## Row-Level Security Strategy
- RLS is enabled and forced on every tenant-scoped table.
- Policies rely on the helper functions to enforce tenant isolation while allowing role-based updates (`role_admin`, `role_processor`, `role_underwriter`).
- Update triggers (`app.updated_at_trigger`) keep `updated_at` and `version` in sync across tables.

## Data Masking Controls
- `borrowers_masked` and `co_borrowers_masked` are security-barrier views that enforce dynamic masking for SSN, DOB, email, and phone unless the caller holds a privileged role.
- Privileged stored procedures (`sp_unmask_borrower`, `sp_unmask_co_borrower`) record every unmasking event in `access_audit`, capturing reason, session correlation, and optional DR drill context.

## Event Integrity
- `app.event_hash_chain()` generates a tamper-evident hash using previous hash, event metadata, payload, and governance tags.
- `fn_verify_event_chain` walks the chain for a time window, recording totals and mismatches in `events_integrity`.

## Operational Considerations
- Database roles (`role_admin`, `role_compliance`, etc.) must exist and be granted to application connection roles.
- Applications must set `app.tenant`, `app.roles`, and optionally `app.user` per session before issuing queries.
- Access auditing requires callers of the unmasking procedures to provide a human-readable reason and optional session identifier so investigators can correlate activity with workflow tooling.
