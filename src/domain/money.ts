import type { CurrencyCode } from '@/domain/types';

export type CurrencyInfo = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  exponent: number;
  locale: string;
};

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  INR: { code: 'INR', name: 'Indian rupee', symbol: '₹', exponent: 2, locale: 'en-IN' },
  USD: { code: 'USD', name: 'US dollar', symbol: '$', exponent: 2, locale: 'en-US' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', exponent: 2, locale: 'en-IE' },
  GBP: { code: 'GBP', name: 'British pound', symbol: '£', exponent: 2, locale: 'en-GB' },
  AED: { code: 'AED', name: 'UAE dirham', symbol: 'AED', exponent: 2, locale: 'en-AE' },
  SGD: { code: 'SGD', name: 'Singapore dollar', symbol: 'S$', exponent: 2, locale: 'en-SG' },
  JPY: { code: 'JPY', name: 'Japanese yen', symbol: '¥', exponent: 0, locale: 'ja-JP' },
  AUD: { code: 'AUD', name: 'Australian dollar', symbol: 'A$', exponent: 2, locale: 'en-AU' },
  CAD: { code: 'CAD', name: 'Canadian dollar', symbol: 'C$', exponent: 2, locale: 'en-CA' },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function currencyInfo(code: string): CurrencyInfo {
  if (isCurrencyCode(code)) return CURRENCIES[code];
  return CURRENCIES.INR;
}

export function exponentOf(code: string): number {
  return currencyInfo(code).exponent;
}

export function toMinor(major: number, currency: string): number {
  const factor = 10 ** exponentOf(currency);
  return Math.round(major * factor);
}

export function fromMinor(minor: number, currency: string): number {
  const factor = 10 ** exponentOf(currency);
  return minor / factor;
}

export function formatMoney(
  minor: number,
  currency: string,
  options?: { signed?: boolean },
): string {
  const info = currencyInfo(currency);
  const major = fromMinor(minor, currency);
  const factor = 10 ** info.exponent;
  const hasFraction = info.exponent > 0 && Math.abs(minor) % factor !== 0;
  const formatted = new Intl.NumberFormat(info.locale, {
    style: 'currency',
    currency: info.code,
    minimumFractionDigits: hasFraction ? info.exponent : 0,
    maximumFractionDigits: info.exponent,
  }).format(major);
  if (options?.signed && minor > 0) return `+${formatted}`;
  return formatted;
}

export function parseAmountText(text: string, currency: string): number | null {
  const cleaned = text.replace(/,/g, '').trim();
  if (!cleaned || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return toMinor(value, currency);
}

export function firstName(name: string): string {
  const token = name.trim().split(/\s+/)[0];
  return token || 'there';
}
