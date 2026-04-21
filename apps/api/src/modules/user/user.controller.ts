import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/auth.guard'
import { UserService } from './user.service'

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.users.getMe(req.user.userId)
  }

  @Post('me/withdraw')
  withdraw(@Req() req: any) {
    return this.users.withdraw(req.user.userId)
  }
}
