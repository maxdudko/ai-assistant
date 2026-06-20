import { BadRequestException, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';

import { readStripeSignatureHeader, type StripeWebhookRequest } from './stripe.types';
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
  async handleWebhook(@Req() req: StripeWebhookRequest) {
    const rawBody = req.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException(
        'Webhook requires raw body. Ensure Nest is started with { rawBody: true }.',
      );
    }

    const signature = readStripeSignatureHeader(req);
    if (!signature) {
      const userAgent = req.headers['user-agent'] ?? 'unknown';
      this.logger.warn(
        `Rejected webhook without Stripe-Signature (user-agent: ${userAgent}). ` +
          'Use `stripe listen --forward-to localhost:4000/api/subscriptions/webhook` for local dev.',
      );
    }

    let event;
    try {
      event = this.stripe.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn(
        `Stripe webhook rejected: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }

    await this.webhooks.handleEvent(event);
    return { received: true };
  }
}
