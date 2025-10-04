import { Body, Controller, Post, Req, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PricingService } from './pricing.service.js';
import { PricingQuoteRequestDto } from './dto/quote.dto.js';

@Controller({ path: 'pricing' })
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('quotes')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async quote(
    @Body() body: PricingQuoteRequestDto,
    @Req() request: FastifyRequest & { tenant: { tenantId: string; userId: string } },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const tenantId = request.tenant.tenantId;
    const actor = request.tenant.userId;
    const response = await this.pricingService.quote(tenantId, body, actor);
    reply.status(200);
    reply.header('x-tenant-id', tenantId);
    return response;
  }
}
