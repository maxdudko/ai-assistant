import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt.guard';

import { FeatureAccessService } from './feature-access.service';
import { PLAN_CATALOG } from './plan-entitlements';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly featureAccess: FeatureAccessService,
    private readonly stripe: StripeService,
  ) {}

  @Get('me')
  async getMe(@Req() req) {
    const subscription = await this.subscriptions.getOrCreateForUser(req.user.id);
    const features = await this.featureAccess.listEnabledFeatures(req.user.id);

    return {
      subscription: this.subscriptions.toSummary(subscription),
      features,
      plans: PLAN_CATALOG,
      stripeConfigured: this.stripe.isConfigured(),
    };
  }

  @Post('checkout')
  createCheckout(@Req() req) {
    return this.stripe.createCheckoutSession(req.user.id);
  }

  @Post('billing-portal')
  createBillingPortal(@Req() req) {
    return this.stripe.createBillingPortalSession(req.user.id);
  }
}
