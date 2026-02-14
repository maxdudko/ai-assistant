import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ConversationMode } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';

import { LogsService } from './logs.service';

@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  findAll(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('mode') mode?: ConversationMode,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.logsService.findAll(req.user.id, pageNum, limitNum, mode);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.logsService.findOne(req.user.id, id);
  }
}
