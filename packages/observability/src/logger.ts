import pino, { Logger } from 'pino';

export interface LogFields {
  tenant_id?: string;
  user_id?: string;
  correlation_id?: string;
  request_id?: string;
  ip_hash?: string;
  pii?: boolean;
  severity?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

export const createLogger = (name: string, fields: LogFields = {}): Logger => {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    base: fields,
  });
};
