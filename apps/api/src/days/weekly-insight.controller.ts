import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { WeeklyInsightService } from '../daily/weekly-insight.service';
import { parseListPagination } from '../common/parse-list-pagination';

@Controller('day/weekly-insight')
@UseGuards(JwtAuthGuard)
export class WeeklyInsightController {
  constructor(private readonly weeklyInsight: WeeklyInsightService) {}

  @Get('latest')
  getLatest(@Req() req) {
    return this.weeklyInsight.getLatestForUser(req.user.id);
  }

  @Get()
  list(@Req() req, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const { limit: parsedLimit, offset: parsedOffset } = parseListPagination(limit, offset);
    return this.weeklyInsight.listForUser(req.user.id, {
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  @Post('generate')
  generate(@Req() req) {
    return this.weeklyInsight.generateForUser(req.user.id, { source: 'MANUAL' });
  }
}
