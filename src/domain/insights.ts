import { categoryById } from '@/domain/categories';
import { daysInMonth, isWeekend, monthKey, shiftMonth } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { convertMinor } from '@/domain/rates';
import { activeBudgets } from '@/domain/budgets';
import type { Snapshot, Transaction } from '@/domain/types';

export type CategorySlice = { categoryId: string; amountMinor: number };

export type DaySpend = { date: string; amountMinor: number };

export type MonthInsights = {
  month: string;
  spentMinor: number;
  incomeMinor: number;
  byCategory: CategorySlice[];
  byDay: DaySpend[];
  previousSpentMinor: number;
  deltaRatio: number | null;
  daysLeft: number;
  budgetMinor: number | null;
  budgetRatio: number | null;
  projectedMinor: number;
  largest: Transaction | null;
  sentences: string[];
};

function inMonth(tx: Transaction, month: string): boolean {
  return !tx.deletedAt && tx.occurredOn.startsWith(month);
}

function toHome(tx: Transaction, home: string): number {
  return convertMinor(tx.amountMinor, tx.currency, home);
}

export function buildInsights(snapshot: Snapshot, month: string, today: string): MonthInsights {
  const home = snapshot.settings.homeCurrency;
  const current = snapshot.transactions.filter((tx) => inMonth(tx, month));
  const expenses = current.filter((tx) => tx.type === 'expense');
  const income = current.filter((tx) => tx.type === 'income');
  const spentMinor = expenses.reduce((sum, tx) => sum + toHome(tx, home), 0);
  const incomeMinor = income.reduce((sum, tx) => sum + toHome(tx, home), 0);

  const categoryMap = new Map<string, number>();
  for (const tx of expenses) {
    categoryMap.set(tx.categoryId, (categoryMap.get(tx.categoryId) ?? 0) + toHome(tx, home));
  }
  const byCategory = [...categoryMap.entries()]
    .map(([categoryId, amountMinor]) => ({ categoryId, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  const dim = daysInMonth(month);
  const isCurrent = month === monthKey(today);
  const lastDay = isCurrent ? Math.min(dim, Number(today.slice(8, 10))) : dim;
  const byDay: DaySpend[] = [];
  for (let day = 1; day <= dim; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const amountMinor = expenses
      .filter((tx) => tx.occurredOn === date && tx.categoryId !== 'housing')
      .reduce((sum, tx) => sum + toHome(tx, home), 0);
    byDay.push({ date, amountMinor });
  }

  const previousMonth = shiftMonth(month, -1);
  const previousSpentMinor = snapshot.transactions
    .filter((tx) => inMonth(tx, previousMonth) && tx.type === 'expense')
    .reduce((sum, tx) => sum + toHome(tx, home), 0);
  const deltaRatio = previousSpentMinor > 0 ? (spentMinor - previousSpentMinor) / previousSpentMinor : null;

  const housingMinor = expenses
    .filter((tx) => tx.categoryId === 'housing')
    .reduce((sum, tx) => sum + toHome(tx, home), 0);
  const discretionary = Math.max(0, spentMinor - housingMinor);
  const elapsed = Math.max(lastDay, 1);
  const projectedMinor = isCurrent
    ? housingMinor + Math.round((discretionary / elapsed) * dim)
    : spentMinor;

  const overall = activeBudgets(snapshot).find((budget) => budget.categoryId === null) ?? null;
  const budgetMinor = overall ? overall.amountMinor : null;
  const budgetRatio = budgetMinor ? spentMinor / budgetMinor : null;
  const daysLeft = isCurrent ? Math.max(dim - lastDay, 0) : 0;

  const largest =
    expenses.slice().sort((a, b) => toHome(b, home) - toHome(a, home))[0] ?? null;

  const sentences = insightSentences({
    home,
    month,
    spentMinor,
    byCategory,
    deltaRatio,
    previousSpentMinor,
    projectedMinor,
    isCurrent,
    daysLeft,
    budgetMinor,
    budgetRatio,
    largest,
    expenses,
  });

  return {
    month,
    spentMinor,
    incomeMinor,
    byCategory,
    byDay,
    previousSpentMinor,
    deltaRatio,
    daysLeft,
    budgetMinor,
    budgetRatio,
    projectedMinor,
    largest,
    sentences,
  };
}

function insightSentences(input: {
  home: string;
  month: string;
  spentMinor: number;
  byCategory: CategorySlice[];
  deltaRatio: number | null;
  previousSpentMinor: number;
  projectedMinor: number;
  isCurrent: boolean;
  daysLeft: number;
  budgetMinor: number | null;
  budgetRatio: number | null;
  largest: Transaction | null;
  expenses: Transaction[];
}): string[] {
  const lines: string[] = [];
  const top = input.byCategory[0];
  if (top && input.spentMinor > 0) {
    const share = Math.round((top.amountMinor / input.spentMinor) * 100);
    lines.push(`${categoryById(top.categoryId).name} is ${share}% of this month's spending.`);
  }
  if (input.deltaRatio !== null && input.previousSpentMinor > 0) {
    const pct = Math.abs(Math.round(input.deltaRatio * 100));
    if (pct < 2) lines.push('Spending is level with last month.');
    else if (input.deltaRatio < 0) lines.push(`Spending is ${pct}% under last month.`);
    else lines.push(`Spending is ${pct}% over last month.`);
  }
  if (input.budgetRatio !== null && input.budgetMinor !== null) {
    const used = Math.round(input.budgetRatio * 100);
    if (input.isCurrent) {
      const tail = input.daysLeft === 0 ? 'This is the last day of the month.' : `${input.daysLeft} days left.`;
      lines.push(`You've used ${used}% of the ${formatMoney(input.budgetMinor, input.home)} budget. ${tail}`);
    } else {
      lines.push(`That month closed at ${used}% of the ${formatMoney(input.budgetMinor, input.home)} budget.`);
    }
  } else if (input.isCurrent && input.spentMinor > 0) {
    lines.push(`Outside rent, this pace lands near ${formatMoney(input.projectedMinor, input.home)}.`);
  }
  if (input.largest) {
    const label = input.largest.merchant || input.largest.note || categoryById(input.largest.categoryId).name;
    lines.push(`Largest expense is ${label}, ${formatMoney(input.largest.amountMinor, input.largest.currency)}.`);
  }
  const weekend = input.expenses
    .filter((tx) => tx.categoryId !== 'housing' && isWeekend(tx.occurredOn))
    .reduce((sum, tx) => sum + convertMinor(tx.amountMinor, tx.currency, input.home), 0);
  const weekday = input.expenses
    .filter((tx) => tx.categoryId !== 'housing' && !isWeekend(tx.occurredOn))
    .reduce((sum, tx) => sum + convertMinor(tx.amountMinor, tx.currency, input.home), 0);
  if (weekend > 0 && weekday > 0 && weekend > weekday * 1.4) {
    lines.push('Weekends are carrying more of the discretionary spend.');
  }
  return lines.slice(0, 4);
}
