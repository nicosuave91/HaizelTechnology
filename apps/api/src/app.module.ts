import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LoansModule } from './modules/loans/loans.module.js';
import { AuthModule } from './middleware/auth.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, HealthModule, LoansModule],
})
export class AppModule {}
