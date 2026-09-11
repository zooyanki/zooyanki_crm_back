import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PrismaService } from './core/db/prisma.service.js';
import { RedisService } from './core/redis/redis.service.js';

@ApiTags('Служебное')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Проверка доступности базы и очереди' })
  async check(): Promise<{ status: string; database: boolean; redis: boolean }> {
    const [database, redis] = await Promise.all([this.pingDatabase(), this.pingRedis()]);

    return {
      status: database && redis ? 'ok' : 'degraded',
      database,
      redis,
    };
  }

  private async pingDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
