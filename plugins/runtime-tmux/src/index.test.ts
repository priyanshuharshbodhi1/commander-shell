import test from 'node:test';
import assert from 'node:assert/strict';
import type { Session } from '@commander/core';
import { TmuxRuntime } from './index.js';
import { mockExeca } from './test-utils.js';

function mkSession(id: string, workspacePath = '/tmp/wt'): Session {
  return {
    id,
    agentId: 'a1',
    status: 'pending',
    createdAt: '2026-04-18T00:00:00Z',
    updatedAt: '2026-04-18T00:00:00Z',
    workspacePath,
    metadata: {},
  };
}

test('TmuxRuntime.start invokes new-session then send-keys', async () => {
  const { execa, calls } = mockExeca(new Map());
  const r = new TmuxRuntime(execa);
  await r.start(mkSession('s1', '/work'), 'echo hi');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    file: 'tmux',
    args: ['new-session', '-d', '-s', 'commander-s1', '-c', '/work'],
  });
  assert.deepEqual(calls[1], {
    file: 'tmux',
    args: ['send-keys', '-t', 'commander-s1', 'echo hi', 'Enter'],
  });
});

test('TmuxRuntime.start prefers opts.cwd over session.workspacePath', async () => {
  const { execa, calls } = mockExeca(new Map());
  const r = new TmuxRuntime(execa);
  await r.start(mkSession('s2', '/work'), 'cmd', { cwd: '/override' });
  assert.equal(calls[0]!.args[5], '/override');
});

test('TmuxRuntime.stop swallows "no server running"', async () => {
  const { execa } = mockExeca(new Map([['kill-session', '__throw:no server running on /tmp']]));
  const r = new TmuxRuntime(execa);
  await r.stop('s1');
});

test('TmuxRuntime.stop rethrows unknown errors', async () => {
  const { execa } = mockExeca(new Map([['kill-session', '__throw:permission denied']]));
  const r = new TmuxRuntime(execa);
  await assert.rejects(() => r.stop('s1'), /permission denied/);
});

test('TmuxRuntime.send delivers message with Enter', async () => {
  const { execa, calls } = mockExeca(new Map());
  const r = new TmuxRuntime(execa);
  await r.send('s1', 'hello');
  assert.deepEqual(calls[0]!.args, ['send-keys', '-t', 'commander-s1', 'hello', 'Enter']);
});

test('TmuxRuntime.isRunning returns true on success, false on throw', async () => {
  const ok = mockExeca(new Map());
  assert.equal(await new TmuxRuntime(ok.execa).isRunning('s1'), true);
  const fail = mockExeca(new Map([['has-session', '__throw:no session']]));
  assert.equal(await new TmuxRuntime(fail.execa).isRunning('s1'), false);
});

test('TmuxRuntime.getOutput captures the last N lines', async () => {
  const { execa, calls } = mockExeca(new Map([['capture-pane', 'line1\nline2']]));
  const out = await new TmuxRuntime(execa).getOutput('s1', 100);
  assert.equal(out, 'line1\nline2');
  assert.deepEqual(calls[0]!.args, ['capture-pane', '-t', 'commander-s1', '-p', '-S', '-100']);
});

test('TmuxRuntime.list filters and strips prefix', async () => {
  const { execa } = mockExeca(
    new Map([['list-sessions', 'commander-alpha\nother\ncommander-beta\n']]),
  );
  const ids = await new TmuxRuntime(execa).list();
  assert.deepEqual(ids, ['alpha', 'beta']);
});

test('TmuxRuntime.list returns [] when no tmux server is running', async () => {
  const { execa } = mockExeca(new Map([['list-sessions', '__throw:no server running']]));
  const ids = await new TmuxRuntime(execa).list();
  assert.deepEqual(ids, []);
});
