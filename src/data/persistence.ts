import type { Snapshot } from '@/domain/types';

export interface LedgerPersistence {
  kind: 'sqlite' | 'local';
  load(): Promise<Snapshot | null>;
  replaceAll(snapshot: Snapshot): Promise<void>;
}
