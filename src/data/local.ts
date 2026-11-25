import type { Snapshot } from '@/domain/types';
import type { LedgerPersistence } from '@/data/persistence';

const KEY = 'spendsense.ledger.v1';

function browserStorage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export class LocalPersistence implements LedgerPersistence {
  kind = 'local' as const;
  private memory: Snapshot | null = null;

  static open(): LocalPersistence {
    const store = new LocalPersistence();
    const raw = browserStorage()?.getItem(KEY);
    if (!raw) return store;
    try {
      store.memory = JSON.parse(raw) as Snapshot;
    } catch {
      store.memory = null;
    }
    return store;
  }

  async load(): Promise<Snapshot | null> {
    return this.memory;
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    this.memory = snapshot;
    try {
      browserStorage()?.setItem(KEY, JSON.stringify(snapshot));
    } catch {
      // A full ledger still lives in memory for this session.
    }
  }
}
