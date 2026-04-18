import test from 'node:test';
import assert from 'node:assert/strict';
import { CodexAgent } from './index.js';

test('CodexAgent.buildCommand emits codex with quoted prompt', () => {
  assert.equal(new CodexAgent().buildCommand({ prompt: 'hello' }), 'codex "hello"');
});

test('CodexAgent.buildCommand appends --model when provided', () => {
  const cmd = new CodexAgent().buildCommand({ prompt: 'p', model: 'gpt-5' });
  assert.equal(cmd, 'codex "p" --model gpt-5');
});

test('CodexAgent.buildCommand ignores allowedTools (codex has no such flag)', () => {
  const cmd = new CodexAgent().buildCommand({ prompt: 'p', allowedTools: ['Read'] });
  assert.doesNotMatch(cmd, /--allowedTools/);
});

test('CodexAgent.buildPrompt mirrors claude prompt structure', () => {
  const prompt = new CodexAgent().buildPrompt(
    { id: '7', title: 'X', body: 'why' },
    { id: 'svc', repo: 'o/svc', path: '/r', defaultBranch: 'main' },
  );
  assert.match(prompt, /issue #7: X/);
  assert.match(prompt, /Branch: devfleet\/svc\/issue-7/);
  assert.match(prompt, /why/);
});
