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
    // v0.2-N2: shared-types ProductListQuerySchema 와 일치시켜 categoryName 으로 통일.
    // 구 `category` 쿼리 파라미터는 당분간 하위호환으로 수용.
    @Query('categoryName') categoryName?: string,
    @Query('category') categoryLegacy?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list({
      q,
      categoryName: categoryName ?? categoryLegacy,
      cursor,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.svc.getById(id)
  }
}
