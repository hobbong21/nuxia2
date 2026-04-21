import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ProductService } from './product.service'

@ApiTags('product')
@Controller('products')
export class ProductController {
  constructor(private readonly svc: ProductService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list({ q, category, cursor, limit: limit ? Number(limit) : undefined })
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.svc.getById(id)
  }
}
