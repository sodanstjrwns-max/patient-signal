import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API 프리픽스
  app.setGlobalPrefix('api');

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('Patient Signal API')
    .setDescription('병원 AI 검색 가시성 추적 SaaS API 문서')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('인증', '회원가입, 로그인, 토큰 관리')
    .addTag('병원', '병원 등록 및 관리')
    .addTag('질문 관리', '모니터링 질문 관리')
    .addTag('AI 크롤러', 'AI 플랫폼 크롤링')
    .addTag('경쟁사 분석', '경쟁사 추적 및 비교')
    .addTag('점수 및 통계', '가시성 점수 및 통계')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`🚀 Patient Signal API is running on: http://localhost:${port}`);
  console.log(`📚 Swagger Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
