import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Project } from '@devfleet/core';
import { WorktreeWorkspace, parsePorcelain, WORKTREES_DIR } from './index.js';
import { mockExeca, mockFs } from './test-utils.js';

const project: Project = {
  id: 'svc',
  repo: 'org/svc',
  path: '/repos/svc',
  defaultBranch: 'main',
};

test('WorktreeWorkspace.create runs git worktree add with the expected path and branch', async () => {
  const { execa, calls } = mockExeca(new Map([['show-ref', { stdout: '', exitCode: 0 }]]));
  const fs = mockFs();
  const ws = new WorktreeWorkspace(execa, fs);
  const info = await ws.create(project, 'feature/x');

  const expected = path.join('/repos/svc', '..', WORKTREES_DIR, 'svc', 'feature-x');
  assert.equal(info.path, expected);
  assert.equal(info.branch, 'feature/x');
  assert.equal(info.isClean, true);
  assert.deepEqual(fs.mkdirCalls, [path.dirname(expected)]);
  const add = calls.find((c) => c.args[0] === 'worktree' && c.args[1] === 'add');
  assert.ok(add);
  assert.deepEqual(add.args, ['worktree', 'add', expected, 'feature/x']);
  assert.equal(add.cwd, '/repos/svc');
});

test('WorktreeWorkspace.create creates the branch first when missing', async () => {
  const { execa, calls } = mockExeca(new Map([['show-ref', '__throw:branch missing']]));
  const ws = new WorktreeWorkspace(execa, mockFs());
  await ws.create(project, 'feature/y');
  const branchCall = calls.find((c) => c.args[0] === 'branch');
  assert.ok(branchCall);
  assert.deepEqual(branchCall.args, ['branch', 'feature/y', 'main']);
});

test('WorktreeWorkspace.remove invokes git worktree remove --force then rmSync', async () => {
  const { execa, calls } = mockExeca(new Map());
  const fs = mockFs();
  const ws = new WorktreeWorkspace(execa, fs);
  await ws.remove('/repos/devfleet-worktrees/svc/feature-x');
  assert.deepEqual(calls[0]!.args, [
    'worktree',
    'remove',
    '--force',
    '/repos/devfleet-worktrees/svc/feature-x',
  ]);
  assert.deepEqual(fs.rmCalls, ['/repos/devfleet-worktrees/svc/feature-x']);
});

test('WorktreeWorkspace.list returns only devfleet-worktrees entries', async () => {
  const porcelain = [
    'worktree /repos/svc',
    'HEAD abc',
    'branch refs/heads/main',
    '',
    `worktree /repos/${WORKTREES_DIR}/svc/feature-x`,
    'HEAD def',
    'branch refs/heads/feature/x',
    '',
    'worktree /tmp/other',
    'HEAD 000',
    'branch refs/heads/scratch',
    '',
  ].join('\n');
  const { execa } = mockExeca(new Map([['worktree list', porcelain]]));
  const ws = new WorktreeWorkspace(execa, mockFs());
  const list = await ws.list(project);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.path, `/repos/${WORKTREES_DIR}/svc/feature-x`);
  assert.equal(list[0]!.branch, 'feature/x');
});

test('parsePorcelain handles a final block with no trailing blank line', () => {
  const out = ['worktree /a', 'HEAD x', 'branch refs/heads/b'].join('\n');
  const parsed = parsePorcelain(out);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.path, '/a');
  assert.equal(parsed[0]!.branch, 'b');
});

test('parsePorcelain marks detached worktrees', () => {
  const out = ['worktree /a', 'HEAD x', 'detached', ''].join('\n');
  const parsed = parsePorcelain(out);
  assert.equal(parsed[0]!.branch, '(detached)');
});
