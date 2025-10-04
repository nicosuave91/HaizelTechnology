# DLQ Replay Runbook (M6)

**Last reviewed:** 2024-05-25

## Scope
Guides operators through safe replay of `dlq_entries` produced by Temporal workers, webhook ingestion, or vendor retries.

## Preconditions
- DLQ backlog confirmed via `/v1/dlq?status=PENDING`.
- Vendor or upstream system is stable (no active outage runbook in progress).
- Access to production console with tenant impersonation.

## Replay Checklist
1. **Snapshot current state**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     "https://api.haizel.dev/v1/dlq?status=PENDING"
   ```
2. **Prioritize** by `source`:
   - `orders.submit` first, then `webhooks.ingest`, then `tasks.route`.
   - Verify `ref_id` still exists (task/order may be closed).
3. **Warm cache**: run `/v1/sla/heatmap?scope=orders&range=week` to ensure UI reflects new SLA projections once replay succeeds.
4. **Replay** using API:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Idempotency-Key: $(uuidgen)" \
     "https://api.haizel.dev/v1/dlq/${DLQ_ID}:replay"
   ```
5. **Monitor Temporal**: watch `dlq.replayed` metric and ensure correlated workflow completes.
6. **Audit**: confirm `dlq_entries.status = 'REPLAYED'` and `last_seen_at` updated.

## Failure Handling
- If replay fails twice, set `status = 'ARCHIVED'` and open Jira ticket `OPS-<id>` with payload hash.
- For serialization errors, export `payload_json` to secure bucket for engineering review.

## Post-Run
- Summarize runs in runbook log (date, count, outcome).
- Update saved view in Orders Hub to reflect any recovered orders.
- Trigger `ComputeSla` Temporal workflow if >25 records replayed to refresh heatmap.
