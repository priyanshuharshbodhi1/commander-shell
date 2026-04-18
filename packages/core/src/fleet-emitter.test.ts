import test from 'node:test';
import assert from 'node:assert/strict';
import { FleetEmitter } from './fleet-emitter.js';
import type { FleetSignal } from './types.js';

test('FleetEmitter delivers typed signals to matching listeners', () => {
  const bus = new FleetEmitter();
  const received: FleetSignal[] = [];
  bus.on('session.status', (s) => received.push(s));
  bus.emit({ type: 'session.status', sessionId: 's1', status: 'running' });
  assert.equal(received.length, 1);
  assert.equal(received[0]?.type, 'session.status');
});

test('FleetEmitter does not leak across types', () => {
  const bus = new FleetEmitter();
  let got = 0;
  bus.on('session.created', () => got++);
  bus.emit({ type: 'session.status', sessionId: 's1', status: 'done' });
  assert.equal(got, 0);
});

test('FleetEmitter.onAny sees every signal', () => {
  const bus = new FleetEmitter();
  const seen: FleetSignal['type'][] = [];
  bus.onAny((s) => seen.push(s.type));
  bus.emit({ type: 'session.created', sessionId: 's1', agentId: 'alice' });
  bus.emit({ type: 'plugin.ready', kind: 'runtime', id: 'rt1' });
  assert.deepEqual(seen, ['session.created', 'plugin.ready']);
});

test('FleetEmitter unsubscribe stops delivery', () => {
  const bus = new FleetEmitter();
  let got = 0;
  const off = bus.on('session.created', () => got++);
  bus.emit({ type: 'session.created', sessionId: 's1', agentId: 'a' });
  off();
  bus.emit({ type: 'session.created', sessionId: 's2', agentId: 'a' });
  assert.equal(got, 1);
});

test('FleetEmitter isolates listener exceptions', () => {
  const bus = new FleetEmitter();
  let reached = false;
  bus.on('plugin.ready', () => {
    throw new Error('boom');
  });
  bus.on('plugin.ready', () => {
    reached = true;
  });
  bus.emit({ type: 'plugin.ready', kind: 'agent', id: 'x' });
  assert.equal(reached, true);
});
