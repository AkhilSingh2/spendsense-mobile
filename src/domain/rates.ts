import { fromMinor, toMinor } from '@/domain/money';

/**
 * Indicative units of INR per 1 major unit of each currency.
 * Bundled so conversion works offline. These are planning rates, not a live feed.
 * Labeled in the product as November 2026 estimates.
 */
export const INR_PER_UNIT: Record<string, number> = {
  INR: 1,
  USD: 84.2,
  EUR: 91.5,
  GBP: 108.4,
  AED: 22.9,
  SGD: 63.1,
  JPY: 0.56,
  AUD: 54.8,
  CAD: 60.4,
};

export const RATE_LABEL = 'Indicative rates, November 2026';

export function convertMinor(amountMinor: number, from: string, to: string): number {
  if (from === to) return amountMinor;
  const fromRate = INR_PER_UNIT[from];
  const toRate = INR_PER_UNIT[to];
  if (!fromRate || !toRate) return amountMinor;
  const inInr = fromMinor(amountMinor, from) * fromRate;
  const target = inInr / toRate;
  return toMinor(target, to);
}
