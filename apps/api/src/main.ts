import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { AppModule } from './app.module.js';
import { config } from '@haizel/config';
import { startObservability } from '@haizel/observability';
import { ProblemJsonFilter } from './middleware/problem-json.filter.js';
import { requestContextHook } from './middleware/request-context.hook.js';

async function bootstrap() {
  await startObservability({
    serviceName: 'api',
    otlpEndpoint: config.api.API_OTLP_ENDPOINT,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  await app.register(helmet as unknown as Parameters<typeof app.register>[0]);
  await app.register(cors as unknown as Parameters<typeof app.register>[0], { origin: true });

  app.useGlobalFilters(new ProblemJsonFilter());

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', requestContextHook as any);

  await app.listen(config.api.API_PORT, config.api.API_HOST);
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap API', error);
  process.exit(1);
});
