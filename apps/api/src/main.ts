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

  await app.register(helmet);
  await app.register(cors, { origin: true });

  app.useGlobalFilters(new ProblemJsonFilter());
  app.addHook('onRequest', requestContextHook);

  await app.listen({ port: config.api.API_PORT, host: config.api.API_HOST });
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap API', error);
  process.exit(1);
});
