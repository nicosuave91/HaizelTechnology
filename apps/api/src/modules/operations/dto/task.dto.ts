export interface TaskResponse {
  id: string;
  loanId?: string | null;
  ownerUserId?: string | null;
  queueKey: string;
  type: string;
  state: 'NEW' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  priority: number;
  dueAt?: string | null;
  slaDueAt?: string | null;
  tags: string[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListResponse {
  data: TaskResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface TaskBulkUpdateRequest {
  taskIds: string[];
  updates: {
    ownerUserId?: string | null;
    dueAt?: string | null;
    tags?: string[];
    priority?: number;
  };
}

export interface QueueDefinitionResponse {
  key: string;
  name: string;
  skills: string[];
  routing: Record<string, unknown>;
  aggregates: {
    total: number;
    new: number;
    inProgress: number;
    blocked: number;
    overdue: number;
  };
}

export interface QueueListResponse {
  data: QueueDefinitionResponse[];
  updatedAt: string;
}

export interface RouteTaskRequest {
  taskId: string;
  preferredQueues?: string[];
  skills?: string[];
}

export interface RouteTaskResponse {
  queueKey: string;
  ownerUserId?: string | null;
}
