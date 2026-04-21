import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './common/filters/exception.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'

// BigInt → JSON serialization
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  })

  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  app.useGlobalFilters(new GlobalExceptionFilter())
  app.useGlobalInterceptors(new LoggingInterceptor())

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
