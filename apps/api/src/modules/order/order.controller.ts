import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ShippingAddressSchema } from '@nuxia2/shared-types'
import { JwtAuthGuard } from '../../common/guards/auth.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { OrderService } from './order.service'

// shared-types `CreateOrderRequestSchema` 호환. pointUsedKrw / couponDiscountKrw /
// shippingFeeKrw 는 BigIntString (decimal integer string) 으로 받되 number 도 허용.
const BigIntCoercion = z
  .union([z.string(), z.number()])
  .transform((v) => (v == null ? undefined : BigInt(v as any)))

// v0.2-N1: ShippingAddressSchema 는 @nuxia2/shared-types 에서 직접 import.

export const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        optionSummary: z.string().optional(),
      }),
    )
    .min(1),
  couponId: z.string().optional(),
  pointUsedKrw: BigIntCoercion.optional(),
  couponDiscountKrw: BigIntCoercion.optional(),
  shippingFeeKrw: BigIntCoercion.optional(),
  // shared-types 와 동기화: MVP는 optional, 구조는 ShippingAddressSchema 따름.
  shippingAddress: ShippingAddressSchema.optional(),
})
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>

@ApiTags('order')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly svc: OrderService) {}

  @Post()
  create(@Req() req: any, @Body(new ZodValidationPipe(CreateOrderSchema)) body: CreateOrderDto) {
    return this.svc.create({
      userId: req.user.userId,
      items: body.items,
      pointUsedKrw: body.pointUsedKrw as bigint | undefined,
      couponDiscountKrw: body.couponDiscountKrw as bigint | undefined,
      shippingFeeKrw: body.shippingFeeKrw as bigint | undefined,
      shippingAddress: body.shippingAddress,
    })
  }

  @Get()
  list(@Req() req: any) {
    return this.svc.listMine(req.user.userId)
  }

  @Get(':id')
  byId(@Req() req: any, @Param('id') id: string) {
    return this.svc.getById(req.user.userId, id)
  }

  @Post(':id/confirm-receipt')
  confirmReceipt(@Req() req: any, @Param('id') id: string) {
    return this.svc.confirmReceipt(req.user.userId, id)
  }
}
