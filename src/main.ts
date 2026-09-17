import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { MolAuthGuard } from './common/guards/mol-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  const port = configService.get<number>('PORT', 4000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

  // ── Middleware ────────────────────────────────────────────────────────────
  app.use(cookieParser());
  app.use(helmet());
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Global pipes ─────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // ── Global interceptors (order matters) ───────────────────────────────────
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new LoggingInterceptor(),
    new ClassSerializerInterceptor(reflector),
    new ResponseTransformInterceptor(),
  );

  // ── Global filters ────────────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter(configService));

  // ── Global guards ─────────────────────────────────────────────────────────
  app.useGlobalGuards(
    app.get(MolAuthGuard),
    new PermissionsGuard(reflector),
  );

  // ── Swagger (non-production only) ─────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Carstore Admin API')
      .setDescription('REST API for Carstore Admin Dashboard')
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', name: 'Authorization', in: 'header' }, 'MOLToken')
      .addCookieAuth('MOLToken')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`🚀 Application running on port ${port} [${nodeEnv}]`);
}

void bootstrap();
