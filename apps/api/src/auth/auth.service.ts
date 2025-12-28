import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {PrismaService} from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  login(email: string) {
    const payload = { sub: email };
    return {
      accessToken: this.jwt.sign(payload),
    };
  }

  register(email: string, password: string) {

    console.log(email, password);
    return this.prisma.user.create({
      data: {
        email,
      },
    });
  }
}
