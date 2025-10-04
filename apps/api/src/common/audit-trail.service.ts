import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from './prisma.service.js';

interface AuditTrailInput {
  tenantId: string;
  loanId?: string;
  type: string;
  actor?: string;
  source?: string;
  governanceTags?: string[];
  payload: Record<string, any>;
}

@Injectable()
export class AuditTrailService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(input: AuditTrailInput) {
    const prev = await this.prisma.event.findFirst({
      where: { tenantId: input.tenantId },
      orderBy: { occurredAt: 'desc' },
    });

    const prevHash = prev?.hash ?? null;
    const payloadHash = createHash('sha256')
      .update(JSON.stringify({ ...input.payload, prevHash }))
      .digest('hex');

    await this.prisma.event.create({
      data: {
        tenantId: input.tenantId,
        loanId: input.loanId ?? null,
        type: input.type,
        source: input.source ?? 'api',
        actor: input.actor ?? null,
        payload: input.payload,
        prevHash,
        hash: payloadHash,
        governanceTags: input.governanceTags ?? ['pricing'],
      },
    });
  }
}
