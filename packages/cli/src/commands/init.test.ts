import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfigYaml } from './init.js';
import { parse as parseYaml } from 'yaml';
import os from 'node:os';
import path from 'node:path';
import type { InitAnswers } from './init.js';

const baseAnswers: InitAnswers = {
  projectId: 'my-project',
  githubRepo: 'acme/my-project',
  localPath: '/home/user/my-project',
  branch: 'main',
  agent: 'claude-code',
  runtime: 'tmux',
  port: 3000,
  autoFixCi: true,
  autoReviewComments: true,
};

test('buildConfigYaml: produces valid YAML with fleet.name', () => {
  const yaml = buildConfigYaml(baseAnswers);
  const doc = parseYaml(yaml) as Record<string, unknown>;

  assert.ok(typeof doc === 'object' && doc !== null);
  const fleet = doc['fleet'] as Record<string, unknown>;
  assert.equal(fleet['name'], 'my-project');
});

test('buildConfigYaml: dataRoot under ~/.commander', () => {
  const yaml = buildConfigYaml(baseAnswers);
  const doc = parseYaml(yaml) as Record<string, unknown>;
  const fleet = doc['fleet'] as Record<string, unknown>;
  const expected = path.join(os.homedir(), '.commander', 'my-project');
  assert.equal(fleet['dataRoot'], expected);
});

test('buildConfigYaml: plugins includes runtime and agent', () => {
  const yaml = buildConfigYaml(baseAnswers);
  const doc = parseYaml(yaml) as Record<string, unknown>;
  const plugins = doc['plugins'] as Array<Record<string, unknown>>;

  assert.ok(plugins.some((p) => p['kind'] === 'runtime' && p['name'] === 'tmux'));
  assert.ok(plugins.some((p) => p['kind'] === 'agent' && p['name'] === 'claude-code'));
});

test('buildConfigYaml: agents array has one default agent', () => {
  const yaml = buildConfigYaml(baseAnswers);
  const doc = parseYaml(yaml) as Record<string, unknown>;
  const agents = doc['agents'] as Array<Record<string, unknown>>;

  assert.equal(agents.length, 1);
  assert.equal(agents[0]?.['id'], 'default');
  assert.equal(agents[0]?.['runtime'], 'tmux');
  assert.equal(agents[0]?.['agent'], 'claude-code');
});

test('buildConfigYaml: commander section includes github and port', () => {
  const yaml = buildConfigYaml(baseAnswers);
  const doc = parseYaml(yaml) as Record<string, unknown>;
  const commander = doc['commander'] as Record<string, unknown>;

  assert.equal(commander['github'], 'acme/my-project');
  assert.equal(commander['port'], 3000);
  assert.equal(commander['autoFixCi'], true);
  assert.equal(commander['branch'], 'main');
});

test('buildConfigYaml: codex agent variant', () => {
  const yaml = buildConfigYaml({ ...baseAnswers, agent: 'codex', runtime: 'process' });
  const doc = parseYaml(yaml) as Record<string, unknown>;
  const plugins = doc['plugins'] as Array<Record<string, unknown>>;

  assert.ok(plugins.some((p) => p['kind'] === 'agent' && p['name'] === 'codex'));
  assert.ok(plugins.some((p) => p['kind'] === 'runtime' && p['name'] === 'process'));
});
