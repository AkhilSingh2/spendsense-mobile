import { categoryById } from '@/domain/categories';
import { fromMinor } from '@/domain/money';
import { convertMinor } from '@/domain/rates';
import type { Snapshot, Transaction } from '@/domain/types';

function cell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function transactionsToCsv(snapshot: Snapshot): string {
  const home = snapshot.settings.homeCurrency;
  const header = [
    'date',
    'type',
    'amount',
    'currency',
    'amount_in_home',
    'home_currency',
    'category',
    'merchant',
    'note',
    'source',
  ];
  const rows = snapshot.transactions
    .filter((tx) => !tx.deletedAt)
    .slice()
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
    .map((tx) => csvRow(tx, home));
  return [header.join(','), ...rows].join('\n');
}

function csvRow(tx: Transaction, home: string): string {
  const amount = fromMinor(tx.amountMinor, tx.currency);
  const homeAmount = fromMinor(convertMinor(tx.amountMinor, tx.currency, home), home);
  return [
    tx.occurredOn,
    tx.type,
    String(amount),
    tx.currency,
    String(homeAmount),
    home,
    categoryById(tx.categoryId).name,
    tx.merchant,
    tx.note,
    tx.source,
  ]
    .map(cell)
    .join(',');
}
