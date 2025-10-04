import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  APP_VERSION: z.string().default('0.1.0'),
});

const apiSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  API_JWT_ISSUER: z.string(),
  API_JWT_AUDIENCE: z.string(),
  API_JWT_SECRET: z.string().min(16),
  API_OTLP_ENDPOINT: z.string().url(),
  API_POSTGRES_URL: z.string().url(),
  API_REDIS_URL: z.string().url(),
  API_IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86400),
});

const webSchema = z.object({
  WEB_PORT: z.coerce.number().default(3000),
  WEB_OTLP_ENDPOINT: z.string().url(),
});

const workerSchema = z.object({
  TEMPORAL_ADDRESS: z.string(),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  WORKER_OTLP_ENDPOINT: z.string().url(),
});

const featureFlagsSchema = z.object({
  UNLEASH_URL: z.string().url(),
  UNLEASH_TOKEN: z.string(),
});

const s3Schema = z.object({
  S3_ENDPOINT: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET: z.string(),
});

export const config = {
  base: baseSchema.parse(process.env),
  api: apiSchema.parse(process.env),
  web: webSchema.parse(process.env),
  worker: workerSchema.parse(process.env),
  featureFlags: featureFlagsSchema.parse(process.env),
  s3: s3Schema.parse(process.env),
};

export type AppConfig = typeof config;
