import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';

import { DigestService } from './digest.service';
import { SubscribeDigestDto } from './dto/subscribe-digest.dto';
import { UnsubscribeDigestDto } from './dto/unsubscribe-digest.dto';

@Controller('digest')
@UseGuards(JwtAuthGuard)
export class DigestController {
  constructor(private readonly digestService: DigestService) {}

  @Post('subscriptions')
  async subscribe(@Req() req, @Body() body: SubscribeDigestDto) {
    return this.digestService.subscribe(req.user.id, body);
  }

  @Delete('subscriptions')
  async unsubscribe(@Req() req, @Body() body: UnsubscribeDigestDto) {
    return this.digestService.unsubscribe(req.user.id, body);
  }

  @Get('subscriptions')
  async listSubscriptions(@Req() req) {
    return this.digestService.listSubscriptions(req.user.id);
  }
}
