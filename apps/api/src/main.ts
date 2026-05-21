import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap() {
  const isWorker = process.env.WORKER === '1';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  // Confianza en el proxy (Railway, nginx) para que req.ip refleje el cliente real
  app.set('trust proxy', 1);

  // Seguridad HTTP: Helmet con CSP relajada para soportar Capacitor/PWA en el futuro
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'capacitor://localhost', 'http://localhost:*', 'ws://localhost:*'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Compresión gzip — excluye eventos en streaming (SSE)
  app.use(
    compression({
      filter: (req, res) => {
        const type = res.getHeader('Content-Type');
        if (typeof type === 'string' && type.includes('text/event-stream')) return false;
        return compression.filter(req, res);
      },
    }),
  );

  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('WEB_PUBLIC_URL', 'http://localhost:3000'),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/db', 'health/queue'] });

  // OpenAPI / Swagger — solo en desarrollo o con flag explícita
  const swaggerEnabled =
    config.get<string>('NODE_ENV') !== 'production' || config.get<string>('SWAGGER_ENABLED') === '1';
  if (swaggerEnabled && !isWorker) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Santa Isabel API')
      .setDescription('Plataforma de gestión de proyectos inmobiliarios — API REST')
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = Number(config.get('PORT', 4000));

  if (isWorker) {
    console.log(`[worker] Worker BullMQ arrancado.`);
    await app.init();
    return;
  }

  await app.listen(port);
  console.log(`🚀 API NestJS escuchando en http://localhost:${port}/api/v1`);
  if (swaggerEnabled) {
    console.log(`📚 Swagger disponible en http://localhost:${port}/docs`);
  }
}

bootstrap().catch((err) => {
  console.error('Fallo al arrancar la API:', err);
  process.exit(1);
});
