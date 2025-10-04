import { createLogger } from '@haizel/observability';

const logger = createLogger('worker.activities.locks');

export interface LockTimerPayload {
  lockId: string;
  tenantId: string;
  loanId: string;
  expiresAt: string;
}

export async function scheduleLockExpiry(payload: LockTimerPayload) {
  logger.info({ ...payload, event: 'lock.timer.schedule' }, 'Scheduling lock expiry timer');
}

export async function emitLockAlert(payload: LockTimerPayload & { window: 'T-72' | 'T-48' | 'T-24' }) {
  logger.warn({ ...payload, event: 'lock.timer.alert' }, 'Lock approaching expiration');
}

export async function markLockExpired(payload: LockTimerPayload) {
  logger.info({ ...payload, event: 'lock.timer.expired' }, 'Marking lock expired');
}
