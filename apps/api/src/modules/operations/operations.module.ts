import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { OrdersService } from './orders.service.js';
import { WebhooksService } from './webhooks.service.js';
import { SlaService } from './sla.service.js';
import { TasksController } from './tasks.controller.js';
import { OrdersController } from './orders.controller.js';
import { WebhooksController } from './webhooks.controller.js';
import { SlaController } from './sla.controller.js';

@Module({
  controllers: [TasksController, OrdersController, WebhooksController, SlaController],
  providers: [TasksService, OrdersService, WebhooksService, SlaService],
})
export class OperationsModule {}
