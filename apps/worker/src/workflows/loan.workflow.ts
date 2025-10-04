import { proxyActivities } from '@temporalio/workflow';

const { emitLoanCreated } = proxyActivities<{ emitLoanCreated: (loanId: string) => Promise<void> }>({
  startToCloseTimeout: '1 minute',
});

export async function LoanWorkflow(loanId: string) {
  await emitLoanCreated(loanId);
}
