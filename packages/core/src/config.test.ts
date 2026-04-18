import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, parseConfig } from './config.js';

const validYaml = `
fleet:
  name: demo
  dataRoot: ./.commander
plugins:
  - { kind: runtime, name: tmux, id: default-runtime, options: {} }
  - { kind: agent, name: claude-code, id: primary-agent, options: {} }
  - { kind: workspace, name: worktree, id: default-ws, options: {} }
agents:
  - id: alice
    runtime: default-runtime
    agent: primary-agent
    workspace: default-ws
`;

test('parseConfig accepts a well-formed fleet', () => {
  const cfg = parseConfig(validYaml, 'test.yaml');
  assert.equal(cfg.fleet.name, 'demo');
  assert.equal(cfg.agents.length, 1);
  assert.equal(cfg.agents[0]?.id, 'alice');
  assert.equal(cfg.plugins.length, 3);
});

test('parseConfig applies defaults for missing options', () => {
  const cfg = parseConfig(validYaml);
  assert.deepEqual(cfg.plugins[0]?.options, {});
  assert.deepEqual(cfg.agents[0]?.options, {});
});

test('parseConfig rejects malformed YAML', () => {
  assert.throws(() => parseConfig(':\n  - [unterminated', 'bad.yaml'), ConfigError);
});

test('parseConfig rejects missing fleet.name', () => {
  const yaml = `
fleet:
  dataRoot: ./data
plugins: []
agents: []
`;
  assert.throws(() => parseConfig(yaml, 'bad.yaml'), (err: unknown) => {
    assert.ok(err instanceof ConfigError);
    assert.match(err.message, /fleet\.name/);
    return true;
  });
});

test('parseConfig rejects agent referencing unknown plugin id', () => {
  const yaml = `
fleet:
  name: demo
  dataRoot: ./data
plugins:
  - { kind: runtime, name: tmux, id: rt1, options: {} }
  - { kind: agent, name: claude, id: ag1, options: {} }
  - { kind: workspace, name: worktree, id: ws1, options: {} }
agents:
  - id: bob
    runtime: rt1
    agent: ag1
    workspace: ws-missing
`;
  assert.throws(() => parseConfig(yaml, 'bad.yaml'), (err: unknown) => {
    assert.ok(err instanceof ConfigError);
    assert.match(err.message, /workspace.*ws-missing/);
    return true;
  });
});

test('parseConfig rejects non-mapping root', () => {
  assert.throws(() => parseConfig('- just a list\n- of items', 'bad.yaml'), ConfigError);
});
