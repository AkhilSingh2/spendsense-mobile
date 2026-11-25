const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseISODate(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return toISODate(date);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  return addMonths(`${month}-01`, delta).slice(0, 7);
}

export function daysInMonth(month: string): number {
  const date = parseISODate(`${month}-01`);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function weekdayIndex(iso: string): number {
  return parseISODate(iso).getDay();
}

export function isWeekend(iso: string): boolean {
  const day = weekdayIndex(iso);
  return day === 0 || day === 6;
}

export function formatDayLabel(iso: string, today = todayISO()): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return parseISODate(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatMonthLabel(month: string): string {
  return parseISODate(`${month}-01`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function previousWeekday(today: string, weekday: string, exclusive: boolean): string {
  const target = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  if (target < 0) return today;
  const current = weekdayIndex(today);
  let delta = (current - target + 7) % 7;
  if (delta === 0 && exclusive) delta = 7;
  if (delta === 0 && !exclusive) return today;
  return addDays(today, -delta);
}

export function monthIndex(token: string): number {
  const key = token.slice(0, 3).toLowerCase();
  return MONTHS.indexOf(key as (typeof MONTHS)[number]);
}

export function clampDay(month: string, day: number): string {
  const last = daysInMonth(month);
  const safe = Math.min(Math.max(day, 1), last);
  return `${month}-${String(safe).padStart(2, '0')}`;
}
