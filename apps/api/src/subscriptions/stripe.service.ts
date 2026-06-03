import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';

import { PrismaService } from '../prisma/prisma.service';

import { assertProPriceId, loadStripeConfig } from './stripe.config';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripeClient: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  isConfigured(): boolean {
    return loadStripeConfig() !== null;
  }

  private getStripe(): Stripe {
    const config = loadStripeConfig();
    if (!config) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY and related environment variables.',
      );
    }

    if (!this.stripeClient) {
      this.stripeClient = new Stripe(config.secretKey);
    }

    return this.stripeClient;
  }

  async createCheckoutSession(userId: string): Promise<{ url: string }> {
    const config = loadStripeConfig();
    if (!config) {
      throw new ServiceUnavailableException('Stripe is not configured.');
    }

    try {
      assertProPriceId(config.proPriceId);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid STRIPE_PRO_PRICE_ID.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user?.email) {
      throw new BadRequestException('User email is required for checkout.');
    }

    const subscription = await this.subscriptions.getOrCreateForUser(userId);
    if (this.subscriptions.hasActivePaidPlan(subscription)) {
      throw new BadRequestException('You already have an active Pro subscription.');
    }

    const stripe = this.getStripe();
    const customerId = await this.getOrCreateStripeCustomer(userId, user.email, subscription);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: config.proPriceId, quantity: 1 }],
      success_url: config.checkoutSuccessUrl,
      cancel_url: config.checkoutCancelUrl,
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
    });

    if (!session.url) {
      this.logger.error(`Checkout session ${session.id} missing url for user ${userId}`);
      throw new ServiceUnavailableException('Failed to create checkout session.');
    }

    return { url: session.url };
  }

  async createBillingPortalSession(userId: string): Promise<{ url: string }> {
    const config = loadStripeConfig();
    if (!config) {
      throw new ServiceUnavailableException('Stripe is not configured.');
    }

    const subscription = await this.subscriptions.getOrCreateForUser(userId);
    if (!subscription.stripeCustomerId) {
      throw new BadRequestException('No billing account found. Subscribe to Pro first.');
    }

    const stripe = this.getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: config.billingPortalReturnUrl,
    });

    return { url: session.url };
  }

  retrieveSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
    return this.getStripe().subscriptions.retrieve(stripeSubscriptionId);
  }

  async listInvoicesForCustomer(stripeCustomerId: string): Promise<Stripe.Invoice[]> {
    const stripe = this.getStripe();
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 24,
    });
    return invoices.data;
  }

  constructWebhookEvent(payload: Buffer, signature: string | string[] | undefined): Stripe.Event {
    const config = loadStripeConfig();
    if (!config) {
      throw new ServiceUnavailableException('Stripe webhook is not configured.');
    }

    if (!signature || Array.isArray(signature)) {
      throw new BadRequestException('Missing Stripe signature header.');
    }

    return this.getStripe().webhooks.constructEvent(payload, signature, config.webhookSecret);
  }

  private async getOrCreateStripeCustomer(
    userId: string,
    email: string,
    subscription: { stripeCustomerId: string | null },
  ): Promise<string> {
    if (subscription.stripeCustomerId) {
      return subscription.stripeCustomerId;
    }

    const stripe = this.getStripe();
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });

    await this.subscriptions.attachStripeCustomerId(userId, customer.id);
    return customer.id;
  }
}
