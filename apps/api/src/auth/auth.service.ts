import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private static readonly ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
  private static readonly REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(email: string, password: string) {
    if (!email || !password) {
      throw new ConflictException('Email and password are required');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {}, // 👈 UserProfile
        },
      },
      include: { profile: true },
    });

    return user;
  }

  async validateUser(email: string, password: string) {
    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  signTokens(userId: string, tokenVersion: number) {
    const payload = { sub: userId, tv: tokenVersion };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: AuthService.ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshToken = this.jwt.sign(payload, {
      expiresIn: AuthService.REFRESH_TOKEN_TTL_SECONDS,
    });

    return { accessToken, refreshToken };
  }

  async storeRefreshTokenHash(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  async refreshTokens(refreshToken: string) {
    let payload: { sub: string; tv: number };
    try {
      payload = this.jwt.verify<{ sub: string; tv: number }>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        tokenVersion: true,
        refreshTokenHash: true,
      },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tv !== user.tokenVersion) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValidRefreshToken = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValidRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = this.signTokens(user.id, user.tokenVersion);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
        tokenVersion: { increment: 1 },
      },
    });
  }

  getAccessTokenMaxAgeMs() {
    return AuthService.ACCESS_TOKEN_TTL_SECONDS * 1000;
  }

  getRefreshTokenMaxAgeMs() {
    return AuthService.REFRESH_TOKEN_TTL_SECONDS * 1000;
  }
}
