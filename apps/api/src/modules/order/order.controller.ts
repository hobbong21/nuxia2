import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { JwtAuthGuard } from '../../common/guards/auth.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { OrderService } from './order.service'

// shared-types `CreateOrderRequestSchema` 호환. pointUsedKrw / couponDiscountKrw /
// shippingFeeKrw 는 BigIntString (decimal integer string) 으로 받되 number 도 허용.
const BigIntCoercion = z
  .union([z.string(), z.number()])
  .transform((v) => (v == null ? undefined : BigInt(v as any)))

// shared-types `ShippingAddressSchema` 와 동일 shape. BE 모노레포 import 파이프라인이
// 아직 연결되지 않아 로컬 복제. shared-types 변경 시 여기도 동기화 필요.
const ShippingAddressSchema = z.object({
  recipientName: z.string().min(1),
  phone: z.string().min(1),
  zipCode: z.string().min(1),
  address1: z.string().min(1),
  address2: z.string().default(''),
  memo: z.string().optional(),
})

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
