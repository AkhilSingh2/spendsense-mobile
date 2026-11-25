import { alertsToFire, budgetLevel, budgetStatuses } from '@/domain/budgets';
import { emptySnapshot } from '@/domain/snapshot';
import { toMinor } from '@/domain/money';
import type { Budget, Transaction } from '@/domain/types';

function expense(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 't1',
    type: 'expense',
    amountMinor: partial.amountMinor ?? toMinor(100, 'INR'),
    currency: 'INR',
    categoryId: partial.categoryId ?? 'food',
    note: 'Lunch',
    merchant: '',
    occurredOn: partial.occurredOn ?? '2026-11-10',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    receiptUri: null,
    recurringId: null,
    source: 'manual',
    deletedAt: null,
    ...partial,
  };
}

describe('budgets', () => {
  test('levels follow the configured thresholds', () => {
    expect(budgetLevel(0.5, [0.75, 0.9, 1])).toBe('ok');
    expect(budgetLevel(0.8, [0.75, 0.9, 1])).toBe('watch');
    expect(budgetLevel(0.95, [0.75, 0.9, 1])).toBe('high');
    expect(budgetLevel(1.1, [0.75, 0.9, 1])).toBe('over');
  });

  test('fires only the highest newly crossed threshold', () => {
    const budget: Budget = {
      id: 'b1',
      categoryId: 'food',
      amountMinor: toMinor(1000, 'INR'),
      currency: 'INR',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      deletedAt: null,
    };
    const snapshot = {
      ...emptySnapshot('2026-11-01T00:00:00.000Z'),
      budgets: [budget],
      transactions: [expense({ amountMinor: toMinor(1200, 'INR') })],
    };
    const first = alertsToFire(snapshot, '2026-11', '2026-11-20T00:00:00.000Z');
    expect(first.map((alert) => alert.threshold).sort()).toEqual([0.75, 0.9, 1]);
    expect(first.filter((alert) => alert.title)).toHaveLength(1);
    const again = alertsToFire({ ...snapshot, alerts: first }, '2026-11', '2026-11-21T00:00:00.000Z');
    expect(again).toHaveLength(0);
    expect(budgetStatuses(snapshot, '2026-11')[0]?.level).toBe('over');
  });

  test('ignores income and other categories', () => {
    const snapshot = {
      ...emptySnapshot('2026-11-01T00:00:00.000Z'),
      budgets: [
        {
          id: 'food',
          categoryId: 'food',
          amountMinor: toMinor(1000, 'INR'),
          currency: 'INR',
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          deletedAt: null,
        },
      ],
      transactions: [
        expense({ id: 'a', amountMinor: toMinor(200, 'INR'), categoryId: 'food' }),
        expense({ id: 'b', type: 'income', amountMinor: toMinor(5000, 'INR'), categoryId: 'income' }),
        expense({ id: 'c', amountMinor: toMinor(900, 'INR'), categoryId: 'transport' }),
      ],
    };
    expect(budgetStatuses(snapshot, '2026-11')[0]?.spentMinor).toBe(toMinor(200, 'INR'));
  });
});
