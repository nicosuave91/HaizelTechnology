export type TenantRole = 'loan_officer' | 'processor' | 'admin';

export interface TenantContext {
  tenantId: string;
  userId?: string;
  scopes: string[];
}

export interface ProblemJson {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  traceId?: string;
}

export interface LoanSummary {
  id: string;
  tenantId: string;
  loanNumber: string;
  status: string;
  amount: string;
  borrowerName: string;
  updatedAt: string;
}

export interface FeatureFlagEvaluationContext {
  tenantId: string;
  userId?: string;
  flag: string;
}
