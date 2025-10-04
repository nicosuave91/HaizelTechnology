import { BadRequestException, Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';
import { FastifyRequest } from 'fastify';

interface TenantRequest extends FastifyRequest {
  tenant: { tenantId: string };
}

@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post(':vendor')
  async ingest(
    @Req() request: TenantRequest,
    @Param('vendor') vendor: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Headers('x-signature') signature: string,
    @Body() body: Record<string, unknown>,
  ): Promise<{ id: string; signatureValid: boolean }> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (!signature) {
      throw new BadRequestException('X-Signature header is required');
    }

    const headers = Object.entries(request.headers).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = Array.isArray(value) ? value.join(',') : String(value);
      return acc;
    }, {});

    return this.webhooksService.ingest(request.tenant.tenantId, vendor, idempotencyKey, signature, body, headers);
  }
}
