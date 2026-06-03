import type { Request } from 'express';

export interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

/** Read Stripe-Signature from Express headers (always lowercased). */
export function readStripeSignatureHeader(req: Request): string | undefined {
  const value = req.headers['stripe-signature'];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}
