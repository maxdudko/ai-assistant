import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';

import { PrismaService } from '../prisma/prisma.service';

type PushPayload = {
  title: string;
  body: string;
  deepLink?: string;
  notificationId?: string;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:support@ai-assistant.local';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
    } else {
      this.configured = false;
      this.logger.warn('VAPID keys are not configured; web push delivery is disabled');
    }
  }

  getPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
    if (!this.configured) {
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload),
        );
        sent += 1;
        await this.prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { lastUsedAt: new Date() },
        });
      } catch (error) {
        failed += 1;
        const statusCode =
          error && typeof error === 'object' && 'statusCode' in error
            ? Number((error as { statusCode?: number }).statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(subscription.endpoint);
        }
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Push failed for user ${userId}: ${reason}`);
      }
    }

    if (staleEndpoints.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: {
          userId,
          endpoint: { in: staleEndpoints },
        },
      });
    }

    return { sent, failed };
  }
}
