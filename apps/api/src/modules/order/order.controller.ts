import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { JwtAuthGuard } from '../../common/guards/auth.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { OrderService } from './order.service'

export const CreateOrderSchema = z.object({
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().min(1) }))
    .min(1),
  // BigInt in JSON comes as string (we serialize to string).
  pointUsedKrw: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v == null ? undefined : BigInt(v as any))),
  discountKrw: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v == null ? undefined : BigInt(v as any))),
  shippingAddress: z.any().optional(),
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
    return this.svc.create({ ...body, userId: req.user.userId })
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
