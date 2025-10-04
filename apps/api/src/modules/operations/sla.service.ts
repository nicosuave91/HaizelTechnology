import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { trace } from '@opentelemetry/api';
import { createLogger } from '@haizel/observability';
import { TaskState } from '@prisma/client';
import { SlaHeatmapResponse } from './dto/sla.dto.js';

@Injectable()
export class SlaService {
  private readonly tracer = trace.getTracer('api.sla');
  private readonly logger = createLogger('api.sla');

  constructor(private readonly prisma: PrismaService) {}

  async getHeatmap(
    tenantId: string,
    scope: 'tasks' | 'orders',
    range: 'week' | 'month',
  ): Promise<SlaHeatmapResponse> {
    return await this.tracer.startActiveSpan('sla.heatmap', async (span) => {
      try {
        const days = range === 'month' ? 30 : 7;
        const now = new Date();
        const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const buckets = new Map<string, { total: number; warning: number; overdue: number }>();

        if (scope === 'tasks') {
          const tasks = await this.prisma.task.findMany({
            where: {
              tenantId,
              slaDueAt: { gte: start },
              NOT: { state: TaskState.DONE },
            },
            select: { id: true, slaDueAt: true, state: true },
          });

          for (const task of tasks) {
            if (!task.slaDueAt) continue;
            const bucketKey = this.toBucket(task.slaDueAt);
            const bucket = buckets.get(bucketKey) ?? { total: 0, warning: 0, overdue: 0 };
            bucket.total += 1;
            if (task.slaDueAt.getTime() < now.getTime()) {
              bucket.overdue += 1;
            } else if (task.slaDueAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
              bucket.warning += 1;
            }
            buckets.set(bucketKey, bucket);
          }
        } else {
          const orders = await this.prisma.order.findMany({
            where: {
              tenantId,
              slaDueAt: { gte: start },
            },
            select: { id: true, slaDueAt: true, status: true },
          });

          for (const order of orders) {
            if (!order.slaDueAt) continue;
            const bucketKey = this.toBucket(order.slaDueAt);
            const bucket = buckets.get(bucketKey) ?? { total: 0, warning: 0, overdue: 0 };
            bucket.total += 1;
            if (order.slaDueAt.getTime() < now.getTime()) {
              bucket.overdue += 1;
            } else if (order.slaDueAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
              bucket.warning += 1;
            }
            buckets.set(bucketKey, bucket);
          }
        }

        const cells = Array.from(buckets.entries())
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([bucket, value]) => ({
            bucket,
            total: value.total,
            warning: value.warning,
            overdue: value.overdue,
            query: `scope=${scope}&bucket=${encodeURIComponent(bucket)}`,
          }));

        this.logger.info({ tenantId, scope, buckets: cells.length }, 'Computed SLA heatmap');
        return { scope, range, cells, atRisk: cells.filter((cell) => cell.overdue > 0).map((cell) => cell.bucket) };
      } finally {
        span.end();
      }
    });
  }

  private toBucket(input: Date): string {
    const clone = new Date(input);
    clone.setMinutes(0, 0, 0);
    return clone.toISOString();
  }
}
