import { alertsToFire } from '@/domain/budgets';
import { addDays, clampDay, monthKey, shiftMonth, todayISO } from '@/domain/dates';
import { createId, nowIso } from '@/domain/ids';
import { toMinor } from '@/domain/money';
import { advanceDate } from '@/domain/recurringDates';
import { convertMinor } from '@/domain/rates';
import { pushOutbox } from '@/domain/snapshot';
import type { Budget, RecurringRule, Settings, Snapshot, Transaction, TransactionType } from '@/domain/types';

type Template = {
  day: number;
  type?: TransactionType;
  amount: number;
  currency?: string;
  categoryId: string;
  note: string;
  merchant: string;
  recurringKey?: string;
};

const TEMPLATE: Template[] = [
  { day: 1, type: 'income', amount: 185000, categoryId: 'income', note: 'Salary', merchant: 'Northwind', recurringKey: 'salary' },
  { day: 1, amount: 28000, categoryId: 'housing', note: 'Rent', merchant: 'Koramangala flat', recurringKey: 'rent' },
  { day: 1, amount: 2500, categoryId: 'housing', note: 'Society maintenance', merchant: 'Society' },
  { day: 2, amount: 1860, categoryId: 'groceries', note: 'Weekly groceries', merchant: 'BigBasket' },
  { day: 3, amount: 500, categoryId: 'transport', note: 'Metro card', merchant: 'Namma Metro' },
  { day: 4, amount: 640, categoryId: 'food', note: 'Dinner', merchant: 'Swiggy' },
  { day: 5, amount: 649, categoryId: 'subscriptions', note: 'Netflix', merchant: 'Netflix', recurringKey: 'netflix' },
  { day: 6, amount: 280, categoryId: 'transport', note: 'Cab to office', merchant: 'Uber' },
  { day: 7, amount: 180, categoryId: 'food', note: 'Filter coffee', merchant: 'Third Wave' },
  { day: 7, amount: 599, categoryId: 'education', note: 'Systems design book', merchant: 'Amazon' },
  { day: 8, amount: 2140, categoryId: 'groceries', note: 'Vegetables and staples', merchant: 'Blinkit' },
  { day: 9, amount: 780, categoryId: 'entertainment', note: 'Evening show', merchant: 'BookMyShow' },
  { day: 10, amount: 2140, categoryId: 'utilities', note: 'Electricity', merchant: 'BESCOM' },
  { day: 11, amount: 350, categoryId: 'food', note: 'Lunch', merchant: '' },
  { day: 12, amount: 999, categoryId: 'utilities', note: 'Mobile plan', merchant: 'Airtel', recurringKey: 'airtel' },
  { day: 13, amount: 430, categoryId: 'health', note: 'Pharmacy', merchant: 'Apollo' },
  { day: 14, amount: 1680, categoryId: 'food', note: 'Dinner with friends', merchant: 'Tandoor Room' },
  { day: 15, amount: 1500, categoryId: 'health', note: 'Gym', merchant: 'Cult', recurringKey: 'gym' },
  { day: 16, amount: 140, categoryId: 'transport', note: 'Ride home', merchant: 'Rapido' },
  { day: 18, amount: 119, categoryId: 'subscriptions', note: 'Spotify', merchant: 'Spotify' },
  { day: 19, amount: 2499, categoryId: 'shopping', note: 'Running shoes', merchant: 'Amazon' },
  { day: 20, amount: 15, currency: 'USD', categoryId: 'subscriptions', note: 'Figma', merchant: 'Figma' },
  { day: 21, amount: 420, categoryId: 'food', note: 'Team lunch', merchant: '' },
  { day: 22, amount: 560, categoryId: 'food', note: 'Cafe afternoon', merchant: 'Third Wave' },
  { day: 23, amount: 1320, categoryId: 'groceries', note: 'Groceries', merchant: 'BigBasket' },
];

const BUDGETS: { categoryId: string | null; amount: number }[] = [
  { categoryId: null, amount: 70000 },
  { categoryId: 'housing', amount: 32000 },
  { categoryId: 'food', amount: 8000 },
  { categoryId: 'groceries', amount: 7000 },
  { categoryId: 'transport', amount: 3500 },
  { categoryId: 'subscriptions', amount: 1800 },
  { categoryId: 'shopping', amount: 4000 },
  { categoryId: 'utilities', amount: 4000 },
];

