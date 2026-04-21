import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './common/prisma.module'
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
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
  ],
})
export class AppModule {}
