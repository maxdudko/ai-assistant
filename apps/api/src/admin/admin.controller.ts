import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminService } from './admin.service';
import { ChangeAdminPasswordDto } from './dto/change-admin-password.dto';
import { UpdateAdminEmailDto } from './dto/update-admin-email.dto';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return {};
  }

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/suspend')
  suspendUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.suspendUser(id);
  }

  @Patch('users/:id/unsuspend')
  unsuspendUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.unsuspendUser(id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.adminService.listSubscriptions();
  }

  @Patch('profile/email')
  updateEmail(@Req() req, @Body() dto: UpdateAdminEmailDto) {
    return this.adminService.updateEmail(req.user.id, dto.email);
  }

  @Patch('profile/password')
  async changePassword(@Req() req, @Body() dto: ChangeAdminPasswordDto) {
    await this.adminService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
    return { message: 'Password has been updated.' };
  }
}
