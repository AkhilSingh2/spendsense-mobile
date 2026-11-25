import { isCategoryId } from '@/domain/categories';
import {
  addDays,
  monthIndex,
  monthKey,
  previousWeekday,
  todayISO,
} from '@/domain/dates';
import { isCurrencyCode, toMinor } from '@/domain/money';
import type { Cadence, TransactionType } from '@/domain/types';

export type ParseContext = {
  today?: string;
  homeCurrency?: string;
  now?: Date;
};

export type ParsedExpense = {
  amountMinor: number;
  currency: string;
  type: TransactionType;
  categoryId: string;
  note: string;
  merchant: string;
  occurredOn: string;
  cadence: Cadence | null;
  confidence: number;
  interpretation: string;
};

const MERCHANTS: { name: string; categoryId: string; words: string[] }[] = [
  { name: 'Swiggy', categoryId: 'food', words: ['swiggy'] },
  { name: 'Zomato', categoryId: 'food', words: ['zomato'] },
  { name: 'Uber', categoryId: 'transport', words: ['uber'] },
  { name: 'Ola', categoryId: 'transport', words: ['ola'] },
  { name: 'Rapido', categoryId: 'transport', words: ['rapido'] },
  { name: 'BigBasket', categoryId: 'groceries', words: ['bigbasket', 'big basket'] },
  { name: 'Blinkit', categoryId: 'groceries', words: ['blinkit'] },
  { name: 'Zepto', categoryId: 'groceries', words: ['zepto'] },
  { name: 'Amazon', categoryId: 'shopping', words: ['amazon'] },
  { name: 'Flipkart', categoryId: 'shopping', words: ['flipkart'] },
  { name: 'Netflix', categoryId: 'subscriptions', words: ['netflix'] },
  { name: 'Spotify', categoryId: 'subscriptions', words: ['spotify'] },
  { name: 'Airtel', categoryId: 'utilities', words: ['airtel'] },
  { name: 'Jio', categoryId: 'utilities', words: ['jio'] },
  { name: 'BookMyShow', categoryId: 'entertainment', words: ['bookmyshow', 'book my show'] },
  { name: 'Figma', categoryId: 'subscriptions', words: ['figma'] },
];

const CATEGORY_WORDS: { id: string; words: string[] }[] = [
  { id: 'subscriptions', words: ['netflix', 'spotify', 'prime', 'hotstar', 'icloud', 'subscription', 'figma'] },
  { id: 'groceries', words: ['grocery', 'groceries', 'bigbasket', 'blinkit', 'zepto', 'vegetables', 'dmart'] },
  { id: 'food', words: ['lunch', 'dinner', 'breakfast', 'brunch', 'coffee', 'tea', 'zomato', 'swiggy', 'restaurant', 'cafe', 'food', 'snack', 'biryani'] },
  { id: 'transport', words: ['uber', 'ola', 'metro', 'cab', 'fuel', 'petrol', 'rapido', 'auto', 'bus', 'train'] },
  { id: 'housing', words: ['rent', 'landlord', 'housing', 'maintenance', 'society'] },
  { id: 'utilities', words: ['electricity', 'wifi', 'broadband', 'water', 'recharge', 'airtel', 'jio', 'bill', 'power'] },
  { id: 'shopping', words: ['amazon', 'flipkart', 'myntra', 'shopping', 'clothes', 'shoes'] },
  { id: 'health', words: ['doctor', 'medical', 'pharmacy', 'gym', 'hospital', 'medicine'] },
  { id: 'entertainment', words: ['movie', 'concert', 'game', 'bookmyshow'] },
  { id: 'travel', words: ['flight', 'hotel', 'airbnb', 'trip', 'irctc'] },
  { id: 'education', words: ['course', 'udemy', 'tuition', 'book', 'class'] },
  { id: 'personal', words: ['haircut', 'gift', 'personal'] },
  { id: 'income', words: ['salary', 'paycheck', 'payroll', 'freelance', 'stipend', 'bonus'] },
];

