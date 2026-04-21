import { Module } from '@nestjs/common'
import { PayoutModule } from '../payout/payout.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  imports: [PayoutModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
