import { parseWithRules } from '@/parse/rules';
import { MockLlmClient, coerceModelPayload, parseExpense } from '@/parse/llm';
import { replaceSpokenNumbers } from '@/parse/numberWords';

const ctx = { today: '2026-11-25', homeCurrency: 'INR' };

describe('natural language expenses', () => {
  test('reads the portfolio example', () => {
    const parsed = parseWithRules('450 lunch with team yesterday', ctx);
    expect(parsed).toMatchObject({
      amountMinor: 45000,
      currency: 'INR',
      categoryId: 'food',
      occurredOn: '2026-11-24',
      note: 'Lunch with team',
    });
  });

  test.each([
    ['₹1,200 uber to airport', 120000, 'INR', 'transport', 'Uber'],
    ['$15 figma today', 1500, 'USD', 'subscriptions', 'Figma'],
    ['2.5k electricity bill', 250000, 'INR', 'utilities', ''],
    ['649 netflix monthly', 64900, 'INR', 'subscriptions', 'Netflix'],
    ['185000 salary yesterday', 18500000, 'INR', 'income', ''],
  ])('parses %s', (input, amountMinor, currency, categoryId, merchant) => {
    const parsed = parseWithRules(input, ctx);
    expect(parsed?.amountMinor).toBe(amountMinor);
    expect(parsed?.currency).toBe(currency);
    expect(parsed?.categoryId).toBe(categoryId);
    expect(parsed?.merchant).toBe(merchant);
  });

  test('spoken amounts need the mock model, digits fall back to rules', async () => {
    expect(replaceSpokenNumbers('four hundred fifty lunch')).toBe('450 lunch');
    const throwing = { parse: async () => Promise.reject(new Error('offline')) };
    const words = await parseExpense('four hundred fifty lunch yesterday', ctx, throwing);
    expect(words.ok).toBe(false);
    const digits = await parseExpense('450 lunch yesterday', ctx, throwing);
    expect(digits.ok && digits.source).toBe('rules');
    const mock = await parseExpense('four hundred fifty lunch yesterday', ctx, new MockLlmClient());
    expect(mock.ok && mock.source).toBe('llm');
    if (mock.ok) expect(mock.expense.amountMinor).toBe(45000);
  });

  test('coerces a model payload and rejects a missing amount', () => {
    const parsed = coerceModelPayload(
      '{"amount":450,"currency":"INR","type":"expense","categoryId":"food","note":"Lunch","merchant":"","date":"2026-11-24","cadence":null}',
      ctx,
    );
    expect(parsed?.amountMinor).toBe(45000);
    expect(coerceModelPayload('{"amount":0}', ctx)).toBeNull();
  });
});
