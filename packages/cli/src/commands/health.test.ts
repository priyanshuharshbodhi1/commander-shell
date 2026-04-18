import { test } from 'node:test';
import assert from 'node:assert/strict';

test('semverGte logic: node >= 20 passes on v20+', () => {
  function semverGte(version: string, min: string): boolean {
    const parts = version.split('.').map(Number);
    const minParts = min.split('.').map(Number);
    for (let i = 0; i < minParts.length; i++) {
      const a = parts[i] ?? 0;
      const b = minParts[i] ?? 0;
      if (a !== b) return a > b;
    }
    return true;
  }

  assert.ok(semverGte('20.0.0', '20.0.0'));
  assert.ok(semverGte('22.5.1', '20.0.0'));
  assert.ok(!semverGte('18.12.0', '20.0.0'));
  assert.ok(semverGte('2.34.1', '2.25'));
  assert.ok(semverGte('2.25.0', '2.25'));
  assert.ok(!semverGte('2.24.9', '2.25'));
});

test('health checks produce correct shape', async () => {
  // Verify that runChecks returns an array of CheckResult objects.
  // We only test the shape here since actual checks depend on system env.
  const { runChecks } = await import('./health.js');
  const checks = await runChecks(process.cwd());

  assert.ok(Array.isArray(checks));
  assert.ok(checks.length === 10);

  for (const c of checks) {
    assert.ok(typeof c.label === 'string');
    assert.ok(typeof c.ok === 'boolean');
  }
});

test('health check labels include expected items', async () => {
  const { runChecks } = await import('./health.js');
  const checks = await runChecks(process.cwd());
  const labels = checks.map((c) => c.label);

  assert.ok(labels.some((l) => l.includes('Node')));
  assert.ok(labels.some((l) => l.includes('git')));
  assert.ok(labels.some((l) => l.includes('commander.config.yaml')));
  assert.ok(labels.some((l) => l.includes('.commander')));
});
