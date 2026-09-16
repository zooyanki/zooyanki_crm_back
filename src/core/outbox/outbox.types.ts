export const OUTBOX_TYPES = {

  STOCKS_PUSH: 'stocks.push',

  ORDER_TRANSITION: 'order.applyTransition',

  ORDER_TRACKING: 'order.setTrackingNumber',

  ORDER_ACCEPT_RETURN: 'order.acceptReturn',

  ORDER_MARKINGS: 'order.setMarkings',

  ORDER_COURIER_RANGE: 'order.setCourierDeliveryRange',

  ORDER_CNC_DETAILS: 'order.setCncDetails',

  PRICE_UPDATE: 'price.update',

  VAS_APPLY: 'vas.apply',

} as const;



export type OutboxType = (typeof OUTBOX_TYPES)[keyof typeof OUTBOX_TYPES];



export interface StocksPushPayload {

  items: Array<{

    externalId: string;

    quantity: number;

  }>;

}



export interface OrderTransitionPayload {

  orderId: string;

  externalId: string;

  transition: string;

  confirmCode?: string;

  marketplaceId?: string | null;

}



export interface OrderTrackingPayload {

  orderId: string;

  externalId: string;

  trackingNumber: string;

}



export interface OrderAcceptReturnPayload {

  orderId: string;

  externalId: string;

  terminalNumber: string;

  recipientName: string;

  recipientPhone: string;

}



export interface OrderMarkingsPayload {

  orderId: string;

  externalId: string;

  items: Array<{

    itemId: string;

    markings: string[];

  }>;

}



export interface OrderCourierRangePayload {

  orderId: string;

  externalId: string;

  address: string;

  addressDetails?: string;

  startDate: string;

  endDate: string;

  intervalType: 'fixed' | 'asap';

  phone: string;

  name: string;

}



export interface OrderCncDetailsPayload {

  orderId: string;

  externalId: string;

  marketplaceId: string;

  bookingPeriod: number;

  address?: string;

  details?: string;

}



export interface PriceUpdatePayload {

  listingId: string;

  externalId: string;

  price: number;

}



export interface VasApplyPayload {

  listingId: string;

  externalId: string;

  slugs: string[];

  stickers?: number[];

}


