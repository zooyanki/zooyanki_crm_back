import { Global, Module } from '@nestjs/common';

import { ApiCallLogService } from './api-call-log.service.js';
import { ChannelHttpService } from './channel-http.service.js';
import { RateLimiterService } from './rate-limiter.service.js';

@Global()
@Module({
  providers: [RateLimiterService, ApiCallLogService, ChannelHttpService],
  exports: [ChannelHttpService, RateLimiterService, ApiCallLogService],
})
export class ChannelHttpModule {}
