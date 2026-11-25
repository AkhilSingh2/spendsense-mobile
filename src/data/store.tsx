import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Crypto from 'expo-crypto';

import { alertsToFire } from '@/domain/budgets';
import { transactionsToCsv } from '@/domain/csv';
import { monthKey, todayISO } from '@/domain/dates';
import { createId, nowIso } from '@/domain/ids';
import { materializeRecurring } from '@/domain/recurring';
import { emptySnapshot, pushOutbox } from '@/domain/snapshot';
import type { Budget, RecurringRule, Settings, Snapshot, Transaction } from '@/domain/types';
import { openPersistence } from '@/data/openPersistence';
import type { LedgerPersistence } from '@/data/persistence';
import { buildSampleSnapshot } from '@/data/seed';
import { syncLedger } from '@/data/sync';
import { exportTextFile } from '@/services/exportFile';
import { publishAlert } from '@/services/notifications';

type LedgerContextValue = {
  ready: boolean;
  driver: 'sqlite' | 'local' | 'starting';
  snapshot: Snapshot;
  unlocked: boolean;
  unlock: () => void;
  lockNow: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  completeOnboarding: (input: { name: string; currency: string; seed: boolean }) => Promise<void>;
  saveTransaction: (tx: Transaction, options?: { recurring?: RecurringRule | null }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveBudget: (budget: Budget) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  saveRecurring: (rule: RecurringRule) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  loadSample: () => Promise<void>;
  eraseData: () => Promise<void>;
  syncNow: () => Promise<string>;
  exportCsv: () => Promise<void>;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

function announceable(alerts: { title: string; body: string; threshold: number; budgetId: string; month: string }[]) {
  const chosen = new Map<string, (typeof alerts)[number]>();
  for (const alert of alerts) {
    if (!alert.title) continue;
    const key = `${alert.budgetId}:${alert.month}`;
    const current = chosen.get(key);
    if (!current || alert.threshold > current.threshold) chosen.set(key, alert);
  }
  return [...chosen.values()];
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => emptySnapshot());
  const [ready, setReady] = useState(false);
  const [driver, setDriver] = useState<'sqlite' | 'local' | 'starting'>('starting');
  const [unlocked, setUnlocked] = useState(false);
  const snapshotRef = useRef(snapshot);
  const persistenceRef = useRef<LedgerPersistence | null>(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persistence = await openPersistence();
      if (cancelled) return;
      persistenceRef.current = persistence;
      setDriver(persistence.kind);
      const stored = (await persistence.load()) ?? emptySnapshot();
      const today = todayISO();
      const stamp = nowIso();
      const materialized = materializeRecurring(stored, today, stamp);
      const next = materialized.snapshot;
      if (materialized.changed) await persistence.replaceAll(next);
      if (cancelled) return;
      snapshotRef.current = next;
      setSnapshot(next);
      setReady(true);
      if (materialized.alertTitles.length > 0 && next.settings.notificationsEnabled) {
        for (const title of materialized.alertTitles) {
          await publishAlert({ title, body: 'A recurring expense posted and moved a budget.', tone: 'warn' }, true);
        }
      }
    })().catch((error) => {
      console.warn('Ledger failed to open.', error);
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const api = useMemo<LedgerContextValue>(() => {
    const commit = (next: Snapshot) => {
      const run = async () => {
        const persistence = persistenceRef.current;
        const previous = snapshotRef.current;
        snapshotRef.current = next;
        setSnapshot(next);
        try {
          await persistence?.replaceAll(next);
        } catch (error) {
          snapshotRef.current = previous;
          setSnapshot(previous);
          throw error;
        }
      };
      const pending = queue.current.then(run, run);
      queue.current = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    };

    return {
      ready,
      driver,
      snapshot,
      unlocked,
      unlock: () => setUnlocked(true),
      lockNow: () => setUnlocked(false),
      verifyPin: async (pin: string) => {
        const current = snapshotRef.current.settings;
        if (!current.pinHash || !current.pinSalt) return false;
        const hash = await hashPin(pin, current.pinSalt);
        return hash === current.pinHash;
      },
      setPin: async (pin: string) => {
        const salt = createId();
        const pinHash = await hashPin(pin, salt);
        const current = snapshotRef.current;
        const settings: Settings = {
          ...current.settings,
          pinSalt: salt,
          pinHash,
          lockEnabled: true,
          updatedAt: nowIso(),
        };
        await commit(pushOutbox({ ...current, settings }, 'settings', 'settings', 'upsert', settings, settings.updatedAt));
      },
      completeOnboarding: async ({ name, currency, seed }) => {
        const current = snapshotRef.current;
        const settings: Settings = {
          ...current.settings,
          displayName: name.trim() || 'Akhilendra',
          homeCurrency: currency,
          onboardingComplete: true,
          updatedAt: nowIso(),
        };
        const base = seed ? buildSampleSnapshot(settings) : { ...current, settings };
        const withFlag = seed
          ? base
          : pushOutbox(base, 'settings', 'settings', 'upsert', settings, settings.updatedAt);
        await commit({ ...withFlag, settings: { ...withFlag.settings, onboardingComplete: true } });
      },
      saveTransaction: async (tx, options) => {
        const current = snapshotRef.current;
        let transactions = [tx, ...current.transactions.filter((item) => item.id !== tx.id)];
        let recurring = current.recurring;
        if (options?.recurring) {
          recurring = [options.recurring, ...recurring.filter((rule) => rule.id !== options.recurring?.id)];
        }
        let next: Snapshot = { ...current, transactions, recurring };
        next = pushOutbox(next, 'transaction', tx.id, 'upsert', tx, tx.updatedAt);
        if (options?.recurring) {
          next = pushOutbox(next, 'recurring', options.recurring.id, 'upsert', options.recurring, options.recurring.updatedAt);
        }
        const fresh = alertsToFire(next, monthKey(tx.occurredOn), tx.updatedAt);
        if (fresh.length) next = { ...next, alerts: [...next.alerts, ...fresh] };
        await commit(next);
        for (const alert of announceable(fresh)) {
          await publishAlert(
            { title: alert.title, body: alert.body, tone: 'warn' },
            next.settings.notificationsEnabled,
          );
        }
      },
      deleteTransaction: async (id) => {
        const current = snapshotRef.current;
        const existing = current.transactions.find((item) => item.id === id);
        if (!existing) return;
        const tx = { ...existing, deletedAt: nowIso(), updatedAt: nowIso() };
        const transactions = current.transactions.map((item) => (item.id === id ? tx : item));
        let next: Snapshot = { ...current, transactions };
        next = pushOutbox(next, 'transaction', id, 'upsert', tx, tx.updatedAt);
        await commit(next);
      },
      saveBudget: async (budget) => {
        const current = snapshotRef.current;
        const budgets = [budget, ...current.budgets.filter((item) => item.id !== budget.id)];
        let next: Snapshot = { ...current, budgets };
        next = pushOutbox(next, 'budget', budget.id, 'upsert', budget, budget.updatedAt);
        const fresh = alertsToFire(next, monthKey(todayISO()), budget.updatedAt);
        if (fresh.length) next = { ...next, alerts: [...next.alerts, ...fresh] };
        await commit(next);
        for (const alert of announceable(fresh)) {
          await publishAlert({ title: alert.title, body: alert.body, tone: 'warn' }, next.settings.notificationsEnabled);
        }
      },
      deleteBudget: async (id) => {
        const current = snapshotRef.current;
        const existing = current.budgets.find((item) => item.id === id);
        if (!existing) return;
        const budget = { ...existing, deletedAt: nowIso(), updatedAt: nowIso() };
        const budgets = current.budgets.map((item) => (item.id === id ? budget : item));
        let next: Snapshot = { ...current, budgets };
        next = pushOutbox(next, 'budget', id, 'upsert', budget, budget.updatedAt);
        await commit(next);
      },
      saveRecurring: async (rule) => {
        const current = snapshotRef.current;
        const recurring = [rule, ...current.recurring.filter((item) => item.id !== rule.id)];
        let next: Snapshot = { ...current, recurring };
        next = pushOutbox(next, 'recurring', rule.id, 'upsert', rule, rule.updatedAt);
        const materialized = materializeRecurring(next, todayISO(), nowIso());
        await commit(materialized.snapshot);
      },
      deleteRecurring: async (id) => {
        const current = snapshotRef.current;
        const existing = current.recurring.find((item) => item.id === id);
        if (!existing) return;
        const rule = { ...existing, deletedAt: nowIso(), updatedAt: nowIso() };
        const recurring = current.recurring.map((item) => (item.id === id ? rule : item));
        let next: Snapshot = { ...current, recurring };
        next = pushOutbox(next, 'recurring', id, 'upsert', rule, rule.updatedAt);
        await commit(next);
      },
      updateSettings: async (patch) => {
        const current = snapshotRef.current;
        const settings: Settings = { ...current.settings, ...patch, updatedAt: nowIso() };
        const next = pushOutbox({ ...current, settings }, 'settings', 'settings', 'upsert', settings, settings.updatedAt);
        await commit(next);
      },
      loadSample: async () => {
        const sample = buildSampleSnapshot({ ...snapshotRef.current.settings, onboardingComplete: true });
        await commit(sample);
      },
      eraseData: async () => {
        const current = snapshotRef.current.settings;
        const settings: Settings = {
          ...current,
          seeded: false,
          updatedAt: nowIso(),
        };
        await commit({
          settings,
          transactions: [],
          budgets: [],
          recurring: [],
          alerts: [],
          outbox: [],
        });
      },
      syncNow: async () => {
        const result = await syncLedger(snapshotRef.current);
        if (result.ok) await commit(result.snapshot);
        return result.message;
      },
      exportCsv: async () => {
        const csv = transactionsToCsv(snapshotRef.current);
        const name = `spendsense-${todayISO()}.csv`;
        await exportTextFile(name, csv, 'text/csv');
      },
    };
  }, [driver, ready, snapshot, unlocked]);

  return <LedgerContext.Provider value={api}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('useLedger must be used inside LedgerProvider');
  return value;
}
