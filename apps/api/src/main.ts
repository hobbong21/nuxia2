import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './common/filters/exception.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor'

// BigInt → JSON serialization
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

/**
 * QA P1-06: 필수 env 부재 시 부트스트랩 즉시 실패.
 * fallback(`'dev-secret'` 등) 은 전면 금지. dev 환경이라도 `.env` 로드 필요.
 */
function assertRequiredEnv(): void {
  const required = ['JWT_SECRET', 'DATABASE_URL', 'PORTONE_API_SECRET']
  const missing = required.filter((k) => !process.env[k] || process.env[k]!.length === 0)
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(
      `[nuxia/api] missing required env: ${missing.join(', ')}. Set them in .env or the runtime environment.`,
    )
    process.exit(1)
  }
  if ((process.env.JWT_SECRET ?? '').length < 32) {
    // eslint-disable-next-line no-console
    console.error('[nuxia/api] JWT_SECRET must be at least 32 characters.')
    process.exit(1)
  }
}

async function bootstrap() {
  assertRequiredEnv()

  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    bufferLogs: true,
  })

  // v0.3 S1: pino 로거 주입 — 부팅 로그까지 구조화.
  app.useLogger(app.get(Logger))

  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  app.useGlobalFilters(new GlobalExceptionFilter())
  // CorrelationIdInterceptor 는 LoggingInterceptor 이전에 실행되어
  // 로그 라인까지 correlation-id 가 전파되어야 한다.
  app.useGlobalInterceptors(new CorrelationIdInterceptor(), new LoggingInterceptor())

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Nuxia API')
    .setDescription('Nuxia commerce + 3-generation referral backend')
    .setVersion('0.0.1')
    .addBearerAuth()
    .addTag('auth')
    .addTag('user')
    .addTag('product')
    .addTag('cart')
    .addTag('order')
    .addTag('payment')
    .addTag('referral')
    .addTag('payout')
    .addTag('webhook')
    .addTag('admin')
    .build()
  const doc = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api-docs', app, doc)

  const port = Number(process.env.PORT ?? 4000)
  await app.listen(port, '0.0.0.0')
  // eslint-disable-next-line no-console
  console.log(`[nuxia/api] listening on :${port}`)
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('bootstrap failed', e)
  process.exit(1)
})
