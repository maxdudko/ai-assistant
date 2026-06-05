import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { parseListPagination } from '../common/parse-list-pagination';

import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  @Get('preferences')
  getPreferences(@Req() req) {
    return this.notifications.getPreferences(req.user.id);
  }

  @Patch('preferences')
  updatePreferences(@Req() req, @Body() body: UpdateNotificationPreferencesDto) {
    return this.notifications.updatePreferences(req.user.id, body);
  }

  @Get('push/public-key')
  getPublicKey() {
    return {
      publicKey: this.push.getPublicKey(),
      enabled: this.push.isConfigured(),
    };
  }

  @Post('push/subscribe')
  subscribePush(
    @Req() req,
    @Body() body: SubscribePushDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.notifications.subscribePush(req.user.id, {
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      userAgent,
    });
  }

  @Post('push/unsubscribe')
  unsubscribePush(@Req() req, @Body() body: UnsubscribePushDto) {
    return this.notifications.unsubscribePush(req.user.id, body.endpoint);
  }

  @Get()
  list(@Req() req, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.notifications.list(req.user.id, parseListPagination(limit, offset));
  }

  @Get('unread-count')
  unreadCount(@Req() req) {
    return this.notifications.getUnreadCount(req.user.id);
  }

  @Patch('read-all')
  markAllRead(@Req() req) {
    return this.notifications.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  markRead(@Req() req, @Param('id') id: string) {
    return this.notifications.markRead(req.user.id, id);
  }
}
