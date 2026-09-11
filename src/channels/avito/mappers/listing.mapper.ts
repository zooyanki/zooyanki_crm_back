import { ListingStatus } from '../../../generated/prisma/enums.js';
import type { CanonicalListing } from '../../contracts/models.js';
import type { AvitoItem } from '../client/avito-api.types.js';

const STATUS_BY_AVITO: Record<string, ListingStatus> = {
  active: ListingStatus.ACTIVE,
  old: ListingStatus.OLD,
  blocked: ListingStatus.BLOCKED,
  rejected: ListingStatus.REJECTED,
  removed: ListingStatus.REMOVED,
};

export function toCanonicalListing(item: AvitoItem): CanonicalListing {
  const rawStatus = item.status ?? null;

  return {
    externalId: String(item.id),
    title: item.title ?? null,
    url: item.url ?? null,
    price: item.price ?? null,
    currency: 'RUB',
    categoryId: item.category ? String(item.category.id) : null,
    status: mapStatus(rawStatus),
    rawStatus,
    // Метод списка объявлений не возвращает дату публикации.
    // Появится, если начнём дочитывать карточку каждого объявления.
    publishedAt: null,
  };
}

/// Неизвестный статус не должен ронять импорт: сохраняем UNKNOWN,
/// исходное значение остаётся в rawStatus.
function mapStatus(rawStatus: string | null): ListingStatus {
  if (!rawStatus) {
    return ListingStatus.UNKNOWN;
  }

  return STATUS_BY_AVITO[rawStatus.toLowerCase()] ?? ListingStatus.UNKNOWN;
}
