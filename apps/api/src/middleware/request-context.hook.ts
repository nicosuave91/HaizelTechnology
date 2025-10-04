import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';

export async function requestContextHook(request: FastifyRequest, reply: FastifyReply) {
  const requestId = request.headers['x-request-id'] || randomUUID();
  const correlationId = request.headers['x-correlation-id'] || requestId;
  request.headers['x-request-id'] = String(requestId);
  request.headers['x-correlation-id'] = String(correlationId);
  reply.header('x-request-id', requestId);
  reply.header('x-correlation-id', correlationId);
  if (request.headers['traceparent']) {
    reply.header('traceparent', request.headers['traceparent']);
  }
}
