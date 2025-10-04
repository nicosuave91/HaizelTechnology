import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import { SlaService } from './sla.service.js';
import { SlaHeatmapResponse } from './dto/sla.dto.js';
import { FastifyRequest } from 'fastify';

interface TenantRequest extends FastifyRequest {
  tenant: { tenantId: string };
}

@Controller('v1/sla')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('heatmap')
  async getHeatmap(
    @Req() request: TenantRequest,
    @Query('scope') scope: 'tasks' | 'orders',
    @Query('range') range: 'week' | 'month' = 'week',
  ): Promise<SlaHeatmapResponse> {
    if (!scope) {
      throw new BadRequestException('scope query parameter is required');
    }
    return this.slaService.getHeatmap(request.tenant.tenantId, scope, range);
  }
}
