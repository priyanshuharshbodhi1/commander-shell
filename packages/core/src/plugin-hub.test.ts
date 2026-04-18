import test from 'node:test';
import assert from 'node:assert/strict';
import { PluginHub, PluginNotFoundError, PluginConflictError } from './plugin-hub.js';
import type { PluginDescriptor } from './types.js';

function mkDescriptor(kind: PluginDescriptor['kind'], name: string): PluginDescriptor {
  return {
    kind,
    name,
    version: '0.0.1',
    create: () => ({ kind, name }),
  };
}

test('PluginHub registers and resolves a plugin', () => {
  const hub = new PluginHub();
  const d = mkDescriptor('runtime', 'tmux');
  hub.register(d);
  assert.equal(hub.resolve('runtime', 'tmux'), d);
});

test('PluginHub.find returns undefined for missing plugin', () => {
  const hub = new PluginHub();
  assert.equal(hub.find('agent', 'nope'), undefined);
});

test('PluginHub.resolve throws PluginNotFoundError when missing', () => {
  const hub = new PluginHub();
  assert.throws(() => hub.resolve('agent', 'ghost'), PluginNotFoundError);
});

test('PluginHub rejects duplicate (kind, name) registration', () => {
  const hub = new PluginHub();
  hub.register(mkDescriptor('tracker', 'github'));
  assert.throws(() => hub.register(mkDescriptor('tracker', 'github')), PluginConflictError);
});

test('PluginHub allows same name under different kinds', () => {
  const hub = new PluginHub();
  hub.register(mkDescriptor('tracker', 'github'));
  hub.register(mkDescriptor('scm', 'github'));
  assert.ok(hub.resolve('tracker', 'github'));
  assert.ok(hub.resolve('scm', 'github'));
});

test('PluginHub.catalog groups by kind', () => {
  const hub = new PluginHub();
  hub.register(mkDescriptor('runtime', 'tmux'));
  hub.register(mkDescriptor('agent', 'claude'));
  hub.register(mkDescriptor('agent', 'codex'));
  const cat = hub.catalog();
  assert.equal(cat.runtime.length, 1);
  assert.equal(cat.agent.length, 2);
  assert.equal(cat.scm.length, 0);
});

test('PluginHub.unregister removes the descriptor', () => {
  const hub = new PluginHub();
  hub.register(mkDescriptor('notifier', 'desktop'));
  assert.equal(hub.unregister('notifier', 'desktop'), true);
  assert.equal(hub.find('notifier', 'desktop'), undefined);
});
