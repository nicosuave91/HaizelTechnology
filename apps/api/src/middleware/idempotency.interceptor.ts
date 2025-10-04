import { CallHandler, ExecutionContext, Injectable, NestInterceptor, ConflictException } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { PrismaService } from '../common/prisma.service.js';
import { createHash } from 'node:crypto';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<any>();
    const idempotencyKey = request.headers['idempotency-key'];
    const tenantId = request.tenant?.tenantId;

    if (!idempotencyKey || request.method === 'GET') {
      return next.handle();
    }

    const keyHash = createHash('sha256').update(String(idempotencyKey)).digest('hex');
    const requestHash = createHash('sha256').update(JSON.stringify(request.body ?? {})).digest('hex');

    return from(
      this.prisma.vendorRequest.upsert({
        where: { tenantId_keyHash: { tenantId, keyHash } },
        create: {
          tenantId,
          keyHash,
          requestHash,
          status: 'PENDING',
        },
        update: {},
      }),
    ).pipe(
      switchMap((record) => {
        const current = record as { status: string };

        if (current.status === 'COMPLETED') {
          throw new ConflictException({ message: 'Idempotent replay', code: 'IDEMPOTENT_REPLAY' });
        }

        return next.handle().pipe(
          tap(async (response) => {
            const responseHash = createHash('sha256').update(JSON.stringify(response ?? {})).digest('hex');
            await this.prisma.vendorRequest.update({
              where: { tenantId_keyHash: { tenantId, keyHash } },
              data: {
                responseHash,
                responsePayload: response,
                status: 'COMPLETED',
              },
            });
          }),
        );
      }),
    );
  }
}
