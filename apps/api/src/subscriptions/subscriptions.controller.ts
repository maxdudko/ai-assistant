import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';

import { FeatureAccessService } from './feature-access.service';
import { PLAN_CATALOG } from './plan-entitlements';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly featureAccess: FeatureAccessService,
  ) {}

  @Get('me')
  async getMe(@Req() req) {
    const subscription = await this.subscriptions.getOrCreateForUser(req.user.id);
    const features = await this.featureAccess.listEnabledFeatures(req.user.id);

    return {
      subscription: this.subscriptions.toSummary(subscription),
      features,
      plans: PLAN_CATALOG,
    };
  }
}
