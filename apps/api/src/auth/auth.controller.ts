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
