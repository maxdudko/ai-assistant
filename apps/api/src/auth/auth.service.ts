import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  login(email: string) {
    const payload = { sub: email };
    return {
      accessToken: this.jwt.sign(payload),
    };
  }
}
