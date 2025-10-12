import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';

@Controller('protected')
@UseGuards(RolesGuard)
export class ProtectedController {
  @Get('user-only')
  @Roles(UserRole.USER, UserRole.ADMIN)
  getUserData(@CurrentUser() user: User) {
    return {
      message: 'This is protected user data',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  @Get('admin-only')
  @Roles(UserRole.ADMIN)
  getAdminData(@CurrentUser() user: User) {
    return {
      message: 'This is admin-only data',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  @Post('any-authenticated')
  createSomething(@CurrentUser() user: User) {
    return {
      message: 'Created successfully',
      createdBy: user.email,
    };
  }
}