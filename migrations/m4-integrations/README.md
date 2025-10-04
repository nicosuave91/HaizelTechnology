# M4 – Integrations Ledger & Gateway Foundations

This migration introduces the shared vendor catalog, multi-tenant vendor account bindings, the vendor request/response ledger, webhook journal, and enriched artifacts (orders, documents, clocks, disclosures) required for the Integrations phase.

Key capabilities:

- Canonical `vendors` catalog and tenant-scoped `vendor_accounts` with replay-safe credential storage references.
- `vendor_requests` and `vendor_responses` tables with tamper-evident metadata, idempotency keys, payload digests, and request archival URIs.
- Webhook ledger for signature dedupe with enforced row-level security and updated-at triggers.
- Enriched operational tables (orders, documents, disclosures, clocks) with SLA and storage metadata to drive adapters.
- Row-level security, indexes, and updated-at triggers aligned with the existing governance model.

Apply this migration before deploying the webhook gateway, adapters, or UI consumers so downstream services can persist payloads and drive SLA-aware workflows.
