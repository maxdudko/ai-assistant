import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }

  update(userId: string, dto: { email?: string; profile?: Partial<any> }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        profile: {
          update: dto.profile,
        },
      },
      include: { profile: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  createUser(email: string, passwordHash: string) {
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: { create: {} },
      },
    });
  }
}
