import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { AuditTrailService } from './audit-trail.service.js';

@Global()
@Module({
  providers: [PrismaService, AuditTrailService],
  exports: [PrismaService, AuditTrailService],
})
export class PrismaModule {}
