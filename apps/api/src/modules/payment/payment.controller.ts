import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { JwtAuthGuard } from '../../common/guards/auth.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { PaymentService } from './payment.service'

export const ConfirmPaymentSchema = z.object({
  paymentId: z.string().min(1),
})
export type ConfirmPaymentDto = z.infer<typeof ConfirmPaymentSchema>

@ApiTags('payment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly svc: PaymentService) {}

  @Post('orders/:orderId/confirm')
  confirm(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(ConfirmPaymentSchema)) body: ConfirmPaymentDto,
  ) {
    return this.svc.confirm(req.user.userId, orderId, body.paymentId)
  }
}
