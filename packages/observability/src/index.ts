import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export interface ObservabilityOptions {
  serviceName: string;
  otlpEndpoint: string;
}

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

let sdk: NodeSDK | null = null;

export const startObservability = async (options: ObservabilityOptions) => {
  if (sdk) {
    return sdk;
  }

  sdk = new NodeSDK({
    serviceName: options.serviceName,
    traceExporter: new OTLPTraceExporter({ url: `${options.otlpEndpoint}/v1/traces` }),
    metricExporter: new OTLPMetricExporter({ url: `${options.otlpEndpoint}/v1/metrics` }),
    instrumentations: [getNodeAutoInstrumentations()],
  } as any);

  await sdk.start();
  return sdk;
};

export const stopObservability = async () => {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
};

export * from './logger.js';
export * from './pricingLocksTelemetry.js';
