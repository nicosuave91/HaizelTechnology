import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    const traceId = reply.getHeader('traceparent') || '';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Unexpected error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        detail = response;
      } else if (typeof response === 'object' && response !== null) {
        detail = (response as any).message ?? detail;
        code = (response as any).code ?? code;
      }
    }

    reply.status(status).type('application/problem+json').send({
      type: 'about:blank',
      title: HttpStatus[status] ?? 'Error',
      status,
      code,
      detail,
      traceId,
    });
  }
}
