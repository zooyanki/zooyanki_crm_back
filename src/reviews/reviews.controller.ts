import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import {
  AnswerReviewDto,
  ListReviewsQueryDto,
  ReviewListResultDto,
  ReviewViewDto,
} from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('Отзывы')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Список отзывов' })
  @ApiOkResponse({ type: ReviewListResultDto })
  list(
    @CurrentTenant() tenantId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<ReviewListResultDto> {
    return this.reviews.list(tenantId, query.page, query.perPage);
  }

  @Post(':id/answer')
  @ApiOperation({ summary: 'Ответить на отзыв' })
  @ApiOkResponse({ type: ReviewViewDto })
  answer(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AnswerReviewDto,
  ): Promise<ReviewViewDto> {
    return this.reviews.answer(tenantId, id, body.text);
  }
}

