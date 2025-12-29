import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
// import {UserProfile} from "prisma-client-d8f236ca40e9724eb6f3a08c1777d2dc5817fc2f6d21f84575bf73a1b6579381";

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req) {
    return this.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { profile: true },
    });
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() req,
    @Body()
    dto: {
      email?: string;
      profile?: Partial<any>;
    },
  ) {
    return this.prisma.user.update({
      where: { id: req.user.id },
      data: {
        email: dto.email,
        profile: {
          update: dto.profile,
        },
      },
      include: { profile: true },
    });
  }
}
