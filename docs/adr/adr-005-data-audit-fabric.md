# ADR-005: Data & Audit Fabric for Haizel-BLP

## Status
Accepted

## Context
Phase M1 requires a hardened multi-tenant data fabric that enforces tenant isolation, protects personally identifiable information (PII), provides tamper-evident event history, and supports disaster recovery (DR) expectations (point-in-time recovery and documented drills). The existing M0 baseline shipped a simple tenant helper and hash-chain trigger but lacked comprehensive table coverage, masking, auditing, and operational controls.

## Decision
- All core tables adopt a uniform set of governance columns (`tenant_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `version`) enforced via schema helpers and triggers. `app.updated_at_trigger` increments `version` on writes while preserving optimistic locking semantics.
- Row Level Security (RLS) is enabled and forced across the multi-tenant schema. Tenant-level isolation relies on the `app.current_tenant()` setting, while write policies restrict mutating commands to operational roles (`role_admin`, `role_processor`, `role_underwriter`).
- Security-barrier masking views (`borrowers_masked`, `co_borrowers_masked`) default API reads to redacted SSN, DOB, email, and phone data. Privileged unmasking uses `sp_unmask_borrower` / `sp_unmask_co_borrower`, which validate caller roles, return the plain rows, and persist rationale + column list into `access_audit`.
- Event sourcing is recorded in the `events` table with a SHA-256 hash chain computed by `app.event_hash_chain`. `fn_verify_event_chain` runs nightly via `pg_cron`, storing attestation metadata in `events_integrity` for Grafana ingestion.
- Postgres point-in-time recovery (PITR) is enabled through WAL archiving settings managed in infra. A feature flag allows routing the application to a recovered instance during DR drills.
- Prisma remains the authoritative ORM schema while SQL migrations define policies, functions, views, and scheduler jobs. Every migration must ship an accompanying rollback section or script capable of reversing structural changes without downtime.

## Consequences
- Application connections must set `app.tenant`, `app.user`, and `app.roles` GUCs per request to satisfy RLS and unmasking routines.
- Privileged access is auditable: each unmasking call writes intent, actor, and touched PII fields into `access_audit`.
- Cron scheduling requires the `pg_cron` extension. The runbook documents enabling it in managed environments.
- Nightly hash-chain verification produces metrics/notes in `events_integrity`, enabling Grafana dashboards and alerting on mismatches.
- PITR expectations add storage for WAL archives and require operational rehearsal (documented in the DR drill runbook).
- Developers must ensure forward-compatible database changes; destructive schema edits require dual-write/downgrade plans per the migration policy.
