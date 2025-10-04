import { Public } from '../../middleware/public.decorator.js';
import { Controller, Get, Headers } from '@nestjs/common';
import { config } from '@haizel/config';

@Controller('healthz')
export class HealthController {
  @Get()
  @Public()
  health(@Headers('traceparent') traceparent?: string) {
    return {
      status: 'ok',
      version: config.base.APP_VERSION,
      traceparent: traceparent ?? '',
    };
  }
}
