import { categoryById } from '@/domain/categories';
import { createId } from '@/domain/ids';
import { formatMoney } from '@/domain/money';
import { convertMinor } from '@/domain/rates';
import type { Budget, FiredAlert, Snapshot, Transaction } from '@/domain/types';

export type BudgetLevel = 'ok' | 'watch' | 'high' | 'over';

export type BudgetStatus = {
  budget: Budget;
  label: string;
  spentMinor: number;
  ratio: number;
  level: BudgetLevel;
};

export function budgetLevel(ratio: number, thresholds: number[]): BudgetLevel {
  if (ratio >= 1) return 'over';
  const sorted = [...thresholds].filter((value) => value > 0 && value < 1).sort((a, b) => a - b);
  const warn = sorted[0] ?? 0.75;
  const high = sorted[sorted.length - 1] ?? 0.9;
  if (ratio >= high) return 'high';
  if (ratio >= warn) return 'watch';
  return 'ok';
}

export function activeBudgets(snapshot: Snapshot): Budget[] {
  return snapshot.budgets.filter((budget) => !budget.deletedAt);
}

export function spentMinorFor(
  transactions: Transaction[],
  month: string,
  homeCurrency: string,
  categoryId: string | null,
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.deletedAt || tx.type !== 'expense') return sum;
    if (!tx.occurredOn.startsWith(month)) return sum;
    if (categoryId && tx.categoryId !== categoryId) return sum;
    return sum + convertMinor(tx.amountMinor, tx.currency, homeCurrency);
  }, 0);
}

export function budgetStatuses(snapshot: Snapshot, month: string): BudgetStatus[] {
  const home = snapshot.settings.homeCurrency;
  return activeBudgets(snapshot)
    .map((budget) => {
      const spentMinor = spentMinorFor(snapshot.transactions, month, home, budget.categoryId);
      const cap = Math.max(budget.amountMinor, 1);
      const ratio = spentMinor / cap;
      const label = budget.categoryId ? categoryById(budget.categoryId).name : 'Monthly budget';
      return {
        budget,
        label,
        spentMinor,
        ratio,
        level: budgetLevel(ratio, snapshot.settings.alertThresholds),
      };
    })
    .sort((a, b) => {
      if (a.budget.categoryId === null) return -1;
      if (b.budget.categoryId === null) return 1;
      return b.ratio - a.ratio;
    });
}

export function alertsToFire(snapshot: Snapshot, month: string, createdAt: string): FiredAlert[] {
  const thresholds = [...snapshot.settings.alertThresholds].sort((a, b) => a - b);
  const home = snapshot.settings.homeCurrency;
  const fired: FiredAlert[] = [];

  for (const status of budgetStatuses(snapshot, month)) {
    const crossed = thresholds.filter((threshold) => {
      if (status.ratio + 1e-9 < threshold) return false;
      return !snapshot.alerts.some(
        (alert) =>
          alert.budgetId === status.budget.id && alert.month === month && alert.threshold === threshold,
      );
    });
    if (crossed.length === 0) continue;
    const highest = Math.max(...crossed);
    for (const threshold of crossed) {
      const title =
        threshold >= 1
          ? `${status.label} is over budget`
          : `${status.label} passed ${Math.round(threshold * 100)}%`;
      const body = `${formatMoney(status.spentMinor, home)} of ${formatMoney(status.budget.amountMinor, status.budget.currency)} this month.`;
      fired.push({
        id: createId(),
        budgetId: status.budget.id,
        month,
        threshold,
        title: threshold === highest ? title : '',
        body: threshold === highest ? body : '',
        createdAt,
      });
    }
  }

  return fired;
}
