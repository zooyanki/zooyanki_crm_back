import { OrderStatus } from '../../../generated/prisma/enums.js';

const STATUS_BY_AVITO: Record<string, OrderStatus> = {
  on_confirmation: OrderStatus.PENDING_CONFIRMATION,
  ready_to_ship: OrderStatus.READY_TO_SHIP,
  in_transit: OrderStatus.IN_TRANSIT,
  delivered: OrderStatus.DELIVERED,
  canceled: OrderStatus.CANCELED,
  on_return: OrderStatus.ON_RETURN,
  in_dispute: OrderStatus.IN_DISPUTE,
  closed: OrderStatus.CLOSED,
};

export function mapAvitoOrderStatus(raw: string | null | undefined): OrderStatus {
  if (!raw) {
    return OrderStatus.UNKNOWN;
  }

  return STATUS_BY_AVITO[raw] ?? OrderStatus.UNKNOWN;
}
