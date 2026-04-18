import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubSCM } from './index.js';
import { mockExeca } from './test-utils.js';

test('GitHubSCM.createPR sends the expected gh args and parses URL + number', async () => {
  const { execa, calls } = mockExeca(
    new Map([
      ['pr create', 'https://github.com/org/repo/pull/42'],
      ['pr view https://github.com/org/repo/pull/42', '42'],
    ]),
  );
  const pr = await new GitHubSCM(execa).createPR({
    repo: 'org/repo',
    head: 'feature/x',
    base: 'main',
    title: 'My PR',
    body: 'Body text',
  });

  assert.equal(pr.number, 42);
  assert.equal(pr.url, 'https://github.com/org/repo/pull/42');
  assert.equal(pr.state, 'open');
  assert.equal(pr.title, 'My PR');

  const create = calls[0]!;
  assert.deepEqual(create.args, [
    'pr', 'create',
    '--repo', 'org/repo',
    '--head', 'feature/x',
    '--base', 'main',
    '--title', 'My PR',
    '--body', 'Body text',
  ]);
});

test('GitHubSCM.createPR appends --draft and reflects state', async () => {
  const { execa, calls } = mockExeca(
    new Map([
      ['pr create', 'https://github.com/o/r/pull/9'],
      ['pr view', '9'],
    ]),
  );
  const pr = await new GitHubSCM(execa).createPR({
    repo: 'o/r', head: 'h', base: 'main', title: 't', body: 'b', draft: true,
  });
  assert.equal(pr.state, 'draft');
  assert.ok(calls[0]!.args.includes('--draft'));
});

test('GitHubSCM.getCIStatus parses JSONL and rolls up to failure on any failure', async () => {
  const lines = [
    JSON.stringify({ name: 'lint', status: 'completed', conclusion: 'success', html_url: 'http://l' }),
    JSON.stringify({ name: 'test', status: 'completed', conclusion: 'failure', html_url: 'http://t' }),
    JSON.stringify({ name: 'build', status: 'in_progress', conclusion: null }),
  ].join('\n');
  const { execa } = mockExeca(new Map([['check-runs', lines]]));
  const status = await new GitHubSCM(execa).getCIStatus('o/r', 'abc123');
  assert.equal(status.checks.length, 3);
  assert.equal(status.state, 'failure');
  assert.equal(status.checks[0]!.state, 'success');
  assert.equal(status.checks[2]!.state, 'pending');
});

test('GitHubSCM.getCIStatus rolls up to pending when nothing failed but some still running', async () => {
  const lines = [
    JSON.stringify({ name: 'a', status: 'completed', conclusion: 'success' }),
    JSON.stringify({ name: 'b', status: 'in_progress', conclusion: null }),
  ].join('\n');
  const { execa } = mockExeca(new Map([['check-runs', lines]]));
  assert.equal((await new GitHubSCM(execa).getCIStatus('o/r', 'sha')).state, 'pending');
});

test('GitHubSCM.getPRStatus maps reviews and statusCheckRollup', async () => {
  const payload = JSON.stringify({
    number: 5,
    url: 'https://x/5',
    state: 'OPEN',
    title: 'T',
    statusCheckRollup: [
      { name: 'ci', status: 'completed', conclusion: 'success' },
    ],
    reviews: [{ state: 'COMMENTED' }, { state: 'APPROVED' }],
  });
  const { execa } = mockExeca(new Map([['pr view', payload]]));
  const pr = await new GitHubSCM(execa).getPRStatus('o/r', 5);
  assert.equal(pr.state, 'open');
  assert.equal(pr.reviewState, 'approved');
  assert.equal(pr.ci?.state, 'success');
});

test('GitHubSCM.getReviewComments parses JSONL into typed comments', async () => {
  const lines = [
    JSON.stringify({
      id: 1, user: 'alice', body: 'nit', path: 'a.ts', line: 12, created_at: '2026-04-18T00:00:00Z',
    }),
    JSON.stringify({
      id: 2, user: 'bob', body: 'lgtm', path: 'b.ts', line: null, created_at: '2026-04-18T00:01:00Z',
    }),
  ].join('\n');
  const { execa } = mockExeca(new Map([['pulls/7/comments', lines]]));
  const comments = await new GitHubSCM(execa).getReviewComments('o/r', 7);
  assert.equal(comments.length, 2);
  assert.equal(comments[0]!.user, 'alice');
  assert.equal(comments[0]!.line, 12);
  assert.equal(comments[1]!.line, undefined);
});
