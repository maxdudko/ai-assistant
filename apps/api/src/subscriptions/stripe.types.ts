import type { Request } from 'express';

export interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}
