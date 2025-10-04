import { Inject, Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../../common/prisma.service.js';
import { AuditTrailService } from '../../common/audit-trail.service.js';
import { PPE_ADAPTER, PpeAdapter, PricingScenarioInput } from './ppe/index.js';
import { PricingQuoteRequestDto, PricingQuoteResponseDto } from './dto/quote.dto.js';
import { pricingQuoteLatency, withPricingSpan } from '@haizel/observability';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrail: AuditTrailService,
    @Inject(PPE_ADAPTER) private readonly ppeAdapter: PpeAdapter,
  ) {}

  async quote(tenantId: string, dto: PricingQuoteRequestDto, actor?: string): Promise<PricingQuoteResponseDto> {
    const scenarios: PricingScenarioInput[] = [dto.scenarioA, dto.scenarioB].map((scenario) => ({
      scenarioKey: scenario.scenarioKey,
      fico: scenario.fico,
      ltv: scenario.ltv,
      cltv: scenario.cltv,
      productCode: scenario.productCode,
      pointsCap: scenario.pointsCap,
      lockPeriodDays: scenario.lockPeriodDays,
      occupancy: scenario.occupancy,
      dti: scenario.dti,
      ausFinding: scenario.ausFinding,
      overlays: scenario.overlays,
    }));

    await this.auditTrail.recordEvent({
      tenantId,
      loanId: dto.loanId,
      type: 'pricing.quote.requested',
      actor,
      payload: { scenarios },
      governanceTags: ['pricing'],
    });

    const start = performance.now();
    const adapterResponse = await withPricingSpan('pricing.ppe.quote', () =>
      this.ppeAdapter.quote(scenarios, { tenantId, loanId: dto.loanId }),
    );
    pricingQuoteLatency.record(performance.now() - start);

    const writes = adapterResponse.quotes.map((quote) =>
      this.prisma.pricingQuote.create({
        data: {
          tenantId,
          loanId: dto.loanId ?? null,
          ppe: 'mock-ppe',
          scenarioKey: quote.scenarioKey,
          eligibility: quote.eligibility,
          rate: quote.rate,
          price: quote.price,
          lockPeriod: quote.lockPeriodDays,
          llpas: quote.llpas,
          costItems: quote.costItems,
          rawPayloadUri: quote.rawPayloadUri,
        },
      }),
    );

    await this.prisma.$transaction(writes);

    await this.auditTrail.recordEvent({
      tenantId,
      loanId: dto.loanId,
      type: 'pricing.quote.received',
      actor,
      payload: {
        scenarioKeys: adapterResponse.quotes.map((quote) => quote.scenarioKey),
        comparison: adapterResponse.comparison,
      },
      governanceTags: ['pricing'],
    });

    const [scenarioAResult, scenarioBResult] = adapterResponse.quotes;

    if (!scenarioAResult || !scenarioBResult) {
      throw new Error('Adapter response missing comparison scenarios');
    }

    await this.auditTrail.recordEvent({
      tenantId,
      loanId: dto.loanId,
      type: 'pricing.quote.persisted',
      actor,
      payload: {
        scenarioA: scenarioAResult.scenarioKey,
        scenarioB: scenarioBResult.scenarioKey,
      },
      governanceTags: ['pricing'],
    });

    return {
      scenarioA: scenarioAResult,
      scenarioB: scenarioBResult,
      comparison: adapterResponse.comparison,
    };
  }
}
