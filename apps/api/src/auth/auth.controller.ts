import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto.email, dto.password);
    const tokens = this.auth.signTokens(user.id);

    this.setCookies(res, tokens);
    return { user };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    const tokens = this.auth.signTokens(user.id);

    this.setCookies(res, tokens);
    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  }

  private setCookies(res: Response, tokens) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/', // Ensure cookie is available for all paths
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/', // Ensure cookie is available for all paths
    });
  }
}
