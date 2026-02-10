import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Bootstrap the NestJS application
 *
 * Configures:
 * - Upload directories
 * - Security headers (Helmet)
 * - CORS with configurable origins
 * - Global validation pipe
 * - Global exception filter
 * - Swagger API documentation
 */
async function bootstrap() {
  // Ensure uploads directories exist
  const uploadDirs = ['uploads', 'uploads/books', 'uploads/audio'];
  for (const dir of uploadDirs) {
    const fullPath = join(process.cwd(), dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const configService = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // Enable CORS - use environment variable for production
  const corsOrigins = configService.get<string>(
    'CORS_ORIGINS',
    'http://localhost:5173,http://localhost:3000,http://localhost:8080,http://localhost:8081',
  );
  app.enableCors({
    origin: corsOrigins.split(',').map((origin) => origin.trim()),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe with detailed error messages
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Global exception filter for standardized error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Smarton Content Studio API')
    .setDescription('Backend API for AI-powered audio content platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Set global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Smarton Backend running on http://localhost:${port}`);
  console.log(`📚 API Docs available at http://localhost:${port}/api/docs`);
}
void bootstrap();
