import { advanceDate } from '@/domain/recurringDates';
import { materializeRecurring } from '@/domain/recurring';
import { emptySnapshot } from '@/domain/snapshot';
import { toMinor } from '@/domain/money';
import type { RecurringRule } from '@/domain/types';

describe('recurring', () => {
  test('advances months without overflowing short months', () => {
    expect(advanceDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(advanceDate('2026-11-24', 'weekly', 2)).toBe('2026-12-08');
  });

  test('posts a due rule once and moves nextDate forward', () => {
    const rule: RecurringRule = {
      id: 'rent',
      type: 'expense',
      amountMinor: toMinor(28000, 'INR'),
      currency: 'INR',
      categoryId: 'housing',
      note: 'Rent',
      merchant: 'Flat',
      cadence: 'monthly',
      intervalCount: 1,
      startDate: '2026-11-01',
      nextDate: '2026-11-01',
      paused: false,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      deletedAt: null,
    };
    const first = materializeRecurring({ ...emptySnapshot(), recurring: [rule] }, '2026-11-25', '2026-11-25T00:00:00.000Z');
    expect(first.changed).toBe(true);
    expect(first.snapshot.transactions.filter((tx) => tx.recurringId === 'rent')).toHaveLength(1);
    expect(first.snapshot.recurring[0]?.nextDate).toBe('2026-12-01');
    const second = materializeRecurring(first.snapshot, '2026-11-25', '2026-11-26T00:00:00.000Z');
    expect(second.changed).toBe(false);
  });
});
