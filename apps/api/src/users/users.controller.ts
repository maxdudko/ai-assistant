import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';

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
  update(@Req() req, @Body() dto: UpdateMeDto) {
    return this.usersService.update(req.user.id, dto);
  }
}
