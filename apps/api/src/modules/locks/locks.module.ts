import { Module } from '@nestjs/common';
import { LocksService } from './locks.service.js';
import { LocksController } from './locks.controller.js';

@Module({
  controllers: [LocksController],
  providers: [LocksService],
  exports: [LocksService],
})
export class LocksModule {}
