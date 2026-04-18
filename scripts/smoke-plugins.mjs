// Smoke test: load each built plugin descriptor, register in a PluginHub,
// instantiate each via descriptor.create(), and assert the instance shape.
// Uses a stub execa so tests don't need tmux/git/gh installed.
import { PluginHub } from '../packages/core/dist/index.js';
import runtimeTmux from '../plugins/runtime-tmux/dist/index.js';
import agentClaude from '../plugins/agent-claude/dist/index.js';
import agentCodex from '../plugins/agent-codex/dist/index.js';
import workspaceWorktree from '../plugins/workspace-worktree/dist/index.js';
import scmGithub from '../plugins/scm-github/dist/index.js';
import assert from 'node:assert/strict';

const stubExeca = async () => ({ stdout: '', stderr: '', exitCode: 0 });
const stubFs = { mkdirSync() {}, rmSync() {} };

const hub = new PluginHub();
for (const d of [runtimeTmux, agentClaude, agentCodex, workspaceWorktree, scmGithub]) {
  hub.register(d);
}

const cat = hub.catalog();
assert.equal(cat.runtime.length, 1);
assert.equal(cat.agent.length, 2);
assert.equal(cat.workspace.length, 1);
assert.equal(cat.scm.length, 1);

const tmux = await runtimeTmux.create({ execa: stubExeca });
assert.equal(typeof tmux.start, 'function');
assert.deepEqual(await tmux.list(), []);

const claude = await agentClaude.create({});
assert.match(claude.buildCommand({ prompt: 'p' }), /^claude --dangerously-skip-permissions/);

const codex = await agentCodex.create({});
assert.match(codex.buildCommand({ prompt: 'p' }), /^codex /);

const wt = await workspaceWorktree.create({ execa: stubExeca, fs: stubFs });
assert.equal(typeof wt.create, 'function');

const gh = await scmGithub.create({ execa: stubExeca });
assert.equal(typeof gh.createPR, 'function');

console.log('smoke OK: 5 descriptors registered + instantiated');
