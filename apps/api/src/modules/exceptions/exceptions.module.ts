import { Module } from '@nestjs/common';
import { ExceptionsService } from './exceptions.service.js';
import { ExceptionsController } from './exceptions.controller.js';

@Module({
  controllers: [ExceptionsController],
  providers: [ExceptionsService],
  exports: [ExceptionsService],
})
export class ExceptionsModule {}
