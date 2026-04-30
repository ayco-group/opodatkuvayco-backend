import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as basicAuth from 'express-basic-auth';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  dotenv.config();

  // any property not included in the whitelist is automatically stripped from the resulting object
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Get allowed origins from environment variables
  const allowedOriginsEnv = configService.get<string>('CLIENT_URL');
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map((origin) => origin.trim())
    : [];
  // Get host and port from environment variables
  const host = configService.get<string>('HOST') || '0.0.0.0';
  const port = parseInt(configService.get<string>('PORT'), 10) || 3000;

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.text({ type: 'application/xml', limit: '50mb' }));

  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(
    cors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again later.',
    }),
  );

  app.use(
    '/docs*',
    basicAuth({
      authorizer: (username: string, password: string) => {
        return configService.get('NODE_ENV') === 'local'
          ? true
          : username ===
              configService.get('SWAGGER_HTTP_BASIC_AUTH_USERNAME') &&
              password ===
                configService.get('SWAGGER_HTTP_BASIC_AUTH_PASSWORD');
      },
      challenge: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Opodatkuvayco Backend')
    .setVersion('1.0')
    .addTag('REST API')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port, host);
}

bootstrap();
