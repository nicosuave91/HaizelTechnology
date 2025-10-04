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
  userId: string;
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

export type VendorCategory =
  | 'credit'
  | 'aus'
  | 'appraisal'
  | 'disclosure'
  | 'document'
  | 'data'
  | 'other';

export interface VendorDefinition {
  id: string;
  category: VendorCategory;
  name: string;
  slug?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VendorAccountRef {
  id: string;
  tenantId: string;
  vendorId: string;
  sandbox: boolean;
  status: string;
  credentialsRef: string;
  metadata?: Record<string, unknown>;
  lastValidatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type VendorServiceName =
  | 'credit'
  | 'aus'
  | 'appraisal'
  | 'edisclosure'
  | 'flood'
  | 'fraud'
  | string;

export interface VendorRequestLedgerEntry {
  id: string;
  tenantId: string;
  vendorId: string;
  vendorAccountId?: string;
  loanId?: string;
  actorId?: string;
  service: VendorServiceName;
  idempotencyKey: string;
  externalId?: string;
  payloadDigest?: string;
  payloadUri?: string;
  headers?: Record<string, unknown>;
  sentAt?: string;
  completedAt?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorResponseLedgerEntry {
  id: string;
  requestId: string;
  status: string;
  payloadUri?: string;
  errorCode?: string;
  errorMessage?: string;
  receivedAt: string;
  latencyMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookLedgerEntry {
  id: string;
  tenantId: string;
  vendorId: string;
  requestId?: string;
  topic: string;
  receivedSig: string;
  signatureDigest: string;
  payloadUri?: string;
  receivedAt: string;
  verified: boolean;
  replayed: boolean;
  createdAt: string;
  updatedAt: string;
}
