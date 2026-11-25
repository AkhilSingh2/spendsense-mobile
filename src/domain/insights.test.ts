import { buildInsights } from '@/domain/insights';
import { toMinor } from '@/domain/money';
import { emptySnapshot } from '@/domain/snapshot';
import type { Transaction } from '@/domain/types';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'x',
    type: partial.type ?? 'expense',
    amountMinor: partial.amountMinor ?? 0,
    currency: 'INR',
    categoryId: partial.categoryId ?? 'food',
    note: partial.note ?? 'Note',
    merchant: partial.merchant ?? '',
    occurredOn: partial.occurredOn ?? '2026-11-02',
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    receiptUri: null,
    recurringId: null,
    source: 'manual',
    deletedAt: null,
  };
}

describe('insights', () => {
  test('does not annualize rent when projecting the month', () => {
    const snapshot = {
      ...emptySnapshot('2026-11-01T00:00:00.000Z'),
      transactions: [
        tx({ id: 'rent', categoryId: 'housing', amountMinor: toMinor(28000, 'INR'), occurredOn: '2026-11-01', note: 'Rent' }),
        tx({ id: 'lunch', categoryId: 'food', amountMinor: toMinor(300, 'INR'), occurredOn: '2026-11-02', note: 'Lunch' }),
      ],
    };
    const insights = buildInsights(snapshot, '2026-11', '2026-11-02');
    expect(insights.spentMinor).toBe(toMinor(28300, 'INR'));
    expect(insights.projectedMinor).toBeLessThan(toMinor(40000, 'INR'));
    expect(insights.sentences[0]).toContain('Housing');
    expect(insights.byDay).toHaveLength(30);
  });

  test('compares against the previous month', () => {
    const snapshot = {
      ...emptySnapshot('2026-11-01T00:00:00.000Z'),
      transactions: [
        tx({ id: 'now', amountMinor: toMinor(100, 'INR'), occurredOn: '2026-11-03' }),
        tx({ id: 'then', amountMinor: toMinor(200, 'INR'), occurredOn: '2026-10-03' }),
      ],
    };
    const insights = buildInsights(snapshot, '2026-11', '2026-11-03');
    expect(insights.deltaRatio).toBeCloseTo(-0.5);
    expect(insights.sentences.some((line) => line.includes('under last month'))).toBe(true);
  });
});
