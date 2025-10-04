import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { addHours, addDays } from 'date-fns';
import { PrismaService } from '../../common/prisma.service.js';
import { AuditTrailService } from '../../common/audit-trail.service.js';
import { LockCreateRequestDto, LockExtendRequestDto, LockResourceDto } from './dto/lock.dto.js';

interface LockActionEntry {
  type: string;
  actor: string | null;
  occurredAt: string;
  details?: Record<string, any>;
}

type RateLockRecord = {
  id: string;
  loanId: string;
  tenantId: string;
  status: string;
  lockedAt: Date | null;
  expiresAt: Date;
  lockPeriodDays: number;
  productRef: string;
  rate: number | string;
  price: number | string;
  actions: LockActionEntry[] | null;
};

@Injectable()
export class LocksService {
  constructor(private readonly prisma: PrismaService, private readonly auditTrail: AuditTrailService) {}

  private format(lock: RateLockRecord): LockResourceDto {
    return {
      id: lock.id,
      loanId: lock.loanId,
      status: lock.status,
      lockedAt: lock.lockedAt?.toISOString?.() ?? null,
      expiresAt: lock.expiresAt.toISOString(),
      lockPeriodDays: lock.lockPeriodDays,
      productRef: lock.productRef,
      rate: Number(lock.rate),
      price: Number(lock.price),
      actions: Array.isArray(lock.actions) ? lock.actions : [],
    };
  }

  private appendAction(lock: Pick<RateLockRecord, 'actions'>, action: LockActionEntry): LockActionEntry[] {
    const history: LockActionEntry[] = Array.isArray(lock.actions) ? lock.actions : [];
    return [...history, action];
  }

  async createLock(tenantId: string, userId: string, payload: LockCreateRequestDto) {
    const now = new Date();
    const expiresAt = addDays(now, payload.lockPeriodDays);
    const actions = this.appendAction({ actions: [] }, {
      type: 'create',
      actor: userId,
      occurredAt: now.toISOString(),
      details: { lockPeriodDays: payload.lockPeriodDays },
    });

    const lock = (await this.prisma.rateLock.create({
      data: {
        tenantId,
        loanId: payload.loanId,
        status: 'locked',
        lockedAt: now,
        expiresAt,
        lockPeriodDays: payload.lockPeriodDays,
        productRef: payload.productRef,
        rate: payload.rate,
        price: payload.price,
        actions,
        createdBy: userId,
      },
    })) as unknown as RateLockRecord;

    await this.auditTrail.recordEvent({
      tenantId,
      loanId: payload.loanId,
      type: 'lock.created',
      actor: userId,
      payload: { lockId: lock.id, expiresAt },
      governanceTags: ['locks'],
    });

    return this.format(lock);
  }

  async extendLock(tenantId: string, userId: string, lockId: string, payload: LockExtendRequestDto) {
    const lock = (await this.prisma.rateLock.findFirst({ where: { id: lockId, tenantId } })) as
      | (RateLockRecord & { updatedAt: Date })
      | null;
    if (!lock) {
      throw new NotFoundException({ message: 'Lock not found', code: 'LOCK_NOT_FOUND' });
    }

    const newExpiry = addDays(lock.expiresAt, payload.days);
    const actions = this.appendAction(lock, {
      type: 'extend',
      actor: userId,
      occurredAt: new Date().toISOString(),
      details: { days: payload.days, reason: payload.reason },
    });

    const updated = (await this.prisma.rateLock.update({
      where: { id: lockId },
      data: {
        status: 'extended',
        expiresAt: newExpiry,
        actions,
        updatedAt: new Date(),
      },
    })) as unknown as RateLockRecord;

    await this.auditTrail.recordEvent({
      tenantId,
      loanId: updated.loanId,
      type: 'lock.extended',
      actor: userId,
      payload: { lockId, previousExpiry: lock.expiresAt, newExpiry },
      governanceTags: ['locks'],
    });

    return this.format(updated);
  }

  async floatDown(tenantId: string, userId: string, scopes: string[], lockId: string) {
    if (!scopes.includes('locks:float-down')) {
      throw new ForbiddenException({ message: 'Float down requires approval', code: 'LOCK_FLOAT_DOWN_FORBIDDEN' });
    }

    const lock = (await this.prisma.rateLock.findFirst({ where: { id: lockId, tenantId } })) as RateLockRecord | null;
    if (!lock) {
      throw new NotFoundException({ message: 'Lock not found', code: 'LOCK_NOT_FOUND' });
    }

    const newPrice = Number(lock.price) + 0.25;
    const actions = this.appendAction(lock, {
      type: 'float_down',
      actor: userId,
      occurredAt: new Date().toISOString(),
      details: { previousPrice: Number(lock.price), newPrice },
    });

    const updated = (await this.prisma.rateLock.update({
      where: { id: lockId },
      data: {
        status: 'float_down_applied',
        price: newPrice,
        actions,
      },
    })) as unknown as RateLockRecord;

    await this.auditTrail.recordEvent({
      tenantId,
      loanId: updated.loanId,
      type: 'lock.float_down.applied',
      actor: userId,
      payload: { lockId, previousPrice: Number(lock.price), newPrice },
      governanceTags: ['locks'],
    });

    return this.format(updated);
  }

  async voidLock(tenantId: string, userId: string, scopes: string[], lockId: string) {
    if (!scopes.includes('locks:void')) {
      throw new ForbiddenException({ message: 'Void requires authorization', code: 'LOCK_VOID_FORBIDDEN' });
    }

    const lock = (await this.prisma.rateLock.findFirst({ where: { id: lockId, tenantId } })) as RateLockRecord | null;
    if (!lock) {
      throw new NotFoundException({ message: 'Lock not found', code: 'LOCK_NOT_FOUND' });
    }

    const actions = this.appendAction(lock, {
      type: 'void',
      actor: userId,
      occurredAt: new Date().toISOString(),
    });

    const updated = (await this.prisma.rateLock.update({
      where: { id: lockId },
      data: {
        status: 'voided',
        actions,
      },
    })) as unknown as RateLockRecord;

    await this.auditTrail.recordEvent({
      tenantId,
      loanId: updated.loanId,
      type: 'lock.voided',
      actor: userId,
      payload: { lockId },
      governanceTags: ['locks'],
    });

    return this.format(updated);
  }

  async watchlist(tenantId: string, hours: number): Promise<{ data: LockResourceDto[] }> {
    const now = new Date();
    const horizon = addHours(now, hours);
    const locks = (await this.prisma.rateLock.findMany({
      where: {
        tenantId,
        status: { in: ['locked', 'extended'] },
        expiresAt: { lte: horizon },
      },
      orderBy: { expiresAt: 'asc' },
    })) as unknown as RateLockRecord[];

    return { data: locks.map((lock) => this.format(lock)) };
  }
}
