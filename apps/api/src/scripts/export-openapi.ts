/**
 * OpenAPI spec export (standalone).
 *
 * Generates `openapi.json` at the api package root by booting the Nest
 * application in memory and serializing the Swagger document.
 *
 * Usage:
 *   pnpm --filter @nuxia/api exec tsx src/scripts/export-openapi.ts
 *
 * Note: this does not start an HTTP listener. Required env vars
 * (JWT_SECRET / DATABASE_URL / PORTONE_API_SECRET) must still be present
 * because `AppModule` reuses the runtime `assertRequiredEnv` guard.
 */
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AppModule } from '../app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false })

  const config = new DocumentBuilder()
    .setTitle('Nuxia2 API')
    .setDescription('3-gen referral commerce hybrid backend')
    .setVersion('0.1.0')
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

  const document = SwaggerModule.createDocument(app, config)
  const outPath = join(process.cwd(), 'openapi.json')
  writeFileSync(outPath, JSON.stringify(document, null, 2))

  // eslint-disable-next-line no-console
  console.log(`[nuxia/api] OpenAPI spec exported to ${outPath}`)
  await app.close()
  process.exit(0)
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[nuxia/api] export-openapi failed', err)
  process.exit(1)
})
