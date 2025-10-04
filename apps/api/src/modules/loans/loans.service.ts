import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { LoanSummary } from '@haizel/types';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async listLatest(tenantId: string): Promise<LoanSummary[]> {
    await this.prisma.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
    const loans = await this.prisma.loan.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return loans.map((loan) => ({
      id: loan.id,
      tenantId: loan.tenantId,
      loanNumber: loan.loanNumber,
      status: loan.status,
      amount: loan.amount.toString(),
      borrowerName: loan.borrowerName,
      updatedAt: loan.updatedAt.toISOString(),
    }));
  }
}
