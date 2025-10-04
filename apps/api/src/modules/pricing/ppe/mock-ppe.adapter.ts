import { randomUUID } from 'node:crypto';
import { PpeAdapter, PricingAdapterResponse, PricingScenarioInput } from './ppe-adapter.interface.js';

const GOLDEN_QUOTES: Record<string, { rate: number; price: number; llpas: { code: string; description: string; amount: number }[] }> = {
  'conv-760-80': {
    rate: 6.25,
    price: 101.25,
    llpas: [
      { code: 'FICO>740', description: 'Credit score 740+', amount: -0.25 },
      { code: 'LTV<=80', description: 'LTV <= 80%', amount: -0.125 },
    ],
  },
  'conv-700-90': {
    rate: 6.75,
    price: 99.5,
    llpas: [
      { code: 'FICO700-719', description: 'Credit score penalty', amount: 0.75 },
      { code: 'LTV>80', description: 'High LTV add-on', amount: 0.5 },
    ],
  },
  'fha-660-96': {
    rate: 6.125,
    price: 102.0,
    llpas: [
      { code: 'FHA-UFMIP', description: 'FHA upfront mortgage insurance', amount: 1.75 },
    ],
  },
  'va-700-100': {
    rate: 6.0,
    price: 101.75,
    llpas: [
      { code: 'VA-FUNDING', description: 'VA funding fee', amount: 2.15 },
    ],
  },
};

function buildKey(scenario: PricingScenarioInput) {
  if (scenario.productCode.startsWith('FHA')) {
    return 'fha-660-96';
  }
  if (scenario.productCode.startsWith('VA')) {
    return 'va-700-100';
  }
  if (scenario.fico >= 740 && scenario.ltv <= 80) {
    return 'conv-760-80';
  }
  return 'conv-700-90';
}

export class MockPpeAdapter implements PpeAdapter {
  async quote(scenarios: PricingScenarioInput[], options: { tenantId: string; loanId?: string }): Promise<PricingAdapterResponse> {
    const quotes = scenarios.map((scenario) => {
      const key = buildKey(scenario);
      const base = GOLDEN_QUOTES[key];
      if (!base) {
        throw new Error(`Missing mock PPE quote for ${key}`);
      }
      const eligibility = {
        scenarioKey: scenario.scenarioKey,
        fico: scenario.fico,
        ltv: scenario.ltv,
        overlays: scenario.overlays ?? [],
        approved: base.price >= 100 || scenario.productCode.startsWith('FHA') || scenario.productCode.startsWith('VA'),
      };

      return {
        scenarioKey: scenario.scenarioKey,
        rate: base.rate,
        price: Number(base.price.toFixed(3)),
        lockPeriodDays: scenario.lockPeriodDays,
        eligibility,
        llpas: base.llpas,
        costItems: [
          { label: 'PPE Fee', amount: 15 },
          { label: 'Credit Report', amount: 32.5 },
        ],
        rawPayloadUri: `s3://ppe/${options.tenantId}/${options.loanId ?? randomUUID()}/${scenario.scenarioKey}.json`,
      };
    });

    const [first, second] = quotes;

    if (!first || !second) {
      throw new Error('Mock PPE adapter requires two scenarios for comparison');
    }

    const deltaRate = Number((second.rate - first.rate).toFixed(3));
    const deltaPrice = Number((second.price - first.price).toFixed(3));
    const llpaBreakdownMap = [...first.llpas, ...second.llpas].reduce<
      Record<string, { code: string; description: string; amount: number }>
    >((acc, item) => {
      const existing = acc[item.code];
      if (!existing) {
        acc[item.code] = { ...item };
      } else {
        existing.amount = Number((existing.amount + item.amount).toFixed(3));
      }
      return acc;
    }, {});

    return {
      quotes,
      comparison: {
        deltaRate,
        deltaPrice,
        llpaBreakdown: Object.values(llpaBreakdownMap),
      },
    };
  }
}
