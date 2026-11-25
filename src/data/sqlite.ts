import * as SQLite from 'expo-sqlite';

import type { FiredAlert, OutboxItem, RecurringRule, Settings, Snapshot, Transaction } from '@/domain/types';
import type { LedgerPersistence } from '@/data/persistence';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  category_id TEXT NOT NULL,
  note TEXT NOT NULL,
  merchant TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  receipt_uri TEXT,
  recurring_id TEXT,
  source TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (occurred_on);
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS recurring (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  category_id TEXT NOT NULL,
  note TEXT NOT NULL,
  merchant TEXT NOT NULL,
  cadence TEXT NOT NULL,
  interval_count INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  next_date TEXT NOT NULL,
  paused INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY NOT NULL,
  budget_id TEXT NOT NULL,
  month TEXT NOT NULL,
  threshold REAL NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL
);
`;

type TxRow = {
  id: string;
  type: Transaction['type'];
  amount_minor: number;
  currency: string;
  category_id: string;
  note: string;
  merchant: string;
  occurred_on: string;
  created_at: string;
  updated_at: string;
  receipt_uri: string | null;
  recurring_id: string | null;
  source: Transaction['source'];
  deleted_at: string | null;
};

function mapTx(row: TxRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amount_minor,
    currency: row.currency,
    categoryId: row.category_id,
    note: row.note,
    merchant: row.merchant,
    occurredOn: row.occurred_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    receiptUri: row.receipt_uri,
    recurringId: row.recurring_id,
    source: row.source,
    deletedAt: row.deleted_at,
  };
}

export class SqlitePersistence implements LedgerPersistence {
  kind = 'sqlite' as const;

  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  static async open(): Promise<SqlitePersistence> {
    const db = await SQLite.openDatabaseAsync('spendsense.db');
    await db.execAsync(SCHEMA);
    return new SqlitePersistence(db);
  }

  async load(): Promise<Snapshot | null> {
    const settingsRows = await this.db.getAllAsync<{ json: string }>('SELECT json FROM settings WHERE id = 1');
    const json = settingsRows[0]?.json;
    if (!json) return null;
    const settings = JSON.parse(json) as Settings;
    const transactions = (await this.db.getAllAsync<TxRow>('SELECT * FROM transactions')).map(mapTx);
    const budgets = await this.db.getAllAsync<{
      id: string;
      category_id: string | null;
      amount_minor: number;
      currency: string;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    }>('SELECT * FROM budgets');
    const recurring = await this.db.getAllAsync<{
      id: string;
      type: RecurringRule['type'];
      amount_minor: number;
      currency: string;
      category_id: string;
      note: string;
      merchant: string;
      cadence: RecurringRule['cadence'];
      interval_count: number;
      start_date: string;
      next_date: string;
      paused: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    }>('SELECT * FROM recurring');
    const alerts = await this.db.getAllAsync<{
      id: string;
      budget_id: string;
      month: string;
      threshold: number;
      title: string;
      body: string;
      created_at: string;
    }>('SELECT * FROM alerts');
    const outbox = await this.db.getAllAsync<{
      id: string;
      entity: OutboxItem['entity'];
      entity_id: string;
      op: OutboxItem['op'];
      payload: string;
      updated_at: string;
      created_at: string;
      synced_at: string | null;
    }>('SELECT * FROM outbox');

    return {
      settings,
      transactions,
      budgets: budgets.map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        amountMinor: row.amount_minor,
        currency: row.currency,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      })),
      recurring: recurring.map((row) => ({
        id: row.id,
        type: row.type,
        amountMinor: row.amount_minor,
        currency: row.currency,
        categoryId: row.category_id,
        note: row.note,
        merchant: row.merchant,
        cadence: row.cadence,
        intervalCount: row.interval_count,
        startDate: row.start_date,
        nextDate: row.next_date,
        paused: row.paused === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      })),
      alerts: alerts.map((row) => ({
        id: row.id,
        budgetId: row.budget_id,
        month: row.month,
        threshold: row.threshold,
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
      })),
      outbox: outbox.map((row) => ({
        id: row.id,
        entity: row.entity,
        entityId: row.entity_id,
        op: row.op,
        payload: row.payload,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
        syncedAt: row.synced_at,
      })),
    };
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(
        'DELETE FROM transactions; DELETE FROM budgets; DELETE FROM recurring; DELETE FROM alerts; DELETE FROM outbox; DELETE FROM settings;',
      );
      for (const tx of snapshot.transactions) {
        await this.db.runAsync(
          `INSERT INTO transactions (
            id, type, amount_minor, currency, category_id, note, merchant, occurred_on,
            created_at, updated_at, receipt_uri, recurring_id, source, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          tx.id,
          tx.type,
          tx.amountMinor,
          tx.currency,
          tx.categoryId,
          tx.note,
          tx.merchant,
          tx.occurredOn,
          tx.createdAt,
          tx.updatedAt,
          tx.receiptUri,
          tx.recurringId,
          tx.source,
          tx.deletedAt,
        );
      }
      for (const budget of snapshot.budgets) {
        await this.db.runAsync(
          `INSERT INTO budgets (id, category_id, amount_minor, currency, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          budget.id,
          budget.categoryId,
          budget.amountMinor,
          budget.currency,
          budget.createdAt,
          budget.updatedAt,
          budget.deletedAt,
        );
      }
      for (const rule of snapshot.recurring) {
        await this.db.runAsync(
          `INSERT INTO recurring (
            id, type, amount_minor, currency, category_id, note, merchant, cadence, interval_count,
            start_date, next_date, paused, created_at, updated_at, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          rule.id,
          rule.type,
          rule.amountMinor,
          rule.currency,
          rule.categoryId,
          rule.note,
          rule.merchant,
          rule.cadence,
          rule.intervalCount,
          rule.startDate,
          rule.nextDate,
          rule.paused ? 1 : 0,
          rule.createdAt,
          rule.updatedAt,
          rule.deletedAt,
        );
      }
      for (const alert of snapshot.alerts) {
        await this.insertAlert(alert);
      }
      for (const item of snapshot.outbox) {
        await this.insertOutbox(item);
      }
      await this.db.runAsync('INSERT INTO settings (id, json) VALUES (1, ?)', JSON.stringify(snapshot.settings));
    });
  }

  private async insertAlert(alert: FiredAlert): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO alerts (id, budget_id, month, threshold, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      alert.id,
      alert.budgetId,
      alert.month,
      alert.threshold,
      alert.title,
      alert.body,
      alert.createdAt,
    );
  }

  private async insertOutbox(item: OutboxItem): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO outbox (id, entity, entity_id, op, payload, updated_at, created_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      item.entity,
      item.entityId,
      item.op,
      item.payload,
      item.updatedAt,
      item.createdAt,
      item.syncedAt,
    );
  }
}
