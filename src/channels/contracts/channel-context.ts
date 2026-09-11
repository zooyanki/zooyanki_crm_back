/// Что адаптер знает о вызове. Учётные данные сюда намеренно не кладутся:
/// адаптер достаёт и расшифровывает их сам, чтобы секреты не гуляли
/// по слоям приложения.
export interface ChannelContext {
  tenantId: string;
  channelAccountId: string;
}
