import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto.email, dto.password);
    const tokens = this.auth.signTokens(user.id, user.tokenVersion);
    await this.auth.storeRefreshTokenHash(user.id, tokens.refreshToken);

    this.setCookies(res, tokens);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    const tokens = this.auth.signTokens(user.id, user.tokenVersion);
    await this.auth.storeRefreshTokenHash(user.id, tokens.refreshToken);

    this.setCookies(res, tokens);
    return { user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokens = await this.auth.refreshTokens(refreshToken);
    this.setCookies(res, tokens);
    return { message: 'Tokens refreshed' };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.user.id);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(dto.email);
    return {
      message: 'If an account exists with this email, you will receive a password reset link.',
    };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset. You can now sign in.' };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
    return { message: 'Password has been updated.' };
  }

  private setCookies(res: Response, tokens) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: this.auth.getAccessTokenMaxAgeMs(),
      path: '/', // Ensure cookie is available for all paths
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: this.auth.getRefreshTokenMaxAgeMs(),
      path: '/', // Ensure cookie is available for all paths
    });
  }
}
