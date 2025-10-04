# Vendor Outage Runbook (M6)

**Last reviewed:** 2024-05-25

## Purpose
Coordinate response when a downstream vendor for Title, Flood, MI, SSA-89, or 4506-C orders experiences partial or total outage. Ensures customer communication, workload rerouting, and compliance timelines are maintained.

## Detection
- Temporal metrics `worker.activities.SubmitOrder` latency > 5s or failure ratio > 5%.
- `/v1/orders` API showing surge in `FAILED` status with identical vendor.
- Vendor health widget (web Orders Hub) displays `status = degraded|down`.
- Alert from vendor monitoring or webhook inactivity for >15 minutes.

## Immediate Actions
1. **Acknowledge alert** in PagerDuty (or configured incident manager).
2. **Freeze retries** for the vendor to avoid DLQ overload:
   - Call `/v1/orders/{id}:retry` only after health checks recover.
   - Temporarily disable automation by updating `vendor_accounts.status = 'paused'` via admin console.
3. **Notify stakeholders**:
   - Post summary in `#ops-broker` Slack channel.
   - Email compliance lead if SLA at-risk > 10% of active orders.
4. **Validate scope** using SQL:
   ```sql
   select vendor_id, count(*) as pending
   from orders
   where tenant_id = :tenant
     and vendor_id = :vendor
     and status in ('SUBMITTED','IN_PROGRESS')
   group by vendor_id;
   ```
5. **Trigger reroute** if alternate vendor configured:
   - Call `/v1/queues/route` with `preferredQueues` targeting fallback skillset.
   - Update `queue_defs.routing_json` to temporarily bias away from impacted vendor.

## Communication Template
> Vendor {vendor_name} outage detected at {timestamp}. Orders automatically paused and rerouted where configured. Next update in 30 minutes.

## Recovery Steps
1. Confirm vendor status via official channel (portal/webhook recovery).
2. Re-enable account: set `vendor_accounts.status = 'active'`.
3. Replay DLQ entries via `/v1/dlq/{id}:replay` (batch using automation script).
4. Monitor Temporal metrics for 15 minutes; ensure failure rate < 2% before resuming bulk flood operations.
5. Post incident review in shared doc referencing task/event IDs.

## Post-Incident
- Create `task_events` entry summarizing outage (state transition to `blocked`).
- File RCA within 48 hours including SLA impact and recovered orders count.
- Update vendor health thresholds if detection lag > 5 minutes.
