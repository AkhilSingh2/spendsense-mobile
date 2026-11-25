import { advanceDate } from '@/domain/recurringDates';
import { createId } from '@/domain/ids';
import { alertsToFire } from '@/domain/budgets';
import { pushOutbox } from '@/domain/snapshot';
import type { RecurringRule, Snapshot, Transaction } from '@/domain/types';

export function materializeRecurring(
  snapshot: Snapshot,
  today: string,
  now: string,
): { snapshot: Snapshot; changed: boolean; alertTitles: string[] } {
  let transactions = snapshot.transactions;
  let changed = false;
  const postedMonths = new Set<string>();
  const posted: Transaction[] = [];
  const recurring: RecurringRule[] = snapshot.recurring.map((rule) => {
    if (rule.paused || rule.deletedAt) return rule;
    let next = rule.nextDate;
    let guard = 0;
    const batch: Transaction[] = [];
    while (next <= today && guard < 36) {
      const already =
        transactions.some((tx) => tx.recurringId === rule.id && tx.occurredOn === next && !tx.deletedAt) ||
        batch.some((tx) => tx.occurredOn === next);
      if (!already) {
        batch.push({
          id: createId(),
          type: rule.type,
          amountMinor: rule.amountMinor,
          currency: rule.currency,
          categoryId: rule.categoryId,
          note: rule.note,
          merchant: rule.merchant,
          occurredOn: next,
          createdAt: now,
          updatedAt: now,
          receiptUri: null,
          recurringId: rule.id,
          source: 'recurring',
          deletedAt: null,
        });
        postedMonths.add(next.slice(0, 7));
      }
      next = advanceDate(next, rule.cadence, rule.intervalCount);
      guard += 1;
    }
    if (batch.length === 0 && next === rule.nextDate) return rule;
    changed = true;
    posted.push(...batch);
    transactions = [...batch, ...transactions];
    return { ...rule, nextDate: next, updatedAt: now };
  });

  if (!changed) return { snapshot, changed: false, alertTitles: [] };

  let nextSnapshot: Snapshot = { ...snapshot, transactions, recurring };
  for (const tx of posted) {
    nextSnapshot = pushOutbox(nextSnapshot, 'transaction', tx.id, 'upsert', tx, tx.updatedAt);
  }
  for (const rule of recurring) {
    const previous = snapshot.recurring.find((item) => item.id === rule.id);
    if (previous && previous.nextDate !== rule.nextDate) {
      nextSnapshot = pushOutbox(nextSnapshot, 'recurring', rule.id, 'upsert', rule, rule.updatedAt);
    }
  }

  const fresh = [...postedMonths].flatMap((month) => alertsToFire(nextSnapshot, month, now));
  if (fresh.length > 0) {
    nextSnapshot = { ...nextSnapshot, alerts: [...nextSnapshot.alerts, ...fresh] };
  }
  return {
    snapshot: nextSnapshot,
    changed: true,
    alertTitles: fresh.filter((alert) => alert.title).map((alert) => alert.title),
  };
}