function transactionFrom(
  item: Template,
  occurredOn: string,
  now: string,
  scale: number,
  recurringId: string | null,
): Transaction {
  const currency = item.currency ?? 'INR';
  const amount = item.type === 'income' || currency !== 'INR' ? item.amount : Math.round(item.amount * scale);
  return {
    id: createId(),
    type: item.type ?? 'expense',
    amountMinor: toMinor(amount, currency),
    currency,
    categoryId: item.categoryId,
    note: item.note,
    merchant: item.merchant,
    occurredOn,
    createdAt: now,
    updatedAt: now,
    receiptUri: null,
    recurringId,
    source: recurringId ? 'recurring' : 'manual',
    deletedAt: null,
  };
}

export function buildSampleSnapshot(base: Settings, now = new Date()): Snapshot {
  const today = todayISO(now);
  const stamp = nowIso(now);
  const currentMonth = monthKey(today);
  const previousMonth = shiftMonth(currentMonth, -1);
  const recurringIds = new Map<string, string>();
  for (const item of TEMPLATE) {
    if (item.recurringKey && !recurringIds.has(item.recurringKey)) {
      recurringIds.set(item.recurringKey, createId());
    }
  }

  const transactions: Transaction[] = [];
  const pushMonth = (month: string, scale: number, limitDay: number | null) => {
    for (const item of TEMPLATE) {
      if (limitDay !== null && item.day > limitDay) continue;
      const occurredOn = clampDay(month, item.day);
      const recurringId = item.recurringKey ? recurringIds.get(item.recurringKey) ?? null : null;
      transactions.push(transactionFrom(item, occurredOn, stamp, scale, recurringId));
    }
  };

  pushMonth(previousMonth, 1.15, null);
  pushMonth(currentMonth, 1, Number(today.slice(8, 10)));

  const lunchDay = addDays(today, -1);
  transactions.push({
    id: createId(),
    type: 'expense',
    amountMinor: toMinor(450, 'INR'),
    currency: 'INR',
    categoryId: 'food',
    note: 'Lunch with team',
    merchant: 'Tandoor Room',
    occurredOn: lunchDay,
    createdAt: stamp,
    updatedAt: stamp,
    receiptUri: null,
    recurringId: null,
    source: 'words',
    deletedAt: null,
  });

  const budgets: Budget[] = BUDGETS.map((item) => ({
    id: createId(),
    categoryId: item.categoryId,
    amountMinor: convertMinor(toMinor(item.amount, 'INR'), 'INR', base.homeCurrency),
    currency: base.homeCurrency,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }));

  const recurring: RecurringRule[] = TEMPLATE.filter((item) => item.recurringKey).map((item) => {
    const currency = item.currency ?? 'INR';
    const start = clampDay(currentMonth, item.day);
    const nextDate = start > today ? start : advanceDate(start, 'monthly', 1);
    return {
      id: recurringIds.get(item.recurringKey!) ?? createId(),
      type: item.type ?? 'expense',
      amountMinor: toMinor(item.amount, currency),
      currency,
      categoryId: item.categoryId,
      note: item.note,
      merchant: item.merchant,
      cadence: 'monthly' as const,
      intervalCount: 1,
      startDate: clampDay(previousMonth, item.day),
      nextDate,
      paused: false,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
  });

  const settings: Settings = {
    ...base,
    seeded: true,
    updatedAt: stamp,
  };

  let snapshot: Snapshot = {
    settings,
    transactions,
    budgets,
    recurring,
    alerts: [],
    outbox: [],
  };
  const previousAlerts = alertsToFire(snapshot, previousMonth, stamp);
  const currentAlerts = alertsToFire({ ...snapshot, alerts: previousAlerts }, currentMonth, stamp);
  snapshot = { ...snapshot, alerts: [...previousAlerts, ...currentAlerts] };
  for (const tx of snapshot.transactions) {
    snapshot = pushOutbox(snapshot, 'transaction', tx.id, 'upsert', tx, tx.updatedAt);
  }
  return snapshot;
}
