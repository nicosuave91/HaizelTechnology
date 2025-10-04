import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import { MockPpeAdapter } from './ppe/mock-ppe.adapter.js';
import { PPE_ADAPTER } from './ppe/ppe-adapter.interface.js';

@Module({
  controllers: [PricingController],
  providers: [PricingService, { provide: PPE_ADAPTER, useClass: MockPpeAdapter }],
  exports: [PricingService],
})
export class PricingModule {}
