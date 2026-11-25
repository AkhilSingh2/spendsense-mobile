import { applyRemoteChanges } from '@/domain/snapshot';
import type { RemoteChange, Snapshot } from '@/domain/types';

export type SyncResult = {
  ok: boolean;
  message: string;
  snapshot: Snapshot;
};

export async function syncLedger(snapshot: Snapshot, fetchImpl: typeof fetch = fetch): Promise<SyncResult> {
  const url = snapshot.settings.syncUrl.trim();
  if (!url) {
    return {
      ok: false,
      message: 'Sync is off. Add a server URL when you want a backup.',
      snapshot,
    };
  }
  const pending = snapshot.outbox.filter((item) => !item.syncedAt);
  const response = await fetchImpl(`${url.replace(/\/$/, '')}/v1/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(snapshot.settings.syncToken ? { Authorization: `Bearer ${snapshot.settings.syncToken}` } : {}),
    },
    body: JSON.stringify({
      deviceId: snapshot.settings.deviceId,
      changes: pending.map((item) => ({
        entity: item.entity,
        entityId: item.entityId,
        op: item.op,
        updatedAt: item.updatedAt,
        payload: JSON.parse(item.payload) as unknown,
      })),
    }),
  });
  if (!response.ok) {
    return { ok: false, message: `Sync failed (${response.status}).`, snapshot };
  }
  const body = (await response.json()) as { serverTime?: string; changes?: RemoteChange[] };
  const merged = applyRemoteChanges(snapshot, body.changes ?? []);
  const pendingIds = new Set(pending.map((item) => item.id));
  const serverTime = body.serverTime ?? new Date().toISOString();
  return {
    ok: true,
    message: pending.length === 0 ? 'Already up to date.' : `Synced ${pending.length} change${pending.length === 1 ? '' : 's'}.`,
    snapshot: {
      ...merged,
      outbox: merged.outbox.filter((item) => !pendingIds.has(item.id)),
      settings: { ...merged.settings, lastSyncedAt: serverTime },
    },
  };
}
