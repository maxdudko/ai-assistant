import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private static readonly ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
  private static readonly REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateAdmin(email: string, password: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return admin;
  }

  signTokens(adminId: string, tokenVersion: number) {
    const payload = { sub: adminId, tv: tokenVersion, scope: 'admin' as const };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: AdminService.ACCESS_TOKEN_TTL_SECONDS,
    });
    const refreshToken = this.jwt.sign(payload, {
      expiresIn: AdminService.REFRESH_TOKEN_TTL_SECONDS,
    });

    return { accessToken, refreshToken };
  }

  async storeRefreshTokenHash(adminId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { refreshTokenHash },
    });
  }

  async refreshTokens(refreshToken: string) {
    let payload: { sub: string; tv: number; scope?: string };
    try {
      payload = this.jwt.verify<{ sub: string; tv: number; scope?: string }>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.scope !== 'admin') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        tokenVersion: true,
        refreshTokenHash: true,
      },
    });

    if (!admin || !admin.refreshTokenHash || admin.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValidRefreshToken = await bcrypt.compare(refreshToken, admin.refreshTokenHash);
    if (!isValidRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = this.signTokens(admin.id, admin.tokenVersion);
    await this.storeRefreshTokenHash(admin.id, tokens.refreshToken);
    return tokens;
  }

  async logout(adminId: string) {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        refreshTokenHash: null,
        tokenVersion: { increment: 1 },
      },
    });
  }

  getAccessTokenMaxAgeMs() {
    return AdminService.ACCESS_TOKEN_TTL_SECONDS * 1000;
  }

  getRefreshTokenMaxAgeMs() {
    return AdminService.REFRESH_TOKEN_TTL_SECONDS * 1000;
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    return {
      ...admin,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };
  }

  async updateEmail(adminId: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const existing = await this.prisma.admin.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing && existing.id !== adminId) {
      throw new ConflictException('Email is already in use');
    }

    const admin = await this.prisma.admin.update({
      where: { id: adminId },
      data: { email: normalizedEmail },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });

    return {
      ...admin,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { passwordHash: true },
    });
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const isValidCurrentPassword = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isValidCurrentPassword) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash },
    });
  }

  private mapUserListItem(user: {
    id: string;
    email: string;
    suspendedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    profile: {
      displayName: string;
      timezone: string;
      onboardingCompleted: boolean;
    } | null;
    subscription: {
      plan: string;
      status: string;
      currentPeriodEnd: Date | null;
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      displayName: user.profile?.displayName ?? null,
      timezone: user.profile?.timezone ?? null,
      onboardingCompleted: Boolean(user.profile?.onboardingCompleted),
      subscriptionPlan: user.subscription?.plan ?? null,
      subscriptionStatus: user.subscription?.status ?? null,
      subscriptionPeriodEnd: user.subscription?.currentPeriodEnd?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            displayName: true,
            timezone: true,
            onboardingCompleted: true,
          },
        },
        subscription: {
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    return users.map(user => this.mapUserListItem(user));
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, suspendedAt: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.suspendedAt) {
      throw new BadRequestException('User is already suspended');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        suspendedAt: new Date(),
        refreshTokenHash: null,
        tokenVersion: { increment: 1 },
      },
      select: {
        id: true,
        email: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            displayName: true,
            timezone: true,
            onboardingCompleted: true,
          },
        },
        subscription: {
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    return this.mapUserListItem(updated);
  }

  async unsuspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, suspendedAt: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.suspendedAt) {
      throw new BadRequestException('User is not suspended');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: null },
      select: {
        id: true,
        email: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            displayName: true,
            timezone: true,
            onboardingCompleted: true,
          },
        },
        subscription: {
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    return this.mapUserListItem(updated);
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted successfully' };
  }

  async listSubscriptions() {
    const subscriptions = await this.prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return subscriptions.map(subscription => ({
      id: subscription.id,
      userId: subscription.userId,
      userEmail: subscription.user.email,
      plan: subscription.plan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      trialEnd: subscription.trialEnd?.toISOString() ?? null,
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    }));
  }
}
