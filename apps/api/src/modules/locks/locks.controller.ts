import { Body, Controller, Get, Param, Post, Query, Req, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { LocksService } from './locks.service.js';
import { LockCreateRequestDto, LockExtendRequestDto } from './dto/lock.dto.js';

@Controller('locks')
export class LocksController {
  constructor(private readonly locksService: LocksService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() body: LockCreateRequestDto,
    @Req() request: FastifyRequest & { tenant: { tenantId: string; userId: string; scopes: string[] } },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.locksService.createLock(request.tenant.tenantId, request.tenant.userId, body);
    reply.status(201);
    reply.header('x-tenant-id', request.tenant.tenantId);
    return result;
  }

  @Post(':id:extend')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async extend(
    @Param('id') id: string,
    @Body() body: LockExtendRequestDto,
    @Req() request: FastifyRequest & { tenant: { tenantId: string; userId: string; scopes: string[] } },
  ) {
    return this.locksService.extendLock(request.tenant.tenantId, request.tenant.userId, id, body);
  }

  @Post(':id:float-down')
  async floatDown(
    @Param('id') id: string,
    @Req() request: FastifyRequest & { tenant: { tenantId: string; userId: string; scopes: string[] } },
  ) {
    return this.locksService.floatDown(request.tenant.tenantId, request.tenant.userId, request.tenant.scopes, id);
  }

  @Post(':id:void')
  async void(
    @Param('id') id: string,
    @Req() request: FastifyRequest & { tenant: { tenantId: string; userId: string; scopes: string[] } },
  ) {
    return this.locksService.voidLock(request.tenant.tenantId, request.tenant.userId, request.tenant.scopes, id);
  }

  @Get('watchlist')
  async watchlist(
    @Query('lteHours') lteHours: string | undefined,
    @Req() request: FastifyRequest & { tenant: { tenantId: string } },
  ) {
    const hours = Math.min(168, Math.max(1, Number(lteHours ?? 48)));
    return this.locksService.watchlist(request.tenant.tenantId, hours);
  }
}
