import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeAgent } from './index.js';

test('ClaudeAgent.buildCommand defaults: skip-permissions flag and quoted prompt', () => {
  const cmd = new ClaudeAgent().buildCommand({ prompt: 'do the thing' });
  assert.equal(cmd, 'claude --dangerously-skip-permissions "do the thing"');
});

test('ClaudeAgent.buildCommand appends --model when provided', () => {
  const cmd = new ClaudeAgent().buildCommand({ prompt: 'p', model: 'opus' });
  assert.match(cmd, /--model opus/);
});

test('ClaudeAgent.buildCommand appends --allowedTools as csv', () => {
  const cmd = new ClaudeAgent().buildCommand({
    prompt: 'p',
    allowedTools: ['Read', 'Edit', 'Bash'],
  });
  assert.match(cmd, /--allowedTools Read,Edit,Bash/);
});

test('ClaudeAgent.buildCommand omits --allowedTools when empty', () => {
  const cmd = new ClaudeAgent().buildCommand({ prompt: 'p', allowedTools: [] });
  assert.doesNotMatch(cmd, /--allowedTools/);
});

test('ClaudeAgent.buildCommand escapes embedded quotes in prompt', () => {
  const cmd = new ClaudeAgent().buildCommand({ prompt: 'say "hi"' });
  assert.match(cmd, /"say \\"hi\\""/);
});

test('ClaudeAgent.buildPrompt embeds issue + project + branch', () => {
  const prompt = new ClaudeAgent().buildPrompt(
    { id: '42', title: 'Fix login', body: 'Auth breaks on retry.' },
    { id: 'app', repo: 'org/app', path: '/r', defaultBranch: 'main' },
  );
  assert.match(prompt, /issue #42: Fix login/);
  assert.match(prompt, /Repository: org\/app/);
  assert.match(prompt, /Branch: commander\/app\/issue-42/);
  assert.match(prompt, /Auth breaks on retry\./);
  assert.match(prompt, /Do not push/);
});
