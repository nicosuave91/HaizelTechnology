#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const envFile = existsSync(resolve('.env')) ? '.env' : existsSync(resolve('.env.local')) ? '.env.local' : null;
if (envFile) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config({ path: '.env.example' });
}

const required = readFileSync(new URL('../.env.example', import.meta.url), 'utf-8')
  .split('
')
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split('=')[0]);

const missing = required.filter((key) => !process.env[key] || process.env[key] === '');

if (missing.length > 0) {
  console.error('Missing required environment variables:', missing.join(', '));
  process.exit(1);
}
console.log('Environment OK');
