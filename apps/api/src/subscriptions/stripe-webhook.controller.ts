import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';

import type { StripeWebhookRequest } from './stripe.types';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('subscriptions')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly webhooks: StripeWebhookService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: StripeWebhookRequest,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException(
        'Webhook requires raw body. Ensure Nest is started with { rawBody: true }.',
      );
    }

    let event;
    try {
      event = this.stripe.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException('Invalid Stripe webhook signature.');
    }

    await this.webhooks.handleEvent(event);
    return { received: true };
  }
}