const FILLER = new Set([
  'spent',
  'spend',
  'paid',
  'pay',
  'bought',
  'purchase',
  'purchased',
  'for',
  'on',
  'a',
  'an',
  'the',
  'to',
  'my',
  'of',
  'rupees',
  'rupee',
  'rs',
  'inr',
  'usd',
  'eur',
  'gbp',
  'dollars',
  'dollar',
  'bucks',
  'buck',
  'euros',
  'euro',
  'pounds',
  'pound',
  'yen',
]);

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/₹/g, ' inr ')
    .replace(/\$/g, ' usd ')
    .replace(/€/g, ' eur ')
    .replace(/£/g, ' gbp ')
    .replace(/¥/g, ' jpy ')
    .replace(/[–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type AmountHit = { value: number; raw: string; currency?: string; suffix: boolean };

function findAmounts(text: string): AmountHit[] {
  const pattern = /(?:\b(inr|usd|eur|gbp|aed|sgd|jpy|aud|cad|rs\.?)\s*)?(\d[\d,]*(?:\.\d+)?)(\s*(?:k|thousand|lakh|lac|l)\b)?/gi;
  const hits: AmountHit[] = [];
  for (const match of text.matchAll(pattern)) {
    const rawNumber = match[2] ?? '';
    const numeric = Number(rawNumber.replace(/,/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    const suffix = (match[3] ?? '').trim().toLowerCase();
    let value = numeric;
    if (suffix === 'k' || suffix === 'thousand') value *= 1000;
    if (suffix === 'lakh' || suffix === 'lac' || suffix === 'l') value *= 100000;
    const code = (match[1] ?? '').replace('.', '').toUpperCase();
    const currency = code === 'RS' ? 'INR' : isCurrencyCode(code) ? code : undefined;
    hits.push({ value, raw: match[0], currency, suffix: Boolean(suffix) });
  }
  return hits;
}

function pickAmount(hits: AmountHit[]): AmountHit | null {
  if (hits.length === 0) return null;
  const suffixed = hits.find((hit) => hit.suffix);
  if (suffixed) return suffixed;
  const withCurrency = hits.find((hit) => hit.currency);
  if (withCurrency) return withCurrency;
  return hits.reduce((best, hit) => (hit.value > best.value ? hit : best));
}

function detectCurrency(text: string, fallback: string): string {
  if (/inr|rupee|₹|\brs\b/.test(text)) return 'INR';
  if (/\busd\b|dollar|bucks?\b/.test(text)) return 'USD';
  if (/\beur\b|euros?\b/.test(text)) return 'EUR';
  if (/\bgbp\b|pounds?\b/.test(text)) return 'GBP';
  if (/\baed\b|dirhams?\b/.test(text)) return 'AED';
  if (/\bsgd\b/.test(text)) return 'SGD';
  if (/\bjpy\b|\byen\b/.test(text)) return 'JPY';
  if (/\baud\b/.test(text)) return 'AUD';
  if (/\bcad\b/.test(text)) return 'CAD';
  return isCurrencyCode(fallback) ? fallback : 'INR';
}

function findDate(text: string, today: string): { iso: string; raw: string } | null {
  if (/\bday before yesterday\b/.test(text)) {
    return { iso: addDays(today, -2), raw: 'day before yesterday' };
  }
  if (/\byesterday\b/.test(text)) return { iso: addDays(today, -1), raw: 'yesterday' };
  if (/\btoday\b|\bthis morning\b|\btonight\b/.test(text)) {
    const raw = text.match(/\b(today|this morning|tonight)\b/)?.[0] ?? 'today';
    return { iso: today, raw };
  }
  const last = text.match(/\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (last?.[1]) return { iso: previousWeekday(today, last[1], true), raw: last[0] };
  const weekday = text.match(/\b(?:on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (weekday?.[1]) return { iso: previousWeekday(today, weekday[1], false), raw: weekday[0] };
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso?.[1]) return { iso: iso[1], raw: iso[1] };
  const dmy = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?\b/);
  if (dmy?.[1] && dmy[2]) {
    const month = monthIndex(dmy[2]);
    const year = dmy[3] ? Number(dmy[3]) : Number(today.slice(0, 4));
    const day = Math.min(Number(dmy[1]), 31);
    if (month >= 0) {
      const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { iso: isoDate, raw: dmy[0] };
    }
  }
  return null;
}

function includesWord(text: string, word: string): boolean {
  if (word.includes(' ')) return text.includes(word);
  return new RegExp(`\\b${word}\\b`).test(text);
}

function findMerchant(text: string): { name: string; categoryId: string; raw: string } | null {
  for (const merchant of MERCHANTS) {
    for (const word of merchant.words) {
      if (includesWord(text, word)) return { name: merchant.name, categoryId: merchant.categoryId, raw: word };
    }
  }
  return null;
}

function findCategory(text: string): string | null {
  const ranked = CATEGORY_WORDS.flatMap((entry) => entry.words.map((word) => ({ id: entry.id, word })))
    .sort((a, b) => b.word.length - a.word.length);
  for (const entry of ranked) {
    const pattern = new RegExp(`\\b${entry.word.replace(/\s+/g, '\\s+')}\\b`);
    if (pattern.test(text)) return entry.id;
  }
  return null;
}

function findCadence(text: string): Cadence | null {
  if (/\b(every\s+day|daily)\b/.test(text)) return 'daily';
  if (/\b(every\s+week|weekly)\b/.test(text)) return 'weekly';
  if (/\b(every\s+year|yearly|annually)\b/.test(text)) return 'yearly';
  if (/\b(every\s+month|each\s+month|monthly)\b/.test(text)) return 'monthly';
  return null;
}

function cleanNote(text: string, removals: string[]): string {
  let note = ` ${text} `;
  for (const removal of removals) {
    if (!removal) continue;
    note = note.replace(removal, ' ');
  }
  const words = note
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word && !FILLER.has(word));
  const sentence = words.join(' ').replace(/\s+/g, ' ').trim();
  if (!sentence) return '';
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function parseWithRules(input: string, ctx: ParseContext = {}): ParsedExpense | null {
  const today = ctx.today ?? todayISO(ctx.now ?? new Date());
  const home = ctx.homeCurrency ?? 'INR';
  const text = normalizeText(input);
  if (!text) return null;

  const date = findDate(text, today);
  const withoutDate = date ? text.replace(date.raw, ' ') : text;
  const amount = pickAmount(findAmounts(withoutDate));
  if (!amount) return null;

  const currency = amount.currency ?? detectCurrency(text, home);
  const merchant = findMerchant(text);
  const categoryFromWords = findCategory(text);
  const categoryId = categoryFromWords && isCategoryId(categoryFromWords)
    ? categoryFromWords
    : merchant?.categoryId ?? 'other';
  const incomeHit = /\b(salary|paycheck|payroll|freelance|refund|stipend|bonus|income)\b/.test(text);
  const type: TransactionType = incomeHit && categoryId !== 'food' ? 'income' : categoryId === 'income' ? 'income' : 'expense';
  const cadence = findCadence(text);
  const note = cleanNote(text, [amount.raw, date?.raw ?? '', merchant?.raw ?? '', 'monthly', 'weekly', 'daily', 'yearly']);
  const resolvedCategory = type === 'income' ? 'income' : categoryId === 'income' ? 'other' : categoryId;
  const finalNote = note || (merchant?.name ?? '');

  let confidence = 0.56;
  if (resolvedCategory !== 'other') confidence += 0.2;
  if (date) confidence += 0.12;
  if (merchant) confidence += 0.08;
  confidence = Math.min(0.96, confidence);

  const interpretation = [
    `${amount.value} ${currency}`,
    type,
    resolvedCategory,
    date ? date.iso : today,
    finalNote,
  ].join(' · ');

  return {
    amountMinor: toMinor(amount.value, currency),
    currency,
    type,
    categoryId: resolvedCategory,
    note: finalNote,
    merchant: merchant?.name ?? '',
    occurredOn: date?.iso ?? today,
    cadence,
    confidence,
    interpretation,
  };
}

export function monthOf(iso: string): string {
  return monthKey(iso);
}
