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
    // v0.3-M4: shared-types `ProductListQuerySchema.categoryName` 과 완전 일치.
    // 구 `?category=` / `?categoryId=` 레거시 경로는 v0.3에서 제거됨.
    @Query('categoryName') categoryName?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list({
      q,
      categoryName,
      cursor,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.svc.getById(id)
  }
}
