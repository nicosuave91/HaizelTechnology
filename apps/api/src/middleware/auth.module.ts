import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';

@Module({
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AuthModule {}
