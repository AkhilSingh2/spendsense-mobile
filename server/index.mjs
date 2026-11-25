import { createServer as createHttpServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'store.json');

export function emptyState() {
  return { transactions: [], budgets: [], recurring: [], settings: [] };
}

function bucketFor(entity) {
  if (entity === 'transaction') return 'transactions';
  if (entity === 'budget') return 'budgets';
  if (entity === 'recurring') return 'recurring';
  if (entity === 'settings') return 'settings';
  return null;
}

export function mergeChanges(state, changes) {
  const next = {
    transactions: [...(state.transactions ?? [])],
    budgets: [...(state.budgets ?? [])],
    recurring: [...(state.recurring ?? [])],
    settings: [...(state.settings ?? [])],
  };
  for (const change of changes ?? []) {
    const bucket = bucketFor(change.entity);
    if (!bucket || !change?.payload || !change.entityId) continue;
    const list = next[bucket];
    const index = list.findIndex((item) => item.id === change.entityId);
    const incoming = {
      ...change.payload,
      id: change.entityId,
      updatedAt: change.updatedAt || change.payload.updatedAt || '',
    };
    if (index === -1) {
      list.push(incoming);
      continue;
    }
    if (incoming.updatedAt >= (list[index].updatedAt || '')) list[index] = incoming;
  }
  return next;
}

export function allChanges(state) {
  const rows = [];
  for (const [entity, bucket] of [
    ['transaction', 'transactions'],
    ['budget', 'budgets'],
    ['recurring', 'recurring'],
    ['settings', 'settings'],
  ]) {
    for (const item of state[bucket] ?? []) {
      rows.push({
        entity,
        entityId: item.id,
        op: 'upsert',
        updatedAt: item.updatedAt,
        payload: item,
      });
    }
  }
  return rows;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function fileStore(file) {
  return {
    load() {
      try {
        return JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        return emptyState();
      }
    },
    save(state) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(state, null, 2));
    },
  };
}

export function memoryStore(initial = emptyState()) {
  let state = initial;
  return {
    load() {
      return state;
    },
    save(next) {
      state = next;
    },
  };
}

export function createServer({ token = '', store = fileStore(dataFile) } = {}) {
  return createHttpServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, { ok: true });
      return;
    }
    if (url.pathname === '/v1/sync' && (req.method === 'GET' || req.method === 'POST')) {
      if (token) {
        const header = req.headers.authorization ?? '';
        if (header !== `Bearer ${token}`) {
          send(res, 401, { error: 'Unauthorized' });
          return;
        }
      }
      if (req.method === 'GET') {
        send(res, 200, { serverTime: new Date().toISOString(), changes: allChanges(store.load()) });
        return;
      }
      try {
        const body = await readBody(req);
        const merged = mergeChanges(store.load(), body.changes ?? []);
        store.save(merged);
        send(res, 200, { serverTime: new Date().toISOString(), changes: allChanges(merged) });
      } catch {
        send(res, 400, { error: 'Expected JSON.' });
      }
      return;
    }
    send(res, 404, { error: 'Not found' });
  });
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = fileURLToPath(import.meta.url);
if (entry === self) {
  const port = Number(process.env.PORT ?? 8787);
  createServer({ token: process.env.SYNC_TOKEN ?? '' }).listen(port, () => {
    console.log(`SpendSense sync listening on http://localhost:${port}`);
  });
}
