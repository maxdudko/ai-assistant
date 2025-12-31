import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          if (req?.cookies?.accessToken) {
            return req.cookies.accessToken;
          }
          return null;
        },
      ]),
      secretOrKey: 'dev-secret',
    });
  }

  async validate(payload: { sub: string }) {
    return { id: payload.sub };
  }
}
