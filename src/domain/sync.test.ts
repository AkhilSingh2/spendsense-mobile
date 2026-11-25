import { transactionsToCsv } from '@/domain/csv';
import { emptySnapshot, applyRemoteChanges } from '@/domain/snapshot';
import { toMinor } from '@/domain/money';
import type { Transaction } from '@/domain/types';

describe('csv and sync merge', () => {
  test('escapes commas and quotes', () => {
    const tx: Transaction = {
      id: '1',
      type: 'expense',
      amountMinor: toMinor(10, 'INR'),
      currency: 'INR',
      categoryId: 'food',
      note: 'Lunch, "team"',
      merchant: 'Cafe',
      occurredOn: '2026-11-24',
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T00:00:00.000Z',
      receiptUri: null,
      recurringId: null,
      source: 'manual',
      deletedAt: null,
    };
    const csv = transactionsToCsv({ ...emptySnapshot(), transactions: [tx] });
    expect(csv).toContain('"Lunch, ""team"""');
  });

  test('remote change wins only when it is newer and never replaces the local pin', () => {
    const local = emptySnapshot('2026-11-01T00:00:00.000Z');
    local.settings.pinHash = 'hash';
    local.settings.pinSalt = 'salt';
    local.settings.updatedAt = '2026-11-02T00:00:00.000Z';
    const merged = applyRemoteChanges(local, [
      {
        entity: 'settings',
        entityId: 'settings',
        op: 'upsert',
        updatedAt: '2026-11-03T00:00:00.000Z',
        payload: { ...local.settings, displayName: 'Remote', pinHash: 'other', pinSalt: 'other', updatedAt: '2026-11-03T00:00:00.000Z' },
      },
      {
        entity: 'transaction',
        entityId: 't1',
        op: 'upsert',
        updatedAt: '2026-11-01T00:00:00.000Z',
        payload: {
          id: 't1',
          type: 'expense',
          amountMinor: 100,
          currency: 'INR',
          categoryId: 'food',
          note: 'Old',
          merchant: '',
          occurredOn: '2026-11-01',
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          receiptUri: null,
          recurringId: null,
          source: 'manual',
          deletedAt: null,
        },
      },
    ]);
    expect(merged.settings.displayName).toBe('Remote');
    expect(merged.settings.pinHash).toBe('hash');
    expect(merged.transactions).toHaveLength(1);
  });
});
