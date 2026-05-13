import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap() {
  const isWorker = process.env.WORKER === '1';

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('WEB_PUBLIC_URL', 'http://localhost:3000'),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/db', 'health/queue'] });

  const port = Number(config.get('PORT', 4000));

  if (isWorker) {
    // En modo worker no escuchamos HTTP — solo procesamos colas.
    // Los procesadores BullMQ se inicializan vía módulos (cuando se agreguen).
    console.log(`[worker] Worker BullMQ arrancado.`);
    await app.init();
    return;
  }

  await app.listen(port);
  console.log(`🚀 API NestJS escuchando en http://localhost:${port}/api/v1`);
}

bootstrap().catch((err) => {
  console.error('Fallo al arrancar la API:', err);
  process.exit(1);
});
