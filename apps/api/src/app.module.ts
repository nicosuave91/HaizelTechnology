import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LoansModule } from './modules/loans/loans.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { AuthModule } from './middleware/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    LoansModule,
    OperationsModule,
  ],
})
export class AppModule {}
