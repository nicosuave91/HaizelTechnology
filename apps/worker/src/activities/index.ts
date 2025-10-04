import { createLogger } from '@haizel/observability';

const logger = createLogger('worker.activities');

export async function emitLoanCreated(loanId: string) {
  logger.info({ loanId, event: 'loan.created.workflow' }, 'Emitting workflow event');
}
