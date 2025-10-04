import { context, metrics, trace } from '@opentelemetry/api';

const meter = metrics.getMeter('haizel.pricing');
const tracer = trace.getTracer('haizel.pricing');

export const pricingQuoteLatency = meter.createHistogram('pricing.quote.latency', {
  description: 'PPE round trip duration in milliseconds',
  unit: 'ms',
});

export const pricingQuoteErrors = meter.createCounter('pricing.quote.errors', {
  description: 'Count of PPE quote failures',
});

export const lockTimerLatency = meter.createHistogram('locks.timer.latency', {
  description: 'Temporal lock timer completion delta',
  unit: 'ms',
});

export async function withPricingSpan<T>(name: string, fn: (span: ReturnType<typeof tracer.startSpan>) => Promise<T>): Promise<T> {
  const span = tracer.startSpan(name);
  try {
    return await context.with(trace.setSpan(context.active(), span), () => fn(span));
  } catch (error) {
    span.recordException(error as Error);
    pricingQuoteErrors.add(1);
    throw error;
  } finally {
    span.end();
  }
}
