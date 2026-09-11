/// Ответы API Авито в минимально необходимом объёме.
/// Поля, которые мы не используем, намеренно не описаны.

export interface AvitoTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface AvitoAccountSelf {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  profile_url?: string;
}

export interface AvitoItem {
  id: number;
  title?: string;
  price?: number;
  status?: string;
  url?: string;
  category?: { id: number; name?: string };
  start_time?: string;
}

export interface AvitoItemsResponse {
  meta: {
    page: number;
    per_page: number;
    pages: number;
  };
  resources: AvitoItem[];
}

export interface AvitoStatsRequest {
  dateFrom: string;
  dateTo: string;
  fields: string[];
  itemIds: number[];
  periodGrouping: 'day';
}

export interface AvitoStatsResponse {
  result: {
    items: Array<{
      itemId: number;
      stats: Array<{
        date: string;
        uniqViews?: number;
        uniqContacts?: number;
        uniqFavorites?: number;
      }>;
    }>;
  };
}
