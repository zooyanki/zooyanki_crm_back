import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';



import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';

import {

  AcceptOrderReturnDto,

  ApplyOrderTransitionDto,

  CourierRangeResultDto,

  GetCourierRangeQueryDto,

  ListOrdersQueryDto,

  OrderLabelsResultDto,

  OrderListResultDto,

  QueuedOrderActionDto,

  SetCncDetailsDto,

  SetCourierRangeDto,

  SetOrderMarkingsDto,

  SetOrderTrackingDto,

} from './orders.dto.js';

import { OrdersService } from './orders.service.js';



@ApiTags('Заказы')

@ApiBearerAuth()

@UseGuards(JwtAuthGuard)

@Controller('orders')

export class OrdersController {

  constructor(private readonly orders: OrdersService) {}



  @Get()

  @ApiOperation({ summary: 'Список заказов всех подключённых площадок' })

  @ApiOkResponse({ type: OrderListResultDto })

  list(

    @CurrentTenant() tenantId: string,

    @Query() query: ListOrdersQueryDto,

  ): Promise<OrderListResultDto> {

    return this.orders.list(tenantId, query);

  }



  @Post(':id/transition')

  @ApiOperation({

    summary: 'Поставить смену статуса заказа в outbox (confirm / reject / perform / receive)',

  })

  @ApiOkResponse({ type: QueuedOrderActionDto })

  transition(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: ApplyOrderTransitionDto,

  ): Promise<QueuedOrderActionDto> {

    return this.orders.queueTransition(tenantId, id, body);

  }



  @Post(':id/tracking-number')

  @ApiOperation({ summary: 'Поставить передачу трек-номера в outbox' })

  @ApiOkResponse({ type: QueuedOrderActionDto })

  trackingNumber(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: SetOrderTrackingDto,

  ): Promise<QueuedOrderActionDto> {

    return this.orders.queueTrackingNumber(tenantId, id, body);

  }



  @Post(':id/accept-return')

  @ApiOperation({ summary: 'Поставить приём возврата в outbox' })

  @ApiOkResponse({ type: QueuedOrderActionDto })

  acceptReturn(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: AcceptOrderReturnDto,

  ): Promise<QueuedOrderActionDto> {

    return this.orders.queueAcceptReturn(tenantId, id, body);

  }



  @Post(':id/labels')

  @ApiOperation({ summary: 'Сгенерировать и скачать этикетку заказа (PDF, base64)' })

  @ApiOkResponse({ type: OrderLabelsResultDto })

  labels(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

  ): Promise<OrderLabelsResultDto> {

    return this.orders.downloadLabels(tenantId, id);

  }



  @Post(':id/markings')

  @ApiOperation({ summary: 'Поставить передачу кодов «Честный знак» в outbox' })

  @ApiOkResponse({ type: QueuedOrderActionDto })

  markings(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: SetOrderMarkingsDto,

  ): Promise<QueuedOrderActionDto> {

    return this.orders.queueMarkings(tenantId, id, body);

  }



  @Get(':id/courier-range')

  @ApiOperation({ summary: 'Доступные окна приезда курьера' })

  @ApiOkResponse({ type: CourierRangeResultDto })

  courierRange(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

    @Query() query: GetCourierRangeQueryDto,

  ): Promise<CourierRangeResultDto> {

    return this.orders.getCourierRange(tenantId, id, query.address);

  }



  @Post(':id/courier-range')

  @ApiOperation({ summary: 'Выбрать окно приезда курьера (outbox)' })

  @ApiOkResponse({ type: QueuedOrderActionDto })

  setCourierRange(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: SetCourierRangeDto,

  ): Promise<QueuedOrderActionDto> {

    return this.orders.queueCourierRange(tenantId, id, body);

  }



  @Post(':id/cnc-details')

  @ApiOperation({ summary: 'Подготовить заказ самовывоза CNC (outbox)' })

  @ApiOkResponse({ type: QueuedOrderActionDto })

  cncDetails(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: SetCncDetailsDto,

  ): Promise<QueuedOrderActionDto> {

    return this.orders.queueCncDetails(tenantId, id, body);

  }

}


