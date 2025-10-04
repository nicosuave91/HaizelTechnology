import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { FastifyRequest } from 'fastify';
import { DlqEntryStatus, OrderStatus } from '@prisma/client';
import {
  DlqEntryResponse,
  OrderBulkRequest,
  OrderCreateRequest,
  OrderListResponse,
  OrderResponse,
  OrderRetryResponse,
} from './dto/order.dto.js';

interface TenantRequest extends FastifyRequest {
  tenant: { tenantId: string };
}

@Controller('v1')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('orders')
  async listOrders(
    @Req() request: TenantRequest,
    @Query('service') service?: string,
    @Query('status') status?: string,
    @Query('loanId') loanId?: string,
  ): Promise<OrderListResponse> {
    const filters = {
      service: service ?? undefined,
      status: status ? (status.toUpperCase() as OrderStatus) : undefined,
      loanId,
    };
    return this.ordersService.listOrders(request.tenant.tenantId, filters);
  }

  @Post('orders')
  async createOrder(
    @Req() request: TenantRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: OrderCreateRequest,
  ): Promise<OrderResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.ordersService.createOrder(request.tenant.tenantId, idempotencyKey, body);
  }

  @Post(['orders:bulk', 'orders/bulk'])
  async bulkFlood(
    @Req() request: TenantRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: OrderBulkRequest,
  ): Promise<{ accepted: number }> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.ordersService.bulkCreate(request.tenant.tenantId, idempotencyKey, body);
  }

  @Post(['orders/:id:retry', 'orders/:id/retry'])
  async retryOrder(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string,
  ): Promise<OrderRetryResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.ordersService.retryOrder(request.tenant.tenantId, idempotencyKey, id);
  }

  @Post('loans/:loanId/orders')
  async createOrderForLoan(
    @Req() request: TenantRequest,
    @Param('loanId') loanId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: Omit<OrderCreateRequest, 'loanId'>,
  ): Promise<OrderResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.ordersService.createOrder(request.tenant.tenantId, idempotencyKey, { ...body, loanId });
  }

  @Get('dlq')
  async listDlq(
    @Req() request: TenantRequest,
    @Query('status') status?: string,
  ): Promise<{ data: DlqEntryResponse[] }> {
    const entries = await this.ordersService.listDlq(
      request.tenant.tenantId,
      status ? (status.toUpperCase() as DlqEntryStatus) : undefined,
    );
    return { data: entries };
  }

  @Post(['dlq/:id:replay', 'dlq/:id/replay'])
  async replay(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string,
  ): Promise<DlqEntryResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.ordersService.replayDlq(request.tenant.tenantId, idempotencyKey, id);
  }
}
