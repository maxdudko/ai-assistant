import { randomBytes } from 'crypto';

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
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

  private static readonly PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Do not reveal whether the email exists
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + AuthService.PASSWORD_RESET_EXPIRY_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpires: expiresAt,
      },
    });

    const baseUrl = process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000';
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

    // In development, log the link so it can be used for testing. In production, send via email.
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Password reset] Link for', email, ':', resetLink);
    }
    // TODO: In production, send resetLink via your email provider (e.g. Nodemailer, Resend).
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    const users = await this.prisma.user.findMany({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpires: { gt: new Date() },
      },
    });

    let matchedUser: (typeof users)[0] | null = null;
    for (const u of users) {
      if (u.passwordResetToken && (await bcrypt.compare(token, u.passwordResetToken))) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
