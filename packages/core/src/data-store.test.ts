import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DataStore } from './data-store.js';
import type { Session } from './types.js';

async function scratch(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'commander-ds-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

function mkSession(overrides: Partial<Session> = {}): Session {
  const now = new Date().toISOString();
  return {
    id: 'sess-1',
    agentId: 'alice',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    metadata: {},
    ...overrides,
  };
}

test('DataStore.saveSession writes and readSession round-trips', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const store = new DataStore(dir);
    const s = mkSession({ id: 's-a', agentId: 'alice' });
    await store.saveSession(s);
    const loaded = await store.readSession('s-a');
    assert.ok(loaded);
    assert.equal(loaded.id, 's-a');
    assert.equal(loaded.agentId, 'alice');
  } finally {
    await cleanup();
  }
});

test('DataStore.readSession returns null when file is missing', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const store = new DataStore(dir);
    assert.equal(await store.readSession('nope'), null);
  } finally {
    await cleanup();
  }
});

test('DataStore.listSessions returns every saved session', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const store = new DataStore(dir);
    await store.saveSession(mkSession({ id: 's-a', createdAt: '2024-01-01T00:00:00Z' }));
    await store.saveSession(mkSession({ id: 's-b', createdAt: '2024-02-01T00:00:00Z' }));
    const all = await store.listSessions();
    assert.equal(all.length, 2);
    assert.equal(all[0]?.id, 's-b');
  } finally {
    await cleanup();
  }
});

test('DataStore.deleteSession removes the file', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const store = new DataStore(dir);
    await store.saveSession(mkSession({ id: 's-a' }));
    assert.equal(await store.deleteSession('s-a'), true);
    assert.equal(await store.readSession('s-a'), null);
    assert.equal(await store.deleteSession('s-a'), false);
  } finally {
    await cleanup();
  }
});

test('DataStore.listSessions on empty root returns []', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const store = new DataStore(dir);
    assert.deepEqual(await store.listSessions(), []);
  } finally {
    await cleanup();
  }
});
