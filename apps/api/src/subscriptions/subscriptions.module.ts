import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { FeatureAccessService } from './feature-access.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeService } from './stripe.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController, StripeWebhookController],
  providers: [
    SubscriptionsService,
    FeatureAccessService,
    StripeService,
    StripeWebhookService,
  ],
  exports: [SubscriptionsService, FeatureAccessService, StripeService],
})
export class SubscriptionsModule {}
