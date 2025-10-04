import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { TasksService } from './tasks.service.js';
import { TaskState } from '@prisma/client';
import {
  QueueListResponse,
  RouteTaskRequest,
  RouteTaskResponse,
  TaskBulkUpdateRequest,
  TaskListResponse,
  TaskResponse,
} from './dto/task.dto.js';

interface TenantRequest extends FastifyRequest {
  tenant: { tenantId: string };
}

@Controller('v1')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('tasks')
  async listTasks(
    @Req() request: TenantRequest,
    @Query('state') state?: string,
    @Query('queueKey') queueKey?: string,
    @Query('ownerUserId') ownerUserId?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ): Promise<TaskListResponse> {
    const tenantId = request.tenant.tenantId;
    const filters = {
      state: state ? (state.toUpperCase() as TaskState) : undefined,
      queueKey,
      ownerUserId,
      page: Number(page),
      pageSize: Number(pageSize),
    };
    return this.tasksService.listTasks(tenantId, filters);
  }

  @Post('tasks')
  async bulkUpdate(
    @Req() request: TenantRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: TaskBulkUpdateRequest,
  ): Promise<{ accepted: number }> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.tasksService.bulkUpdate(request.tenant.tenantId, idempotencyKey, body);
  }

  @Post('tasks/:id/start')
  async startTask(
    @Req() request: TenantRequest,
    @Param('id') id: string,
  ): Promise<TaskResponse> {
    return this.tasksService.transitionTask(request.tenant.tenantId, id, TaskState.IN_PROGRESS, undefined);
  }

  @Post('tasks/:id/block')
  async blockTask(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() body: { reason: string; metadata?: Record<string, unknown> },
  ): Promise<TaskResponse> {
    const metadata = { ...(body.metadata ?? {}), reason: body.reason };
    return this.tasksService.transitionTask(request.tenant.tenantId, id, TaskState.BLOCKED, metadata);
  }

  @Post('tasks/:id/complete')
  async completeTask(
    @Req() request: TenantRequest,
    @Param('id') id: string,
  ): Promise<TaskResponse> {
    return this.tasksService.transitionTask(request.tenant.tenantId, id, TaskState.DONE, undefined);
  }

  @Get('queues')
  async listQueues(@Req() request: TenantRequest): Promise<QueueListResponse> {
    return this.tasksService.listQueues(request.tenant.tenantId);
  }

  @Post('queues/route')
  async route(
    @Req() request: TenantRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: RouteTaskRequest,
  ): Promise<RouteTaskResponse> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.tasksService.routeTask(request.tenant.tenantId, idempotencyKey, body);
  }
}
