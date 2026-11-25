import type { Cadence } from '@/domain/types';
import { addDays, addMonths } from '@/domain/dates';

export function advanceDate(iso: string, cadence: Cadence, intervalCount: number): string {
  const step = Math.max(1, intervalCount || 1);
  if (cadence === 'daily') return addDays(iso, step);
  if (cadence === 'weekly') return addDays(iso, 7 * step);
  if (cadence === 'yearly') return addMonths(iso, 12 * step);
  return addMonths(iso, step);
}

export function cadenceLabel(cadence: Cadence, intervalCount: number): string {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[cadence];
  if (intervalCount <= 1) return `Every ${unit}`;
  return `Every ${intervalCount} ${unit}s`;
}
