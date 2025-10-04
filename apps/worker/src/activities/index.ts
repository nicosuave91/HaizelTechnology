import { createLogger } from '@haizel/observability';
import { emitLockAlert, markLockExpired, scheduleLockExpiry } from './lock.activities.js';

const logger = createLogger('worker.activities');

export async function emitLoanCreated(loanId: string) {
  logger.info({ loanId, event: 'loan.created.workflow' }, 'Emitting workflow event');
}

export async function routeTaskActivity(input: { tenantId: string; taskId: string; skills?: string[] }) {
  logger.info({ ...input, activity: 'RouteTask' }, 'Routing task via Temporal activity');
}

export async function computeSlaActivity(input: { tenantId: string; scope: 'tasks' | 'orders' }) {
  logger.info({ ...input, activity: 'ComputeSla' }, 'Computing SLA heatmap snapshot');
}

export async function submitOrderActivity(input: { tenantId: string; orderId: string; vendorId: string }) {
  logger.info({ ...input, activity: 'SubmitOrder' }, 'Submitting order to vendor');
}

export async function pollVendorStatusActivity(input: { tenantId: string; vendorRequestId: string }) {
  logger.info({ ...input, activity: 'PollVendorStatus' }, 'Polling vendor status');
}

export async function handleWebhookActivity(input: { tenantId: string; webhookId: string }) {
  logger.info({ ...input, activity: 'HandleWebhook' }, 'Handling webhook payload');
}

export async function retryWithBackoffActivity(input: { tenantId: string; referenceId: string; attempt: number }) {
  logger.info({ ...input, activity: 'RetryWithBackoff' }, 'Scheduling retry with backoff');
}

export async function moveToDlqActivity(input: { tenantId?: string | null; source: string; refId?: string | null }) {
  logger.warn({ ...input, activity: 'MoveToDLQ' }, 'Moving message to DLQ');
}

export async function replayFromDlqActivity(input: { tenantId?: string | null; dlqId: string }) {
  logger.info({ ...input, activity: 'ReplayFromDLQ' }, 'Replaying DLQ entry');
}
