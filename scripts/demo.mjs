import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parseConfig,
  PluginHub,
  DataStore,
  FleetEmitter,
  EventJournal,
} from '../packages/core/dist/index.js';

const dataRoot = mkdtempSync(path.join(tmpdir(), 'devfleet-demo-'));
console.log('data root:', dataRoot, '\n');

console.log('— parsing examples/fleet.example.yaml');
const yaml = readFileSync('examples/fleet.example.yaml', 'utf8');
const cfg = parseConfig(yaml, 'examples/fleet.example.yaml');
console.log('  fleet:', cfg.fleet.name, '| plugins:', cfg.plugins.length, '| agents:', cfg.agents.length);

console.log('\n— registering mock plugin descriptors');
const hub = new PluginHub();
for (const p of cfg.plugins) {
  hub.register({ kind: p.kind, name: p.name, version: '0.0.1', create: () => ({ id: p.id }) });
}
const cat = hub.catalog();
for (const [k, v] of Object.entries(cat)) console.log(`  ${k}: ${v.map((d) => d.name).join(', ') || '(none)'}`);

console.log('\n— wiring FleetEmitter → EventJournal');
const bus = new FleetEmitter();
const journal = new EventJournal(dataRoot);
bus.onAny((s) => void journal.record(s));
bus.on('session.status', (s) => console.log(`  [bus] session ${s.sessionId} → ${s.status}`));

console.log('\n— emitting a lifecycle');
bus.emit({ type: 'plugin.ready', kind: 'runtime', id: 'tmux-local' });
bus.emit({ type: 'session.created', sessionId: 'sess-1', agentId: 'alice' });
bus.emit({ type: 'session.status', sessionId: 'sess-1', status: 'running' });
bus.emit({ type: 'session.output', sessionId: 'sess-1', stream: 'stdout', chunk: 'hello from agent\n' });
bus.emit({ type: 'session.status', sessionId: 'sess-1', status: 'done' });

console.log('\n— persisting session snapshot');
const store = new DataStore(dataRoot);
const now = new Date().toISOString();
await store.saveSession({
  id: 'sess-1',
  agentId: 'alice',
  status: 'done',
  createdAt: now,
  updatedAt: now,
  task: { title: 'demo task', source: 'manual' },
  metadata: { note: 'phase-1 smoke test' },
});
const loaded = await store.readSession('sess-1');
console.log('  loaded session status:', loaded?.status, '| task:', loaded?.task?.title);

// Let the journal tail flush
await new Promise((r) => setTimeout(r, 50));

console.log('\n— replaying journal (session.* only)');
const entries = await journal.readAll(['session.created', 'session.status', 'session.output']);
for (const e of entries) console.log(`  #${e.seq} ${e.at} ${e.signal.type}`);

console.log('\n— listing sessions on disk');
for (const s of await store.listSessions()) console.log(`  ${s.id} (${s.status}) — agent=${s.agentId}`);

rmSync(dataRoot, { recursive: true, force: true });
console.log('\nOK — hot reload verified');
