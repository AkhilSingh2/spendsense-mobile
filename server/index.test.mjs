import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allChanges, createServer, memoryStore, mergeChanges } from './index.mjs';

test('later update wins and older update is ignored', () => {
  const state = {
    transactions: [{ id: 't1', updatedAt: '2026-11-02T00:00:00.000Z', note: 'old' }],
    budgets: [],
    recurring: [],
    settings: [],
  };
  const merged = mergeChanges(state, [
    {
      entity: 'transaction',
      entityId: 't1',
      op: 'upsert',
      updatedAt: '2026-11-03T00:00:00.000Z',
      payload: { id: 't1', updatedAt: '2026-11-03T00:00:00.000Z', note: 'new' },
    },
    {
      entity: 'transaction',
      entityId: 't1',
      op: 'upsert',
      updatedAt: '2026-11-01T00:00:00.000Z',
      payload: { id: 't1', updatedAt: '2026-11-01T00:00:00.000Z', note: 'stale' },
    },
  ]);
  assert.equal(merged.transactions[0].note, 'new');
});

test('sync endpoint merges and returns the ledger', async (t) => {
  const server = createServer({ token: 'secret', store: memoryStore() });
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  t.after(() => server.close());

  const denied = await fetch(`http://127.0.0.1:${port}/v1/sync`, { method: 'POST', body: '{}' });
  assert.equal(denied.status, 401);

  const ok = await fetch(`http://127.0.0.1:${port}/v1/sync`, {
    method: 'POST',
    headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      changes: [
        {
          entity: 'budget',
          entityId: 'b1',
          op: 'upsert',
          updatedAt: '2026-11-25T00:00:00.000Z',
          payload: { id: 'b1', updatedAt: '2026-11-25T00:00:00.000Z', amountMinor: 100 },
        },
      ],
    }),
  });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.changes.some((change) => change.entityId === 'b1'), true);
  assert.equal(allChanges({ transactions: [], budgets: [], recurring: [], settings: [] }).length, 0);
});
