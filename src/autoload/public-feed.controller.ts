import { Controller, Get, Header, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AutoloadService } from './autoload.service.js';

@ApiTags('Публичные фиды')
@Controller('public/feeds')
export class PublicFeedController {
  constructor(private readonly autoload: AutoloadService) {}

  @Get(':channelAccountId.xml')
  @ApiOperation({ summary: 'Публичный XML-фид автозагрузки (без JWT)' })
  @Header('Cache-Control', 'public, max-age=60')
  async feed(
    @Param('channelAccountId', ParseUUIDPipe) channelAccountId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const xml = await this.autoload.buildFeedXml(channelAccountId, token ?? '');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  }
}

