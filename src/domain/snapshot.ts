import { createId } from '@/domain/ids';
import type { OutboxEntity, RemoteChange, Settings, Snapshot } from '@/domain/types';

export function createSettings(now: string, deviceId = createId()): Settings {
  return {
    id: 'settings',
    displayName: 'Akhilendra',
    homeCurrency: 'INR',
    theme: 'system',
    onboardingComplete: false,
    lockEnabled: false,
    biometricEnabled: false,
    pinSalt: null,
    pinHash: null,
    notificationsEnabled: true,
    alertThresholds: [0.75, 0.9, 1],
    seeded: false,
    parserMode: 'ai',
    syncUrl: '',
    syncToken: '',
    lastSyncedAt: null,
    deviceId,
    updatedAt: now,
  };
}

export function emptySnapshot(now = new Date().toISOString()): Snapshot {
  return {
    settings: createSettings(now),
    transactions: [],
    budgets: [],
    recurring: [],
    alerts: [],
    outbox: [],
  };
}

export function pushOutbox(
  snapshot: Snapshot,
  entity: OutboxEntity,
  entityId: string,
  op: 'upsert' | 'delete',
  payload: unknown,
  updatedAt: string,
): Snapshot {
  return {
    ...snapshot,
    outbox: [
      ...snapshot.outbox,
      {
        id: createId(),
        entity,
        entityId,
        op,
        payload: JSON.stringify(payload),
        updatedAt,
        createdAt: updatedAt,
        syncedAt: null,
      },
    ],
  };
}

export function applyRemoteChanges(snapshot: Snapshot, changes: RemoteChange[]): Snapshot {
  let next = snapshot;
  for (const change of changes) {
    if (change.entity === 'settings') {
      const payload = change.payload as Settings;
      if (payload && payload.updatedAt > next.settings.updatedAt) {
        next = {
          ...next,
          settings: {
            ...payload,
            deviceId: next.settings.deviceId,
            pinHash: next.settings.pinHash,
            pinSalt: next.settings.pinSalt,
          },
        };
      }
      continue;
    }
    next = applyCollection(next, change);
  }
  return next;
}

function applyCollection(snapshot: Snapshot, change: RemoteChange): Snapshot {
  if (change.entity === 'transaction') {
    return replaceById(snapshot, 'transactions', change);
  }
  if (change.entity === 'budget') {
    return replaceById(snapshot, 'budgets', change);
  }
  if (change.entity === 'recurring') {
    return replaceById(snapshot, 'recurring', change);
  }
  return snapshot;
}

function replaceById(
  snapshot: Snapshot,
  key: 'transactions' | 'budgets' | 'recurring',
  change: RemoteChange,
): Snapshot {
  const list = snapshot[key] as { id: string; updatedAt: string }[];
  const local = list.find((item) => item.id === change.entityId);
  if (local && local.updatedAt >= change.updatedAt) return snapshot;
  const payload = change.payload as { id: string; updatedAt: string };
  if (!payload || payload.id !== change.entityId) return snapshot;
  const rest = list.filter((item) => item.id !== change.entityId);
  return { ...snapshot, [key]: [...rest, payload] };
}
