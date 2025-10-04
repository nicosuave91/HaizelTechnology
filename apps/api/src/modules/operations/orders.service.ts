import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { createLogger } from '@haizel/observability';
import { trace } from '@opentelemetry/api';
import { DlqEntryStatus, OrderService, OrderStatus } from '@prisma/client';
import {
  DlqEntryResponse,
  OrderBulkRequest,
  OrderCreateRequest,
  OrderListResponse,
  OrderResponse,
  OrderRetryResponse,
} from './dto/order.dto.js';

interface OrderFilters {
  service?: string;
  status?: OrderStatus;
  loanId?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = createLogger('api.orders');
  private readonly tracer = trace.getTracer('api.orders');
  private readonly idempotencyCache = new Map<string, { createdAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async listOrders(tenantId: string, filters: OrderFilters = {}): Promise<OrderListResponse> {
    return await this.tracer.startActiveSpan('orders.list', async (span) => {
      try {
        const where = {
          tenantId,
          service: filters.service ? this.normalizeService(filters.service) : undefined,
          status: filters.status,
          loanId: filters.loanId,
        } satisfies Record<string, unknown>;

        const [total, orders] = await this.prisma.$transaction([
          this.prisma.order.count({ where }),
          this.prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
          }),
        ]);

        const data: OrderResponse[] = orders.map((order) => ({
          id: order.id,
          loanId: order.loanId,
          service: this.presentService(order.service),
          status: order.status,
          vendorId: order.vendorId,
          vendorAccountId: order.vendorAccountId,
          slaDueAt: order.slaDueAt?.toISOString() ?? null,
          cost: order.cost ? Number(order.cost) : null,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
        }));

        span.setAttributes({ 'app.orders.total': total });
        return { data, total } satisfies OrderListResponse;
      } finally {
        span.end();
      }
    });
  }

  async createOrder(
    tenantId: string,
    idempotencyKey: string,
    payload: OrderCreateRequest,
  ): Promise<OrderResponse> {
    return await this.tracer.startActiveSpan('orders.create', async (span) => {
      try {
        if (this.hasSeenIdempotencyKey(idempotencyKey)) {
          const existing = await this.prisma.order.findFirst({
            where: { tenantId, loanId: payload.loanId, service: this.normalizeService(payload.service) },
            orderBy: { createdAt: 'desc' },
          });
          if (existing) {
            return this.mapOrder(existing);
          }
        }

        const vendorId = payload.vendorId ?? (await this.ensureDefaultVendor(tenantId));
        const service = this.normalizeService(payload.service);
        const order = await this.prisma.order.create({
          data: {
            tenantId,
            loanId: payload.loanId,
            service,
            status: OrderStatus.SUBMITTED,
            vendorId,
            metadata: payload.metadata ?? undefined,
            requestJson: payload.metadata ?? undefined,
          },
        });

        await this.prisma.vendorRequest.create({
          data: {
            tenantId,
            orderId: order.id,
            vendorId,
            service,
            status: OrderStatus.SUBMITTED,
            correlationId: crypto.randomUUID(),
          },
        });

        this.idempotencyCache.set(idempotencyKey, { createdAt: Date.now() });
        this.logger.info({ tenantId, orderId: order.id }, 'Order created');
        return this.mapOrder(order);
      } finally {
        span.end();
      }
    });
  }

  async bulkCreate(
    tenantId: string,
    idempotencyKey: string,
    payload: OrderBulkRequest,
  ): Promise<{ accepted: number }> {
    return await this.tracer.startActiveSpan('orders.bulk', async (span) => {
      try {
        if (this.hasSeenIdempotencyKey(idempotencyKey)) {
          return { accepted: 0 };
        }

        const vendorId = await this.ensureDefaultVendor(tenantId);
        const orders = await this.prisma.$transaction(
          payload.loanIds.map((loanId) =>
            this.prisma.order.create({
              data: {
                tenantId,
                loanId,
                service: OrderService.FLOOD,
                status: OrderStatus.SUBMITTED,
                vendorId,
              },
            }),
          ),
        );
        this.idempotencyCache.set(idempotencyKey, { createdAt: Date.now() });
        this.logger.info({ tenantId, count: orders.length }, 'Bulk flood orders created');
        span.setAttribute('app.orders.bulk.count', orders.length);
        return { accepted: orders.length };
      } finally {
        span.end();
      }
    });
  }

  async retryOrder(
    tenantId: string,
    idempotencyKey: string,
    orderId: string,
  ): Promise<OrderRetryResponse> {
    return await this.tracer.startActiveSpan('orders.retry', async (span) => {
      try {
        if (this.hasSeenIdempotencyKey(idempotencyKey)) {
          return {
            id: orderId,
            attempt: 0,
            scheduledAt: new Date().toISOString(),
          };
        }

        const existing = await this.prisma.order.update({
          where: { id: orderId, tenantId },
          data: {
            status: OrderStatus.SUBMITTED,
            updatedAt: new Date(),
          },
        });

        const correlationId = crypto.randomUUID();
        const vendorId = existing.vendorId ?? (await this.ensureDefaultVendor(tenantId));
        await this.prisma.vendorRequest.create({
          data: {
            tenantId,
            orderId: existing.id,
            vendorId,
            service: existing.service,
            status: OrderStatus.SUBMITTED,
            correlationId,
            attempt: 1,
          },
        });

        this.idempotencyCache.set(idempotencyKey, { createdAt: Date.now() });
        const scheduledAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        return { id: existing.id, attempt: 1, scheduledAt };
      } finally {
        span.end();
      }
    });
  }

  async listDlq(tenantId: string, status?: DlqEntryStatus): Promise<DlqEntryResponse[]> {
    return await this.tracer.startActiveSpan('dlq.list', async (span) => {
      try {
        const entries = await this.prisma.dlqEntry.findMany({
          where: { tenantId, status: status ?? undefined },
          orderBy: { firstSeenAt: 'desc' },
        });

        return entries.map((entry) => ({
          id: entry.id,
          source: entry.source,
          refId: entry.refId,
          reasonCode: entry.reasonCode,
          attempts: entry.attempts,
          status: entry.status,
          firstSeenAt: entry.firstSeenAt.toISOString(),
          lastSeenAt: entry.lastSeenAt.toISOString(),
        }));
      } finally {
        span.end();
      }
    });
  }

  async replayDlq(
    tenantId: string,
    idempotencyKey: string,
    dlqId: string,
  ): Promise<DlqEntryResponse> {
    return await this.tracer.startActiveSpan('dlq.replay', async (span) => {
      try {
        if (this.hasSeenIdempotencyKey(idempotencyKey)) {
          const entry = await this.prisma.dlqEntry.findUnique({ where: { id: dlqId } });
          if (!entry) {
            throw new Error('DLQ entry not found');
          }
          return this.mapDlq(entry);
        }

        const updated = await this.prisma.dlqEntry.update({
          where: { id: dlqId, tenantId },
          data: {
            status: DlqEntryStatus.REPLAYED,
            replayedAt: new Date(),
            lastSeenAt: new Date(),
          },
        });

        this.idempotencyCache.set(idempotencyKey, { createdAt: Date.now() });
        this.logger.info({ tenantId, dlqId }, 'DLQ entry replay requested');
        return this.mapDlq(updated);
      } finally {
        span.end();
      }
    });
  }

  private mapOrder(order: { [key: string]: any }): OrderResponse {
    return {
      id: order.id,
      loanId: order.loanId,
      service: this.presentService(order.service),
      status: order.status,
      vendorId: order.vendorId,
      vendorAccountId: order.vendorAccountId,
      slaDueAt: order.slaDueAt ? order.slaDueAt.toISOString() : null,
      cost: order.cost ? Number(order.cost) : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private mapDlq(entry: { [key: string]: any }): DlqEntryResponse {
    return {
      id: entry.id,
      source: entry.source,
      refId: entry.refId,
      reasonCode: entry.reasonCode,
      attempts: entry.attempts,
      status: entry.status,
      firstSeenAt: entry.firstSeenAt.toISOString(),
      lastSeenAt: entry.lastSeenAt.toISOString(),
    };
  }

  private hasSeenIdempotencyKey(key: string): boolean {
    const record = this.idempotencyCache.get(key);
    if (!record) {
      return false;
    }

    if (Date.now() - record.createdAt > 60 * 60 * 1000) {
      this.idempotencyCache.delete(key);
      return false;
    }

    return true;
  }

  private async ensureDefaultVendor(tenantId: string): Promise<string> {
    let vendor = await this.prisma.vendor.findFirst({ where: { tenantId } });
    if (!vendor) {
      vendor = await this.prisma.vendor.create({
        data: {
          tenantId,
          slug: 'default',
          name: 'Default Vendor',
          services: [
            OrderService.APPRAISAL,
            OrderService.TITLE,
            OrderService.FLOOD,
            OrderService.MI,
            OrderService.SSA89,
            OrderService.IRS4506C,
          ],
        },
      });
    }

    return vendor.id;
  }

  private normalizeService(service: OrderCreateRequest['service'] | string): OrderService {
    if (service === '4506-C') {
      return OrderService.IRS4506C;
    }
    const key = service as keyof typeof OrderService;
    return OrderService[key];
  }

  private presentService(service: OrderService): OrderResponse['service'] {
    if (service === OrderService.IRS4506C) {
      return '4506-C';
    }
    return service as OrderResponse['service'];
  }
}
