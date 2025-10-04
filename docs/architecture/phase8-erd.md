# Phase 8 (M7) Pricing & Locks — ERD Delta

```
Tenant (1) ──< PricingQuote >── (0..1) Loan
Tenant (1) ──< RateLock >── (1) Loan
Tenant (1) ──< Exception >── (1) Loan
Tenant (1) ──< VendorRequest
```

## Prisma Models
- `PricingQuote`: captures PPE responses with LLPA + cost JSON, tenant scoped.
- `RateLock`: lifecycle state machine with actions history and expiry indexes.
- `Exception`: governance workflow with audit trail JSON and approver metadata.
- `VendorRequest`: idempotency registry for PPE calls.

## SQL Migration Highlights
- Creates tables `pricing_quotes`, `rate_locks`, `exceptions`, `vendor_requests` with tenant RLS.
- Adds indexes for `expires_at`, `(tenant_id, status)` on locks/exceptions, `(tenant_id, created_at)` on quotes.
- Defines masked views `pricing_quotes_masked`, `rate_locks_masked`, `exceptions_masked`.
