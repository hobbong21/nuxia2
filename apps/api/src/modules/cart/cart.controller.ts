import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/auth.guard'
import { CartService } from './cart.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

export const CartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(999),
})
export type CartItemDto = z.infer<typeof CartItemSchema>

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly svc: CartService) {}

  @Get()
  get(@Req() req: any) {
    return this.svc.getOrCreate(req.user.userId)
  }

  @Post('items')
  upsert(@Req() req: any, @Body(new ZodValidationPipe(CartItemSchema)) body: CartItemDto) {
    return this.svc.upsertItem(req.user.userId, body.productId, body.quantity)
  }

  @Delete('items/:productId')
  remove(@Req() req: any, @Param('productId') productId: string) {
    return this.svc.removeItem(req.user.userId, productId)
  }

  @Delete()
  clear(@Req() req: any) {
    return this.svc.clear(req.user.userId)
  }
}
