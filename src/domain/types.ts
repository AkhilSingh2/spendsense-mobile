export type CurrencyCode =
  | 'INR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AED'
  | 'SGD'
  | 'JPY'
  | 'AUD'
  | 'CAD';

export type TransactionType = 'expense' | 'income';

export type EntrySource = 'manual' | 'words' | 'receipt' | 'recurring';

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ParserMode = 'ai' | 'rules';

export type Transaction = {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  categoryId: string;
  note: string;
  merchant: string;
  occurredOn: string;
  createdAt: string;
  updatedAt: string;
  receiptUri: string | null;
  recurringId: string | null;
  source: EntrySource;
  deletedAt: string | null;
};

export type Budget = {
  id: string;
  categoryId: string | null;
  amountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type RecurringRule = {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  categoryId: string;
  note: string;
  merchant: string;
  cadence: Cadence;
  intervalCount: number;
  startDate: string;
  nextDate: string;
  paused: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type FiredAlert = {
  id: string;
  budgetId: string;
  month: string;
  threshold: number;
  title: string;
  body: string;
  createdAt: string;
};

export type OutboxEntity = 'transaction' | 'budget' | 'recurring' | 'settings';

export type OutboxItem = {
  id: string;
  entity: OutboxEntity;
  entityId: string;
  op: 'upsert' | 'delete';
  payload: string;
  updatedAt: string;
  createdAt: string;
  syncedAt: string | null;
};

export type Settings = {
  id: 'settings';
  displayName: string;
  homeCurrency: string;
  theme: ThemePreference;
  onboardingComplete: boolean;
  lockEnabled: boolean;
  biometricEnabled: boolean;
  pinSalt: string | null;
  pinHash: string | null;
  notificationsEnabled: boolean;
  alertThresholds: number[];
  seeded: boolean;
  parserMode: ParserMode;
  syncUrl: string;
  syncToken: string;
  lastSyncedAt: string | null;
  deviceId: string;
  updatedAt: string;
};

export type Snapshot = {
  settings: Settings;
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringRule[];
  alerts: FiredAlert[];
  outbox: OutboxItem[];
};

export type RemoteChange = {
  entity: OutboxEntity;
  entityId: string;
  op: 'upsert' | 'delete';
  updatedAt: string;
  payload: unknown;
};
