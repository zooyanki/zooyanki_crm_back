import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ChannelCode } from '../generated/prisma/enums.js';
import type { Capability, ChannelAdapter } from './contracts/channel-adapter.js';

export const CHANNEL_ADAPTERS = Symbol('CHANNEL_ADAPTERS');

@Injectable()
export class ChannelRegistry {
  private readonly byCode: Map<ChannelCode, ChannelAdapter>;

  constructor(@Inject(CHANNEL_ADAPTERS) adapters: ChannelAdapter[]) {
    this.byCode = new Map(adapters.map((adapter) => [adapter.code, adapter]));
  }

  get(code: ChannelCode): ChannelAdapter {
    const adapter = this.byCode.get(code);

    if (!adapter) {
      throw new NotFoundException(`Площадка ${code} не подключена`);
    }

    return adapter;
  }

  has(code: ChannelCode): boolean {
    return this.byCode.has(code);
  }

  supports(code: ChannelCode, capability: Capability): boolean {
    return this.byCode.get(code)?.capabilities.has(capability) ?? false;
  }

  list(): ChannelAdapter[] {
    return [...this.byCode.values()];
  }
}
