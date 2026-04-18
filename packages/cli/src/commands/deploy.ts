import { Command } from 'commander';
import chalk from 'chalk';
import { execa } from 'execa';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import open from 'open';
import { DataStore } from '@commander/core';
import { loadConfig, CONFIG_FILE } from '../config.js';
import { withSpinner } from '../ui/spinner.js';
import { runChecks } from './health.js';
import { runInitWizard, buildConfigYaml } from './init.js';
import { writeFile } from 'node:fs/promises';

async function resolveTarget(target: string | undefined): Promise<string> {
  if (!target) return process.cwd();

  if (/^https?:\/\//.test(target) || /^git@/.test(target) || target.startsWith('github.com')) {
    const url = target.startsWith('github.com') ? `https://${target}` : target;
    const repoName = url.split('/').pop()?.replace(/\.git$/, '') ?? 'repo';
    const dest = path.join(process.cwd(), repoName);
    await withSpinner(`Cloning ${url}`, () => execa('git', ['clone', url, dest]));
    return dest;
  }

  try {
    await access(target);
    return path.resolve(target);
  } catch {
    throw new Error(`Path does not exist: ${target}`);
  }
}

export function registerDeploy(program: Command): void {
  program
    .command('deploy [target]')
    .description('Deploy a project (GitHub URL, local path, or cwd)')
    .option('--open', 'Open dashboard in browser after start')
    .option('--port <n>', 'Override port', '3000')
    .option('--config <path>', 'Path to config file')
    .action(async (target: string | undefined, opts: { open?: boolean; port: string; config?: string }) => {
      try {
        const cwd = await resolveTarget(target);
        const configPath = path.join(cwd, CONFIG_FILE);

        let configExists = true;
        try {
          await access(configPath);
        } catch {
          configExists = false;
        }

        if (!configExists) {
          console.log(chalk.yellow(`No ${CONFIG_FILE} found. Running init wizard...\n`));
          const answers = await runInitWizard(cwd);
          const yaml = buildConfigYaml(answers);
          await writeFile(configPath, yaml, 'utf8');
        }

        let config;
        try {
          config = await loadConfig(cwd);
        } catch (err) {
          if (err instanceof Error) {
            console.error(chalk.red('Config error:'), err.message);
          }
          process.exit(1);
        }

        const checks = await runChecks(cwd);
        const failures = checks.filter((c) => !c.ok);
        if (failures.length > 0) {
          console.error(chalk.red('Health checks failed:'));
          for (const f of failures) {
            console.error(chalk.red(`  ✗ ${f.label}${f.detail ? ` (${f.detail})` : ''}`));
          }
          process.exit(1);
        }

        const dataRoot = path.join(os.homedir(), '.commander', config.fleet.name);
        await mkdir(dataRoot, { recursive: true });
        const store = new DataStore(dataRoot);
        await store.init();

        const port = parseInt(opts.port, 10);
        const dashboardUrl = `http://localhost:${port}`;

        console.log('');
        console.log(chalk.bold('┌─────────────────────────────────────┐'));
        console.log(chalk.bold(`│  ${chalk.cyan('Commander')} — ${config.fleet.name.padEnd(25)}│`));
        console.log(chalk.bold('├─────────────────────────────────────┤'));
        console.log(`│  Agents:    ${config.agents.length.toString().padEnd(25)}│`);
        console.log(`│  Agent:     ${(config.agents[0]?.agent ?? '-').padEnd(25)}│`);
        console.log(`│  Runtime:   ${(config.agents[0]?.runtime ?? '-').padEnd(25)}│`);
        console.log(`│  Dashboard: ${dashboardUrl.padEnd(25)}│`);
        console.log(chalk.bold('└─────────────────────────────────────┘'));
        console.log('');
        console.log(chalk.dim('ℹ Dashboard arrives in Phase 5'));

        if (opts.open) {
          await open(dashboardUrl);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), msg);
        process.exit(1);
      }
    });
}
