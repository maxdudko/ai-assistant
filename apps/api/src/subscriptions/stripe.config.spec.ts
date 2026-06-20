import { assertProPriceId } from './stripe.config';

describe('assertProPriceId', () => {
  it('accepts a price id', () => {
    expect(() => assertProPriceId('price_123')).not.toThrow();
  });

  it('rejects a product id with a helpful message', () => {
    expect(() => assertProPriceId('prod_abc')).toThrow(/Price ID \(price_\.\.\.\)/);
  });

  it('rejects unknown id prefixes', () => {
    expect(() => assertProPriceId('plan_abc')).toThrow(/must be a Stripe Price ID/);
  });
});
