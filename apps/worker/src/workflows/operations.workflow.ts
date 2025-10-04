import { proxyActivities } from '@temporalio/workflow';

const activities = proxyActivities({
  startToCloseTimeout: '2 minutes',
});

type Activities = {
  routeTaskActivity: (input: { tenantId: string; taskId: string; skills?: string[] }) => Promise<void>;
  computeSlaActivity: (input: { tenantId: string; scope: 'tasks' | 'orders' }) => Promise<void>;
  submitOrderActivity: (input: { tenantId: string; orderId: string; vendorId: string }) => Promise<void>;
  pollVendorStatusActivity: (input: { tenantId: string; vendorRequestId: string }) => Promise<void>;
  handleWebhookActivity: (input: { tenantId: string; webhookId: string }) => Promise<void>;
  retryWithBackoffActivity: (input: { tenantId: string; referenceId: string; attempt: number }) => Promise<void>;
  moveToDlqActivity: (input: { tenantId?: string | null; source: string; refId?: string | null }) => Promise<void>;
  replayFromDlqActivity: (input: { tenantId?: string | null; dlqId: string }) => Promise<void>;
};

const {
  routeTaskActivity,
  computeSlaActivity,
  submitOrderActivity,
  pollVendorStatusActivity,
  handleWebhookActivity,
  retryWithBackoffActivity,
  moveToDlqActivity,
  replayFromDlqActivity,
} = activities as Activities;

export async function TaskRoutingWorkflow(input: { tenantId: string; taskId: string; skills?: string[] }) {
  await routeTaskActivity(input);
}

export async function SlaAggregationWorkflow(input: { tenantId: string; scope: 'tasks' | 'orders' }) {
  await computeSlaActivity(input);
}

export async function OrderSubmissionWorkflow(input: { tenantId: string; orderId: string; vendorId: string }) {
  await submitOrderActivity(input);
  await retryWithBackoffActivity({ tenantId: input.tenantId, referenceId: input.orderId, attempt: 1 });
}

export async function VendorRecoveryWorkflow(input: { tenantId: string; vendorRequestId: string }) {
  await pollVendorStatusActivity(input);
}

export async function WebhookProcessingWorkflow(input: { tenantId: string; webhookId: string }) {
  await handleWebhookActivity(input);
}

export async function DlqWorkflow(input: { tenantId?: string | null; dlqId: string; source: string }) {
  await moveToDlqActivity({ tenantId: input.tenantId, source: input.source, refId: input.dlqId });
}

export async function DlqReplayWorkflow(input: { tenantId?: string | null; dlqId: string }) {
  await replayFromDlqActivity(input);
}
