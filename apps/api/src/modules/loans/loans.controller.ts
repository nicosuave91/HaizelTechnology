import { Controller, Get, Req, Res } from '@nestjs/common';
import { LoansService } from './loans.service.js';
import { FastifyReply, FastifyRequest } from 'fastify';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  async list(
    @Req() request: FastifyRequest & { tenant: any },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const loans = await this.loansService.listLatest(request.tenant.tenantId);
    reply.header('x-tenant-id', request.tenant.tenantId);
    return { data: loans };
  }
}
