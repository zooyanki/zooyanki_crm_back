import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { AppConfigService } from './core/config/app-config.service.js';
import { TENANT_HEADER } from './tenancy/tenant.guard.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.use(helmet());
  app.enableCors({
    origin: true,
    allowedHeaders: ['Content-Type', 'Authorization', TENANT_HEADER],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Схема отдаётся наружу намеренно: фронтенд генерирует из неё типы,
  // руками DTO там не пишутся.
  const swagger = new DocumentBuilder()
    .setTitle('Zooyanki CRM API')
    .setDescription('Управление продажами на Avito, Ozon, WB и Drom из одного места')
    .setVersion('0.1.0')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger), {
    jsonDocumentUrl: 'api/docs/openapi.json',
  });

  await app.listen(config.port);

  new Logger('Bootstrap').log(
    `Сервис слушает порт ${config.port}, документация на /api/docs`,
  );
}

void bootstrap();
