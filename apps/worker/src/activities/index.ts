import { createLogger } from '@haizel/observability';
import { emitLockAlert, markLockExpired, scheduleLockExpiry } from './lock.activities.js';

const logger = createLogger('worker.activities');

export async function emitLoanCreated(loanId: string) {
  logger.info({ loanId, event: 'loan.created.workflow' }, 'Emitting workflow event');
}

export { scheduleLockExpiry, emitLockAlert, markLockExpired };
