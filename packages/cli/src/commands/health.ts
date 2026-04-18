import { Command } from 'commander';
import chalk from 'chalk';
import { execa } from 'execa';
import { access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, CONFIG_FILE } from '../config.js';

export interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
}

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

export async function runChecks(cwd: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Node >= 20
  const nodeVer = process.version.replace(/^v/, '');
  results.push({ label: 'Node.js >= 20', ok: semverGte(nodeVer, '20.0.0'), detail: process.version });

  // 2. pnpm
  try {
    await execa('which', ['pnpm']);
    results.push({ label: 'pnpm', ok: true });
  } catch {
    results.push({ label: 'pnpm', ok: false, detail: 'not found in PATH' });
  }

  // 3. tmux
  try {
    await execa('tmux', ['-V']);
    results.push({ label: 'tmux', ok: true });
  } catch {
    results.push({ label: 'tmux', ok: false, detail: 'not found in PATH' });
  }

  // 4. git >= 2.25
  try {
    const { stdout } = await execa('git', ['--version']);
    const match = /(\d+\.\d+(?:\.\d+)?)/.exec(stdout);
    const ver = match?.[1] ?? '0.0';
    const ok = semverGte(ver, '2.25');
    results.push({ label: 'git >= 2.25', ok, detail: ver });
  } catch {
    results.push({ label: 'git >= 2.25', ok: false, detail: 'not found in PATH' });
  }

  // 5. gh CLI
  try {
    await execa('gh', ['--version']);
    results.push({ label: 'gh CLI', ok: true });
  } catch {
    results.push({ label: 'gh CLI', ok: false, detail: 'not found in PATH' });
  }

  // 6. gh authenticated
  try {
    await execa('gh', ['auth', 'status']);
    results.push({ label: 'gh authenticated', ok: true });
  } catch {
    results.push({ label: 'gh authenticated', ok: false, detail: 'run: gh auth login' });
  }

  // 7. commander.config.yaml exists
  const configPath = path.join(cwd, CONFIG_FILE);
  try {
    await access(configPath);
    results.push({ label: `${CONFIG_FILE} exists`, ok: true });
  } catch {
    results.push({ label: `${CONFIG_FILE} exists`, ok: false, detail: `missing in ${cwd}` });
  }

  // 8. Config valid
  try {
    await loadConfig(cwd);
    results.push({ label: 'Config valid', ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    results.push({ label: 'Config valid', ok: false, detail: msg });
  }

  // 9. ~/.commander/ exists
  const homeDir = path.join(os.homedir(), '.commander');
  try {
    await access(homeDir);
    results.push({ label: '~/.commander/ exists', ok: true });
  } catch {
    results.push({ label: '~/.commander/ exists', ok: false, detail: `missing: ${homeDir}` });
  }

  // 10. commander in PATH
  try {
    await execa('which', ['commander']);
    results.push({ label: 'commander in PATH', ok: true });
  } catch {
    results.push({ label: 'commander in PATH', ok: false, detail: 'not installed globally' });
  }

  return results;
}

export function registerHealth(program: Command): void {
  program
    .command('health')
    .description('Check system requirements and configuration')
    .action(async () => {
      try {
        const checks = await runChecks(process.cwd());
        let failures = 0;

        for (const c of checks) {
          const icon = c.ok ? chalk.green('✓') : chalk.red('✗');
          const label = c.ok ? c.label : chalk.red(c.label);
          const detail = c.detail ? chalk.dim(` (${c.detail})`) : '';
          console.log(`${icon} ${label}${detail}`);
          if (!c.ok) failures++;
        }

        console.log('');
        if (failures === 0) {
          console.log(chalk.green('All checks passed.'));
        } else {
          console.log(chalk.red(`${failures} issue${failures === 1 ? '' : 's'} found.`));
          process.exit(1);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), msg);
        process.exit(1);
      }
    });
}
