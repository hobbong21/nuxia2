import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { PrismaModule } from './common/prisma.module'
import { buildLoggerConfig } from './common/logger/logger.config'
import { AuthModule } from './modules/auth/auth.module'
import { UserModule } from './modules/user/user.module'
import { ProductModule } from './modules/product/product.module'
import { CartModule } from './modules/cart/cart.module'
import { OrderModule } from './modules/order/order.module'
import { PaymentModule } from './modules/payment/payment.module'
import { ReferralModule } from './modules/referral/referral.module'
import { PayoutModule } from './modules/payout/payout.module'
import { WebhookModule } from './modules/webhook/webhook.module'
import { AdminModule } from './modules/admin/admin.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // v0.3 S1: pino 기반 구조화 로그. 개발=pretty, 프로덕션=JSON.
    LoggerModule.forRoot(buildLoggerConfig()),
    PrismaModule,
    AuthModule,
    UserModule,
    ProductModule,
    CartModule,
    OrderModule,
    PaymentModule,
    ReferralModule,
    PayoutModule,
    WebhookModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
