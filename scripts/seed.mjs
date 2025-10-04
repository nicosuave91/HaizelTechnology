#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  await prisma.$transaction(async (tx) => {
    const tenantAlpha = await tx.tenant.upsert({
      where: { slug: 'tenant-alpha' },
      update: {},
      create: {
        slug: 'tenant-alpha',
        name: 'Tenant Alpha',
      },
    });

    const tenantBeta = await tx.tenant.upsert({
      where: { slug: 'tenant-beta' },
      update: {},
      create: {
        slug: 'tenant-beta',
        name: 'Tenant Beta',
      },
    });

    await Promise.all([
      tx.user.upsert({
        where: { tenantId_email: { tenantId: tenantAlpha.id, email: 'lo@alpha.dev' } },
        update: {},
        create: {
          tenantId: tenantAlpha.id,
          email: 'lo@alpha.dev',
          name: 'Alpha LO',
          role: 'loan_officer',
        },
      }),
      tx.user.upsert({
        where: { tenantId_email: { tenantId: tenantAlpha.id, email: 'processor@alpha.dev' } },
        update: {},
        create: {
          tenantId: tenantAlpha.id,
          email: 'processor@alpha.dev',
          name: 'Alpha Processor',
          role: 'processor',
        },
      }),
      tx.user.upsert({
        where: { tenantId_email: { tenantId: tenantAlpha.id, email: 'admin@alpha.dev' } },
        update: {},
        create: {
          tenantId: tenantAlpha.id,
          email: 'admin@alpha.dev',
          name: 'Alpha Admin',
          role: 'admin',
        },
      }),
    ]);

    const loan = await tx.loan.upsert({
      where: { tenantId_loanNumber: { tenantId: tenantAlpha.id, loanNumber: 'HL-1001' } },
      update: {},
      create: {
        tenantId: tenantAlpha.id,
        loanNumber: 'HL-1001',
        status: 'in_review',
        amount: 350000,
        borrowerName: 'Jane Borrower',
      },
    });

    await tx.event.create({
      data: {
        tenantId: tenantAlpha.id,
        loanId: loan.id,
        type: 'loan.created',
        payload: { loanNumber: loan.loanNumber },
        occurredAt: new Date(),
      },
    });

    console.log('Seed complete', { tenants: [tenantAlpha.slug, tenantBeta.slug], loan: loan.loanNumber });
  });
}

seed()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
