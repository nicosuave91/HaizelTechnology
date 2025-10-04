# Phase 8 (M7) Pricing & Locks — UAT Checklist

## Quotes & Compare
- [ ] Authenticate via dev login and open Pricing & Locks page.
- [ ] Configure Scenario A (FICO 760 / LTV 80) and Scenario B (FICO 700 / LTV 90), run quote.
  - Expect two scenario cards with LLPA tooltips and comparison delta card.
  - Verify Scenario Drawer shows LLPA breakdown with tooltips and deltas persisted to history.
- [ ] Save Scenario A as view, reload page, ensure saved view persists.

## Lock Lifecycle
- [ ] From Pricing & Locks page create a lock via API (POST /locks) and refresh watchlist.
- [ ] Trigger extend action from Lock Actions Drawer, confirm expiry updates and audit event `lock.extended` recorded.
- [ ] Validate <48h badges surface when `expiresAt` within window and Dashboard chip highlights count.
- [ ] Execute float-down (scope must include `locks:float-down`), ensure event `lock.float_down.applied` recorded.
- [ ] Void lock, verify `lock.voided` event emitted.

## Exceptions Workflow
- [ ] Submit exception via POST `/loans/{id}/exceptions` with justification; confirm pending card blocks funding banner.
- [ ] Approve exception via Drawer, confirm status chips update and funding block clears.
- [ ] Deny exception and confirm audit trail shows request + decision entries with timestamps.

## Funding Gate
- [ ] With pending exception, attempt funding workflow; verify block message references exception justification link.
- [ ] After approval, funding should proceed (no block).

## Observability & SLA
- [ ] Capture OpenTelemetry trace for pricing quote (`pricing.quote.*`) ensuring p95 < 2s during k6 run.
- [ ] Validate metrics `pricing.quote.latency`, `pricing.quote.errors`, and `locks.timer.latency` emitted.
- [ ] Run `k6 run tests/perf/pricing-locks-phase8.js` with mock token, ensure thresholds met.

## Lock Timers & Alerts
- [ ] Start Temporal `LockTimerWorkflow`; confirm activities emit schedule + T-72/T-48/T-24 alerts and mark expired.
- [ ] Dashboard watchlist should surface lock after timer triggers.

## Audit & Governance
- [ ] Inspect `events` table for hash-chained entries for pricing, lock, and exception actions.
- [ ] Validate new tables enforce RLS by querying with `SET app.tenant_id` context.
