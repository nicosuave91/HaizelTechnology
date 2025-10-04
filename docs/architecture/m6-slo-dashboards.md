# M6 Observability Dashboards

**Last reviewed:** 2024-05-25

## Overview
Dashboards built on top of the existing OTLP streams. Each widget references metrics emitted by new API endpoints and Temporal workers.

### 1. Task Queue Health
- **Chart:** Heatmap of `app.tasks.accepted` per queue (sum) vs `task_events` count.
- **Signals:**
  - p95 `/v1/tasks` latency < 200ms (Fastify route).
  - Count of blocked tasks (`task.state = BLOCKED`) per tenant.
- **Alerts:** Trigger when overdue > 10% for 15 minutes.

### 2. SLA Aggregation
- **Chart:** Gauge for `sla.warning` vs `sla.overdue` derived from `SlaService` metrics.
- **Supporting logs:** `api.sla` logger outputs with `tenant_id` tag.

### 3. Orders Pipeline
- **Chart:** Multi-series area chart showing `orders.submitted`, `orders.completed`, and `orders.failed` per vendor.
- **Metrics:**
  - `app.orders.total` (from list endpoint).
  - Activity timers `worker.activities.SubmitOrder` and `worker.activities.RetryWithBackoff`.
  - DLQ backlog from `dlq_entries` (SQL -> metric via collector).

### 4. Webhook Verification
- **Chart:** Success vs failure ratio for signature validation (`api.webhooks` span attribute `signature.valid`).
- **Logs:** Pino logs with `signatureValid=false` flagged as WARN.
- **Alert:** if failure rate > 1% over 10 minutes.

### 5. Temporal Worker Health
- **Chart:** Workflow runtime for `TaskRoutingWorkflow`, `OrderSubmissionWorkflow`, and `DlqReplayWorkflow`.
- **Metrics:** queue depth, activity retries, DLQ move counts.

## Implementation Notes
- Add metric exporters in worker process to publish counters for `moveToDlqActivity` and `replayFromDlqActivity`.
- Use existing Grafana template with OTEL data source; add folder `Milestone M6`.
- Document SLO thresholds in runbooks referencing these dashboards.
