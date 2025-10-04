import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service.js';
import { LoanSummary } from '@haizel/types';

type LoanRecord = {
  id: string;
  tenantId: string;
  userId: string;
  loanNumber: string | null;
  status: string;
  amount: { toString(): string };
  borrowerName: string | null;
  updatedAt: Date;
};

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async listLatest(tenantId: string): Promise<LoanSummary[]> {
    await this.prisma.$executeRaw`SELECT set_config('app.tenant', ${tenantId}, true)`;
    const loans = (await this.prisma.loan.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })) as unknown as LoanRecord[];
    return loans.map((loan): LoanSummary => ({
      id: loan.id,
      tenantId: loan.tenantId,
      userId: loan.userId,
      loanNumber: loan.loanNumber ?? '',
      status: loan.status,
      amount: loan.amount.toString(),
      borrowerName: loan.borrowerName ?? '',
      updatedAt: loan.updatedAt.toISOString(),
    }));
  }
}
