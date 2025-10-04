export type OrderServiceType = 'APPRAISAL' | 'TITLE' | 'FLOOD' | 'MI' | 'SSA89' | '4506-C';
export type OrderStatusType = 'DRAFT' | 'SUBMITTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELED';

export interface OrderResponse {
  id: string;
  loanId?: string | null;
  service: OrderServiceType;
  status: OrderStatusType;
  vendorId?: string | null;
  vendorAccountId?: string | null;
  slaDueAt?: string | null;
  cost?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderListResponse {
  data: OrderResponse[];
  total: number;
}

export interface OrderCreateRequest {
  loanId: string;
  service: OrderServiceType;
  vendorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OrderBulkRequest {
  loanIds: string[];
  service: 'FLOOD';
}

export interface OrderRetryResponse {
  id: string;
  attempt: number;
  scheduledAt: string;
}

export interface DlqEntryResponse {
  id: string;
  source: string;
  refId?: string | null;
  reasonCode: string;
  attempts: number;
  status: 'PENDING' | 'REPLAYED' | 'ARCHIVED';
  firstSeenAt: string;
  lastSeenAt: string;
}
