import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          if (req?.cookies?.adminAccessToken) {
            return req.cookies.adminAccessToken;
          }
          return null;
        },
      ]),
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; tv: number; scope?: string }) {
    if (payload.scope !== 'admin') {
      throw new UnauthorizedException('Invalid token');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, tokenVersion: true },
    });

    if (!admin || admin.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Invalid token');
    }

    return { id: admin.id };
  }
}
