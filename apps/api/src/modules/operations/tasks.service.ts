import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { createLogger } from '@haizel/observability';
import { trace } from '@opentelemetry/api';
import { TaskState } from '@prisma/client';
import {
  QueueDefinitionResponse,
  QueueListResponse,
  RouteTaskRequest,
  RouteTaskResponse,
  TaskBulkUpdateRequest,
  TaskListResponse,
  TaskResponse,
} from './dto/task.dto.js';

interface TaskFilters {
  state?: TaskState;
  queueKey?: string;
  ownerUserId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class TasksService {
  private readonly logger = createLogger('api.tasks');
  private readonly tracer = trace.getTracer('api.tasks');
  private readonly idempotencyCache = new Map<string, { createdAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async listTasks(tenantId: string, filters: TaskFilters = {}): Promise<TaskListResponse> {
    return await this.tracer.startActiveSpan('tasks.list', async (span) => {
      try {
        const page = filters.page ?? 1;
        const pageSize = filters.pageSize ?? 50;
        const where = {
          tenantId,
          state: filters.state,
          queueKey: filters.queueKey,
          ownerUserId: filters.ownerUserId,
        } satisfies Record<string, unknown>;

        const [total, records] = await this.prisma.$transaction([
          this.prisma.task.count({ where }),
          this.prisma.task.findMany({
            where,
            orderBy: { dueAt: 'asc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ]);

        const data: TaskResponse[] = records.map((task) => ({
          id: task.id,
          loanId: task.loanId,
          ownerUserId: task.ownerUserId,
          queueKey: task.queueKey,
          type: task.type,
          state: task.state,
          priority: task.priority,
          dueAt: task.dueAt?.toISOString() ?? null,
          slaDueAt: task.slaDueAt?.toISOString() ?? null,
          tags: task.tags,
          metadata: task.metadata as Record<string, unknown> | null,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        }));

        span.setAttributes({ 'app.pagination.total': total, 'app.pagination.page': page });
        return {
          data,
          pagination: {
            page,
            pageSize,
            total,
          },
        } satisfies TaskListResponse;
      } finally {
        span.end();
      }
    });
  }

  async bulkUpdate(
    tenantId: string,
    idempotencyKey: string,
    payload: TaskBulkUpdateRequest,
  ): Promise<{ accepted: number }> {
    return await this.tracer.startActiveSpan('tasks.bulkUpdate', async (span) => {
      try {
        if (this.hasSeenIdempotencyKey(idempotencyKey)) {
          this.logger.info({ idempotencyKey }, 'Duplicate bulk update ignored');
          return { accepted: 0 };
        }

        const result = await this.prisma.task.updateMany({
          where: {
            tenantId,
            id: { in: payload.taskIds },
          },
          data: {
            ownerUserId: payload.updates.ownerUserId ?? undefined,
            dueAt: payload.updates.dueAt ? new Date(payload.updates.dueAt) : undefined,
            tags: payload.updates.tags ?? undefined,
            priority: payload.updates.priority ?? undefined,
            updatedAt: new Date(),
          },
        });

        this.idempotencyCache.set(idempotencyKey, { createdAt: Date.now() });
        this.logger.info({ tenantId, count: result.count }, 'Tasks bulk update scheduled');
        span.setAttribute('app.tasks.accepted', result.count);
        return { accepted: result.count };
      } finally {
        span.end();
      }
    });
  }

  async transitionTask(
    tenantId: string,
    taskId: string,
    state: TaskState,
    metadata: Record<string, unknown> | undefined,
  ): Promise<TaskResponse> {
    return await this.tracer.startActiveSpan('tasks.transition', async (span) => {
      try {
        const existing = await this.prisma.task.findUniqueOrThrow({
          where: { id: taskId, tenantId },
        });

        const updated = await this.prisma.task.update({
          where: { id: taskId, tenantId },
          data: {
            state,
            metadata: metadata ?? undefined,
            updatedAt: new Date(),
          },
        });

        const previousEvent = await this.prisma.taskEvent.findFirst({
          where: { tenantId, taskId },
          orderBy: { createdAt: 'desc' },
        });

        const hash = crypto
          .createHash('sha256')
          .update(JSON.stringify({ taskId, from: existing.state, to: state, prev: previousEvent?.hash ?? null, metadata }))
          .digest('hex');

        await this.prisma.taskEvent.create({
          data: {
            tenantId,
            taskId,
            eventType: 'state.transition',
            stateFrom: existing.state,
            stateTo: state,
            payload: metadata,
            prevHash: previousEvent?.hash ?? null,
            hash,
          },
        });

        return {
          id: updated.id,
          loanId: updated.loanId,
          ownerUserId: updated.ownerUserId,
          queueKey: updated.queueKey,
          type: updated.type,
          state: updated.state,
          priority: updated.priority,
          dueAt: updated.dueAt?.toISOString() ?? null,
          slaDueAt: updated.slaDueAt?.toISOString() ?? null,
          tags: updated.tags,
          metadata: updated.metadata as Record<string, unknown> | null,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      } finally {
        span.end();
      }
    });
  }

  async listQueues(tenantId: string): Promise<QueueListResponse> {
    return await this.tracer.startActiveSpan('queues.list', async (span) => {
      try {
        const queues = await this.prisma.queueDef.findMany({ where: { tenantId } });
        const tasks = await this.prisma.task.findMany({
          where: { tenantId },
          select: { id: true, queueKey: true, state: true, slaDueAt: true },
        });

        const aggregates = new Map<string, QueueDefinitionResponse>();
        for (const queue of queues) {
          aggregates.set(queue.key, {
            key: queue.key,
            name: queue.name,
            skills: queue.skills,
            routing: queue.routingJson as Record<string, unknown>,
            aggregates: {
              total: 0,
              new: 0,
              inProgress: 0,
              blocked: 0,
              overdue: 0,
            },
          });
        }

        const now = Date.now();
        for (const task of tasks) {
          const bucket = aggregates.get(task.queueKey);
          if (!bucket) continue;
          bucket.aggregates.total += 1;
          if (task.state === 'NEW') bucket.aggregates.new += 1;
          if (task.state === 'IN_PROGRESS') bucket.aggregates.inProgress += 1;
          if (task.state === 'BLOCKED') bucket.aggregates.blocked += 1;
          if (task.slaDueAt && task.slaDueAt.getTime() < now) {
            bucket.aggregates.overdue += 1;
          }
        }

        span.setAttribute('app.queues.count', aggregates.size);
        return { data: Array.from(aggregates.values()), updatedAt: new Date().toISOString() };
      } finally {
        span.end();
      }
    });
  }

  async routeTask(
    tenantId: string,
    idempotencyKey: string,
    payload: RouteTaskRequest,
  ): Promise<RouteTaskResponse> {
    return await this.tracer.startActiveSpan('tasks.route', async (span) => {
      try {
        if (this.hasSeenIdempotencyKey(idempotencyKey)) {
          const existing = await this.prisma.task.findUnique({ where: { id: payload.taskId } });
          if (existing) {
            return { queueKey: existing.queueKey, ownerUserId: existing.ownerUserId };
          }
        }

        const task = await this.prisma.task.update({
          where: { id: payload.taskId, tenantId },
          data: {
            queueKey: payload.preferredQueues?.[0] ?? 'default',
            ownerUserId: null,
          },
        });

        this.idempotencyCache.set(idempotencyKey, { createdAt: Date.now() });
        this.logger.info({ tenantId, taskId: task.id, queueKey: task.queueKey }, 'Task routed');
        return { queueKey: task.queueKey, ownerUserId: task.ownerUserId };
      } finally {
        span.end();
      }
    });
  }

  private hasSeenIdempotencyKey(key: string): boolean {
    const record = this.idempotencyCache.get(key);
    if (!record) {
      return false;
    }

    // expire keys after one hour
    if (Date.now() - record.createdAt > 1000 * 60 * 60) {
      this.idempotencyCache.delete(key);
      return false;
    }

    return true;
  }
}
