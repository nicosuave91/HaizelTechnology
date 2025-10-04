import { startObservability } from '@haizel/observability';
import { config } from '@haizel/config';

export async function register() {
  await startObservability({
    serviceName: 'web',
    otlpEndpoint: config.web.WEB_OTLP_ENDPOINT,
  });
}
