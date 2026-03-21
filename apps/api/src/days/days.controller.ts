import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';

import { DaysService } from './days.service';

@Controller('day')
@UseGuards(JwtAuthGuard)
export class DaysController {
  constructor(private readonly daysService: DaysService) {}

  @Get('today')
  getToday(@Req() req) {
    return this.daysService.getToday(req.user.id);
  }

  @Post('start')
  start(@Req() req) {
    return this.daysService.start(req.user.id);
  }

  @Post('end')
  end(@Req() req) {
    return this.daysService.end(req.user.id);
  }

  @Get('summary')
  getSummary(@Req() req) {
    return this.daysService.getSummary(req.user.id);
  }

  @Get('morning-briefing')
  getMorningBriefing(@Req() req) {
    return this.daysService.getMorningBriefing(req.user.id);
  }
}
