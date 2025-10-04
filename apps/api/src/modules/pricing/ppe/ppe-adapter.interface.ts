export interface PricingScenarioInput {
  scenarioKey: string;
  fico: number;
  ltv: number;
  cltv: number;
  productCode: string;
  pointsCap?: number;
  lockPeriodDays: number;
  occupancy?: string;
  dti?: number;
  ausFinding?: string;
  overlays?: string[];
}

export interface LlpaLineItem {
  code: string;
  description: string;
  amount: number;
}

export interface NormalizedQuote {
  scenarioKey: string;
  rate: number;
  price: number;
  lockPeriodDays: number;
  eligibility: Record<string, any>;
  llpas: LlpaLineItem[];
  costItems: { label: string; amount: number }[];
  rawPayloadUri?: string;
}

export interface PricingComparisonSummary {
  deltaRate: number;
  deltaPrice: number;
  llpaBreakdown: LlpaLineItem[];
}

export interface PricingAdapterResponse {
  quotes: NormalizedQuote[];
  comparison: PricingComparisonSummary;
}

export interface PpeAdapter {
  quote(scenarios: PricingScenarioInput[], options: { tenantId: string; loanId?: string }): Promise<PricingAdapterResponse>;
}

export const PPE_ADAPTER = Symbol.for('PpeAdapter');
