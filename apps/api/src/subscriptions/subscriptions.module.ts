import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { FeatureAccessService } from './feature-access.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, FeatureAccessService],
  exports: [SubscriptionsService, FeatureAccessService],
})
export class SubscriptionsModule {}
