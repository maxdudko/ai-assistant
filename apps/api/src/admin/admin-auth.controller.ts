import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AdminService } from './admin.service';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { LoginAdminDto } from './dto/login-admin.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginAdminDto, @Res({ passthrough: true }) res: Response) {
    const admin = await this.adminService.validateAdmin(dto.email, dto.password);
    const tokens = this.adminService.signTokens(admin.id, admin.tokenVersion);
    await this.adminService.storeRefreshTokenHash(admin.id, tokens.refreshToken);
    this.setCookies(res, tokens);
    return this.adminService.getMe(admin.id);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.adminRefreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokens = await this.adminService.refreshTokens(refreshToken);
    this.setCookies(res, tokens);
    return { message: 'Tokens refreshed' };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AdminJwtAuthGuard)
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    await this.adminService.logout(req.user.id);
    res.clearCookie('adminAccessToken');
    res.clearCookie('adminRefreshToken');
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(AdminJwtAuthGuard)
  me(@Req() req) {
    return this.adminService.getMe(req.user.id);
  }

  private setCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('adminAccessToken', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: this.adminService.getAccessTokenMaxAgeMs(),
      path: '/',
    });

    res.cookie('adminRefreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: this.adminService.getRefreshTokenMaxAgeMs(),
      path: '/',
    });
  }
}
