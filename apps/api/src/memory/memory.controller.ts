import { Controller, Get, Delete, Param, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';

import { MemoryService } from './memory.service';

@Controller('me/memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  findAll(@Req() req) {
    return this.memoryService.findAll(req.user.id);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.memoryService.remove(req.user.id, id);
  }
}
