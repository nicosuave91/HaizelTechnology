#!/usr/bin/env node
import { PrismaClient, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function hashEvent(tx, tenantId, loanId, type, payload) {
  const prev = await tx.event.findFirst({ where: { tenantId }, orderBy: { occurredAt: 'desc' } });
  const prevHash = prev?.hash ?? null;
  const hash = createHash('sha256').update(JSON.stringify({ payload, prevHash, type })).digest('hex');
  await tx.event.create({
    data: {
      tenantId,
      loanId,
      type,
      payload,
      prevHash,
      hash,
      governanceTags: ['seed'],
    },
  });
}

async function seedTenant(tx, slug, name) {
  return tx.tenant.upsert({
    where: { slug },
    update: { name },
    create: { slug, name },
  });
}

async function seedUser(tx, tenantId, email, name, scopes) {
  return tx.user.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: { name },
    create: {
      tenantId,
      email,
      name,
      status: 'active',
      createdBy: tenantId,
      updatedBy: tenantId,
      version: 1,
    },
  });
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const tenantAlpha = await seedTenant(tx, 'tenant-alpha', 'Tenant Alpha');
    const tenantBeta = await seedTenant(tx, 'tenant-beta', 'Tenant Beta');

    const users = await Promise.all([
      seedUser(tx, tenantAlpha.id, 'lo@alpha.dev', 'Alpha LO', ['locks:float-down']),
      seedUser(tx, tenantAlpha.id, 'uw@alpha.dev', 'Alpha UW', ['exceptions:approve']),
      seedUser(tx, tenantAlpha.id, 'ops@alpha.dev', 'Alpha Ops', ['locks:void']),
    ]);

    const loanNumbers = ['HL-8001', 'HL-8002', 'HL-8003', 'HL-8004', 'HL-8005', 'HL-8006'];
    const loans = [];
    for (const [index, loanNumber] of loanNumbers.entries()) {
      const loan = await tx.loan.upsert({
        where: { tenantId_loanNumber: { tenantId: tenantAlpha.id, loanNumber } },
        update: {},
        create: {
          tenantId: tenantAlpha.id,
          loanNumber,
          status: index % 2 === 0 ? 'in_pricing' : 'processing',
          amount: new Prisma.Decimal(350000 + index * 15000),
          loanType: 'CONV',
        },
      });
      loans.push(loan);
      await hashEvent(tx, tenantAlpha.id, loan.id, 'loan.seeded', { loanNumber });
    }

    const [loanForLock, loanForException] = [loans[0], loans[1]];

    await tx.pricingQuote.createMany({
      data: [
        {
          id: randomUUID(),
          tenantId: tenantAlpha.id,
          loanId: loanForLock.id,
          ppe: 'mock-ppe',
          scenarioKey: 'seed-A',
          eligibility: { fico: 760, ltv: 80 },
          rate: new Prisma.Decimal(6.25),
          price: new Prisma.Decimal(101.25),
          lockPeriod: 45,
          llpas: [
            { code: 'FICO>740', description: 'Credit score 740+', amount: -0.25 },
            { code: 'LTV<=80', description: 'Low LTV', amount: -0.125 },
          ],
          costItems: [
            { label: 'PPE Fee', amount: 15 },
            { label: 'Credit Report', amount: 32.5 },
          ],
          rawPayloadUri: 's3://ppe/tenant-alpha/seed-A.json',
        },
        {
          id: randomUUID(),
          tenantId: tenantAlpha.id,
          loanId: loanForLock.id,
          ppe: 'mock-ppe',
          scenarioKey: 'seed-B',
          eligibility: { fico: 700, ltv: 90 },
          rate: new Prisma.Decimal(6.75),
          price: new Prisma.Decimal(99.5),
          lockPeriod: 45,
          llpas: [
            { code: 'FICO700-719', description: 'Score penalty', amount: 0.75 },
            { code: 'LTV>80', description: 'High LTV', amount: 0.5 },
          ],
          costItems: [
            { label: 'PPE Fee', amount: 15 },
          ],
          rawPayloadUri: 's3://ppe/tenant-alpha/seed-B.json',
        },
      ],
    });

    const lock = await tx.rateLock.create({
      data: {
        tenantId: tenantAlpha.id,
        loanId: loanForLock.id,
        status: 'locked',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        lockPeriodDays: 45,
        productRef: 'CONV-30FXD',
        rate: new Prisma.Decimal(6.25),
        price: new Prisma.Decimal(101.25),
        actions: [{ type: 'create', actor: users[0].id, occurredAt: new Date().toISOString() }],
        createdBy: users[0].id,
      },
    });
    await hashEvent(tx, tenantAlpha.id, lock.loanId, 'lock.created', { lockId: lock.id });

    const exceptionPayloads = [
      {
        loan: loanForException,
        ruleCode: 'LLPA.OVERLAY',
        justification: 'Borrower has compensating assets',
        requestedBy: users[0].id,
      },
      {
        loan: loans[2],
        ruleCode: 'UW.MANUAL',
        justification: 'Manual underwrite due to non-traditional credit',
        requestedBy: users[0].id,
      },
      {
        loan: loans[3],
        ruleCode: 'PRICING.CAP',
        justification: 'Need additional .125 pricing waiver',
        requestedBy: users[0].id,
      },
    ];

    for (const exception of exceptionPayloads) {
      const record = await tx.exception.create({
        data: {
          tenantId: tenantAlpha.id,
          loanId: exception.loan.id,
          ruleCode: exception.ruleCode,
          type: 'pricing',
          justification: exception.justification,
          requestedBy: exception.requestedBy,
          status: 'pending',
          scope: 'loan',
          auditTrail: [
            {
              action: 'requested',
              actor: exception.requestedBy,
              at: new Date().toISOString(),
              justification: exception.justification,
            },
          ],
        },
      });
      await hashEvent(tx, tenantAlpha.id, record.loanId, 'exception.requested', { exceptionId: record.id });
    }

    await hashEvent(tx, tenantBeta.id, null, 'tenant.seeded', { tenant: 'tenant-beta' });
  });

  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
