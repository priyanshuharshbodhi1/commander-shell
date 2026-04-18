import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime, renderFleetTable } from './table.js';
import type { Session } from '@commander/core';

function ago(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

test('relativeTime: 0s returns just now', () => {
  assert.equal(relativeTime(ago(0)), 'just now');
});

test('relativeTime: 45s returns seconds ago', () => {
  assert.equal(relativeTime(ago(45)), '45s ago');
});

test('relativeTime: 90s returns minutes ago', () => {
  assert.equal(relativeTime(ago(90)), '1m ago');
});

test('relativeTime: 3600s returns hours ago', () => {
  assert.equal(relativeTime(ago(3600)), '1h ago');
});

test('relativeTime: 86400s returns days ago', () => {
  assert.equal(relativeTime(ago(86400)), '1d ago');
});

test('renderFleetTable: includes session id and status', () => {
  const now = new Date().toISOString();
  const sessions: Session[] = [
    {
      id: 'sess-001',
      agentId: 'proj-a',
      status: 'running',
      createdAt: now,
      updatedAt: now,
      task: { title: 'Fix bug #42', source: 'github' },
      metadata: { branch: 'fix/bug-42' },
    },
  ];

  const output = renderFleetTable(sessions);
  assert.ok(output.includes('sess-001'));
  assert.ok(output.includes('proj-a'));
  assert.ok(output.includes('Fix bug #42'));
  assert.ok(output.includes('fix/bug-42'));
});

test('renderFleetTable: handles missing task and branch', () => {
  const now = new Date().toISOString();
  const sessions: Session[] = [
    {
      id: 'sess-002',
      agentId: 'proj-b',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      metadata: {},
    },
  ];

  const output = renderFleetTable(sessions);
  assert.ok(output.includes('sess-002'));
});
