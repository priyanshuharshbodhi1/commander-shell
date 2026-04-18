import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFleetTable } from '../ui/table.js';
import type { Session } from '@commander/core';

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date().toISOString();
  return {
    id: 'sess-test',
    agentId: 'agent-1',
    status: 'running',
    createdAt: now,
    updatedAt: now,
    metadata: {},
    ...overrides,
  };
}

test('fleet table: renders all six column headers', () => {
  const output = renderFleetTable([makeSession()]);
  assert.ok(output.includes('SESSION'));
  assert.ok(output.includes('PROJECT'));
  assert.ok(output.includes('ISSUE'));
  assert.ok(output.includes('STATUS'));
  assert.ok(output.includes('BRANCH'));
  assert.ok(output.includes('UPDATED'));
});

test('fleet table: all session statuses render without error', () => {
  const statuses: Session['status'][] = ['pending', 'running', 'waiting', 'done', 'failed', 'cancelled'];
  for (const status of statuses) {
    const output = renderFleetTable([makeSession({ status })]);
    assert.ok(output.includes('sess-test'), `should render session with status: ${status}`);
  }
});

test('fleet table: empty sessions produces header-only table', () => {
  const output = renderFleetTable([]);
  assert.ok(output.includes('SESSION'));
  assert.ok(!output.includes('sess-'));
});

test('fleet table: multiple sessions all appear', () => {
  const sessions = [
    makeSession({ id: 'sess-aaa', agentId: 'proj-1', status: 'running' }),
    makeSession({ id: 'sess-bbb', agentId: 'proj-2', status: 'done' }),
    makeSession({ id: 'sess-ccc', agentId: 'proj-3', status: 'failed' }),
  ];
  const output = renderFleetTable(sessions);
  assert.ok(output.includes('sess-aaa'));
  assert.ok(output.includes('sess-bbb'));
  assert.ok(output.includes('sess-ccc'));
});
