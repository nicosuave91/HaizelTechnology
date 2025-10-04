import { Body, Controller, Get, Param, Post, Query, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ExceptionsService } from './exceptions.service.js';
import {
  ExceptionCreateRequestDto,
  ExceptionDecisionRequestDto,
  ExceptionResponseDto,
} from './dto/exception.dto.js';

@Controller()
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Post('loans/:id/exceptions')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async requestException(
    @Param('id') loanId: string,
    @Body() body: ExceptionCreateRequestDto,
    @Req() request: FastifyRequest & { tenant: { tenantId: string; userId: string; scopes: string[] } },
  ): Promise<ExceptionResponseDto> {
    return this.exceptionsService.create(request.tenant.tenantId, loanId, request.tenant.userId, body);
  }

  @Post('exceptions/:id:approve')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async approve(
    @Param('id') exceptionId: string,
    @Body() body: ExceptionDecisionRequestDto,
    @Req() request: FastifyRequest & { tenant: { tenantId: string; userId: string; scopes: string[] } },
  ): Promise<ExceptionResponseDto> {
    return this.exceptionsService.approve(
      request.tenant.tenantId,
      request.tenant.userId,
      request.tenant.scopes,
      exceptionId,
      body,
    );
  }

  @Post('exceptions/:id:deny')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async deny(
    @Param('id') exceptionId: string,
    @Body() body: ExceptionDecisionRequestDto,
    @Req() request: FastifyRequest & { tenant: { tenantId: string; userId: string; scopes: string[] } },
  ): Promise<ExceptionResponseDto> {
    return this.exceptionsService.deny(
      request.tenant.tenantId,
      request.tenant.userId,
      request.tenant.scopes,
      exceptionId,
      body,
    );
  }

  @Get('exceptions')
  async list(
    @Query('status') status: string | undefined,
    @Req() request: FastifyRequest & { tenant: { tenantId: string } },
  ): Promise<{ data: ExceptionResponseDto[] }> {
    return this.exceptionsService.list(request.tenant.tenantId, status);
  }
}
