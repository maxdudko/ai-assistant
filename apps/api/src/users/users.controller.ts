import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

import { UsersService } from './users.service';
// import {UserProfile} from "prisma-client-d8f236ca40e9724eb6f3a08c1777d2dc5817fc2f6d21f84575bf73a1b6579381";

@Controller('users')
export class UsersController {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req) {
    console.log('Authenticated user ID:', req.user.id);
    return this.usersService.me(req.user.id);
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
    return this.usersService.update(req.user.id, dto);
  }
}
