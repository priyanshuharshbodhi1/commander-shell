import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventJournal } from './event-journal.js';

async function scratch(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'commander-ej-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('EventJournal.record assigns monotonic sequence numbers', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const j = new EventJournal(dir);
    const e1 = await j.record({ type: 'plugin.ready', kind: 'runtime', id: 'rt1' });
    const e2 = await j.record({ type: 'plugin.ready', kind: 'agent', id: 'ag1' });
    assert.equal(e1.seq, 1);
    assert.equal(e2.seq, 2);
  } finally {
    await cleanup();
  }
});

test('EventJournal.readAll returns every recorded entry', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const j = new EventJournal(dir);
    await j.record({ type: 'session.created', sessionId: 's1', agentId: 'alice' });
    await j.record({ type: 'session.status', sessionId: 's1', status: 'running' });
    const all = await j.readAll();
    assert.equal(all.length, 2);
    assert.equal(all[0]?.signal.type, 'session.created');
  } finally {
    await cleanup();
  }
});

test('EventJournal.replay filters by signal type', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const j = new EventJournal(dir);
    await j.record({ type: 'session.created', sessionId: 's1', agentId: 'a' });
    await j.record({ type: 'session.status', sessionId: 's1', status: 'running' });
    await j.record({ type: 'session.status', sessionId: 's1', status: 'done' });
    const filtered = await j.readAll(['session.status']);
    assert.equal(filtered.length, 2);
    for (const e of filtered) assert.equal(e.signal.type, 'session.status');
  } finally {
    await cleanup();
  }
});

test('EventJournal resumes sequence from existing file on init', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const j1 = new EventJournal(dir);
    await j1.record({ type: 'plugin.ready', kind: 'runtime', id: 'rt1' });
    await j1.record({ type: 'plugin.ready', kind: 'agent', id: 'ag1' });

    const j2 = new EventJournal(dir);
    const next = await j2.record({ type: 'plugin.ready', kind: 'scm', id: 'scm1' });
    assert.equal(next.seq, 3);
  } finally {
    await cleanup();
  }
});

test('EventJournal.replay on empty journal yields nothing', async () => {
  const { dir, cleanup } = await scratch();
  try {
    const j = new EventJournal(dir);
    const all = await j.readAll();
    assert.deepEqual(all, []);
  } finally {
    await cleanup();
  }
});
