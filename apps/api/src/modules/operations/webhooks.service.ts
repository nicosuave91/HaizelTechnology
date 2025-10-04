import crypto from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { createLogger } from '@haizel/observability';
import { trace } from '@opentelemetry/api';

interface WebhookIngestResponse {
  id: string;
  signatureValid: boolean;
}

@Injectable()
export class WebhooksService {
  private readonly logger = createLogger('api.webhooks');
  private readonly tracer = trace.getTracer('api.webhooks');
  private readonly idempotencyCache = new Map<string, { createdAt: number; webhookId: string }>();

  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    tenantId: string,
    vendorSlug: string,
    idempotencyKey: string,
    signature: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookIngestResponse> {
    return await this.tracer.startActiveSpan('webhooks.ingest', async (span) => {
      try {
        const cached = this.idempotencyCache.get(idempotencyKey);
        if (cached) {
          return { id: cached.webhookId, signatureValid: true };
        }

        const vendor = await this.prisma.vendor.findFirst({
          where: {
            OR: [{ tenantId, slug: vendorSlug }, { tenantId: null, slug: vendorSlug }],
          },
        });

        if (!vendor) {
          throw new NotFoundException('Vendor not found');
        }

        const expectedSignature = this.calculateSignature(vendor.id, payload);
        if (!signature) {
          throw new BadRequestException('Missing signature header');
        }

        const signatureValid = this.safeCompare(signature, expectedSignature);

        const webhook = await this.prisma.webhook.create({
          data: {
            tenantId,
            vendorId: vendor.id,
            signature,
            signatureValid,
            payloadJson: payload,
            headersJson: headers,
            status: 'received',
          },
        });

        this.idempotencyCache.set(idempotencyKey, { createdAt: Date.now(), webhookId: webhook.id });
        this.logger.info({ tenantId, vendor: vendor.slug, webhookId: webhook.id, signatureValid }, 'Webhook ingested');
        return { id: webhook.id, signatureValid };
      } finally {
        span.end();
      }
    });
  }

  private calculateSignature(vendorId: string, payload: Record<string, unknown>): string {
    return crypto.createHmac('sha256', vendorId).update(JSON.stringify(payload)).digest('hex');
  }

  private safeCompare(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    if (aBuffer.length !== bBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer);
  }
}
