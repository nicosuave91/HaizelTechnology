import { proxyActivities, sleep } from '@temporalio/workflow';
import type { LockTimerPayload } from '../activities/lock.activities.js';

const { scheduleLockExpiry, emitLockAlert, markLockExpired } = proxyActivities<{
  scheduleLockExpiry(payload: LockTimerPayload): Promise<void>;
  emitLockAlert(payload: LockTimerPayload & { window: 'T-72' | 'T-48' | 'T-24' }): Promise<void>;
  markLockExpired(payload: LockTimerPayload): Promise<void>;
}>({
  startToCloseTimeout: '5 minutes',
});

export interface LockTimerWorkflowInput extends LockTimerPayload {}

const HOURS = { 'T-72': 72, 'T-48': 48, 'T-24': 24 } as const;

export async function LockTimerWorkflow(input: LockTimerWorkflowInput) {
  await scheduleLockExpiry(input);
  const expiry = new Date(input.expiresAt).getTime();

  for (const window of ['T-72', 'T-48', 'T-24'] as const) {
    const msUntil = expiry - Date.now() - HOURS[window] * 60 * 60 * 1000;
    if (msUntil > 0) {
      await sleep(msUntil);
      await emitLockAlert({ ...input, window });
    }
  }

  const msToExpiry = expiry - Date.now();
  if (msToExpiry > 0) {
    await sleep(msToExpiry);
  }

  await markLockExpired(input);
}
