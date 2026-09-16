import { ChannelCode } from '../generated/prisma/enums.js';

/// Площадки, которые видит пользователь при подключении.
/// Список меняют разработчики, не арендатор.
export const ENABLED_CHANNELS: ChannelCode[] = [
  ChannelCode.AVITO,
  ChannelCode.XO_MARKET,
  ChannelCode.YULA,
];

export const CHANNEL_TITLE: Record<ChannelCode, string> = {
  [ChannelCode.AVITO]: 'Авито',
  [ChannelCode.OZON]: 'Ozon',
  [ChannelCode.WILDBERRIES]: 'Wildberries',
  [ChannelCode.DROM]: 'Drom',
  [ChannelCode.XO_MARKET]: 'XO-market',
  [ChannelCode.YULA]: 'Юла',
};

export function isEnabledChannel(code: ChannelCode): boolean {
  return ENABLED_CHANNELS.includes(code);
}
