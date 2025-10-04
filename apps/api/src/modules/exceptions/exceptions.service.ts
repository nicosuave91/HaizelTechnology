import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { addDays, parseISO } from 'date-fns';
import { PrismaService } from '../../common/prisma.service.js';
import { AuditTrailService } from '../../common/audit-trail.service.js';
import {
  ExceptionAuditEntryDto,
  ExceptionCreateRequestDto,
  ExceptionDecisionRequestDto,
  ExceptionResponseDto,
  ExceptionScopeEnum,
  ExceptionTypeEnum,
} from './dto/exception.dto.js';

type ExceptionRecord = {
  id: string;
  loanId: string;
  ruleCode: string;
  pricingCode: string | null;
  type: string;
  justification: string;
  requestedBy: string;
  approverUserId: string | null;
  status: string;
  scope: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  auditTrail: ExceptionAuditEntryDto[] | null;
};

@Injectable()
export class ExceptionsService {
  constructor(private readonly prisma: PrismaService, private readonly auditTrail: AuditTrailService) {}

  private format(record: ExceptionRecord): ExceptionResponseDto {
    return {
      id: record.id,
      loanId: record.loanId,
      ruleCode: record.ruleCode,
      pricingCode: record.pricingCode,
      type: record.type,
      status: record.status,
      scope: record.scope,
      justification: record.justification,
      requestedBy: record.requestedBy,
      approverUserId: record.approverUserId,
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      auditTrail: record.auditTrail ?? [],
    };
  }

  async create(tenantId: string, loanId: string, userId: string, payload: ExceptionCreateRequestDto) {
    const auditTrail: ExceptionAuditEntryDto[] = [
      { action: 'requested', actor: userId, at: new Date().toISOString(), justification: payload.justification },
    ];

    const expiresAt = payload.expiresAt ? parseISO(payload.expiresAt) : addDays(new Date(), 30);
    const record = (await this.prisma.exception.create({
      data: {
        tenantId,
        loanId,
        ruleCode: payload.ruleCode,
        pricingCode: payload.pricingCode,
        type: payload.type,
        justification: payload.justification,
        requestedBy: userId,
        approverUserId: null,
        status: 'pending',
        scope: payload.scope ?? ExceptionScopeEnum.loan,
        expiresAt,
        auditTrail,
      },
    })) as ExceptionRecord;

    await this.auditTrail.recordEvent({
      tenantId,
      loanId,
      type: 'exception.requested',
      actor: userId,
      payload: { exceptionId: record.id, ruleCode: payload.ruleCode },
      governanceTags: ['exceptions'],
    });

    return this.format(record);
  }

  async approve(tenantId: string, userId: string, scopes: string[], id: string, payload: ExceptionDecisionRequestDto) {
    if (!scopes.includes('exceptions:approve')) {
      throw new ForbiddenException({ message: 'Approval requires exception.approver role', code: 'EXCEPTION_APPROVAL_FORBIDDEN' });
    }

    const record = (await this.prisma.exception.findFirst({ where: { id, tenantId } })) as ExceptionRecord | null;
    if (!record) {
      throw new NotFoundException({ message: 'Exception not found', code: 'EXCEPTION_NOT_FOUND' });
    }

    if (record.status !== 'pending') {
      return this.format(record);
    }

    const auditTrail: ExceptionAuditEntryDto[] = [
      ...(Array.isArray(record.auditTrail) ? record.auditTrail : []),
      { action: 'approved', actor: userId, at: new Date().toISOString(), justification: payload.justification },
    ];

    const updated = (await this.prisma.exception.update({
      where: { id },
      data: {
        status: 'approved',
        approverUserId: userId,
        auditTrail,
      },
    })) as ExceptionRecord;

    await this.auditTrail.recordEvent({
      tenantId,
      loanId: updated.loanId,
      type: 'exception.approved',
      actor: userId,
      payload: { exceptionId: id },
      governanceTags: ['exceptions'],
    });

    return this.format(updated);
  }

  async deny(tenantId: string, userId: string, scopes: string[], id: string, payload: ExceptionDecisionRequestDto) {
    if (!scopes.includes('exceptions:approve')) {
      throw new ForbiddenException({ message: 'Denial requires exception.approver role', code: 'EXCEPTION_DENIAL_FORBIDDEN' });
    }

    const record = (await this.prisma.exception.findFirst({ where: { id, tenantId } })) as ExceptionRecord | null;
    if (!record) {
      throw new NotFoundException({ message: 'Exception not found', code: 'EXCEPTION_NOT_FOUND' });
    }

    if (record.status !== 'pending') {
      return this.format(record);
    }

    const auditTrail: ExceptionAuditEntryDto[] = [
      ...(Array.isArray(record.auditTrail) ? record.auditTrail : []),
      { action: 'denied', actor: userId, at: new Date().toISOString(), justification: payload.justification },
    ];

    const updated = (await this.prisma.exception.update({
      where: { id },
      data: {
        status: 'denied',
        approverUserId: userId,
        auditTrail,
      },
    })) as ExceptionRecord;

    await this.auditTrail.recordEvent({
      tenantId,
      loanId: updated.loanId,
      type: 'exception.denied',
      actor: userId,
      payload: { exceptionId: id },
      governanceTags: ['exceptions'],
    });

    return this.format(updated);
  }

  async list(tenantId: string, status?: string) {
    const records = (await this.prisma.exception.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })) as ExceptionRecord[];

    return { data: records.map((record) => this.format(record)) };
  }
}
