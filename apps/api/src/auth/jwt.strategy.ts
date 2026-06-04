import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
          if (req?.cookies?.accessToken) {
            return req.cookies.accessToken;
          }
          return null;
        },
      ]),
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; tv: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, tokenVersion: true, suspendedAt: true },
    });

    if (!user || user.tokenVersion !== payload.tv || user.suspendedAt) {
      throw new UnauthorizedException('Invalid token');
    }

    return { id: payload.sub };
  }
}
