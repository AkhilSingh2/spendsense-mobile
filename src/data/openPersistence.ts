import { LocalPersistence } from '@/data/local';
import type { LedgerPersistence } from '@/data/persistence';
import { SqlitePersistence } from '@/data/sqlite';

export async function openPersistence(): Promise<LedgerPersistence> {
  try {
    return await Promise.race([
      SqlitePersistence.open(),
      new Promise<LedgerPersistence>((_, reject) => {
        setTimeout(() => reject(new Error('SQLite open timed out')), 4000);
      }),
    ]);
  } catch (error) {
    console.warn('SQLite unavailable, using local snapshot storage.', error);
    return LocalPersistence.open();
  }
}
