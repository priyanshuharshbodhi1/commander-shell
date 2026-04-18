import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const WATCHED = [
  path.join(ROOT, 'packages/core/dist'),
  path.join(ROOT, 'packages/cli/dist'),
];

let child = null;
let pending = null;

function runDemo() {
  if (child) {
    child.kill('SIGTERM');
    child = null;
  }
  process.stdout.write('\n\x1b[36m━━━ re-running demo @ ' + new Date().toLocaleTimeString() + ' ━━━\x1b[0m\n');
  child = spawn(process.execPath, ['scripts/demo.mjs'], { cwd: ROOT, stdio: 'inherit' });
  child.on('exit', () => {
    child = null;
  });
}

function schedule() {
  if (pending) clearTimeout(pending);
  pending = setTimeout(runDemo, 250);
}

for (const dir of WATCHED) {
  try {
    watch(dir, { recursive: true }, (_evt, file) => {
      if (!file || !file.endsWith('.js')) return;
      schedule();
    });
    process.stdout.write(`watching ${dir}\n`);
  } catch (err) {
    process.stdout.write(`skip ${dir}: ${err.message}\n`);
  }
}

runDemo();
process.on('SIGINT', () => {
  if (child) child.kill('SIGTERM');
  process.exit(0);
});
