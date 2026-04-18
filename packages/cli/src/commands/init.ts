import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { stringify as toYaml } from 'yaml';
import { writeFile, access } from 'node:fs/promises';
import { execa } from 'execa';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, CONFIG_FILE } from '../config.js';

export interface InitAnswers {
  projectId: string;
  githubRepo: string;
  localPath: string;
  branch: string;
  agent: 'claude-code' | 'codex';
  runtime: 'tmux' | 'process';
  port: number;
  autoFixCi: boolean;
  autoReviewComments: boolean;
}

export function buildConfigYaml(answers: InitAnswers): string {
  const dataRoot = path.join(os.homedir(), '.commander', answers.projectId);
  const doc = {
    fleet: {
      name: answers.projectId,
      dataRoot,
    },
    plugins: [
      { kind: 'runtime', name: answers.runtime, id: answers.runtime, options: {} },
      { kind: 'agent', name: answers.agent, id: answers.agent, options: {} },
      { kind: 'workspace', name: 'local', id: 'local', options: { path: answers.localPath } },
    ],
    agents: [
      {
        id: 'default',
        runtime: answers.runtime,
        agent: answers.agent,
        workspace: 'local',
        options: {},
      },
    ],
    commander: {
      github: answers.githubRepo,
      localPath: answers.localPath,
      branch: answers.branch,
      port: answers.port,
      autoFixCi: answers.autoFixCi,
      autoReviewComments: answers.autoReviewComments,
    },
  };
  return toYaml(doc);
}

async function detectBranch(): Promise<string> {
  try {
    const { stdout } = await execa('git', ['symbolic-ref', '--short', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'main';
  }
}

export async function runInitWizard(cwd: string): Promise<InitAnswers> {
  const folderName = path.basename(cwd);
  const branch = await detectBranch();

  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: 'input',
      name: 'projectId',
      message: 'Project ID',
      default: folderName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      validate: (v: string) =>
        /^[a-z0-9-]+$/.test(v) || 'Only lowercase letters, numbers, and hyphens allowed',
    },
    {
      type: 'input',
      name: 'githubRepo',
      message: 'GitHub repo (owner/repo)',
      validate: (v: string) =>
        /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(v) || 'Must be in owner/repo format',
    },
    {
      type: 'input',
      name: 'localPath',
      message: 'Local path',
      default: cwd,
      validate: async (v: string) => {
        try {
          await access(v);
          return true;
        } catch {
          return `Directory does not exist: ${v}`;
        }
      },
    },
    {
      type: 'input',
      name: 'branch',
      message: 'Default branch',
      default: branch,
    },
    {
      type: 'list',
      name: 'agent',
      message: 'Agent',
      choices: ['claude-code', 'codex'],
      default: 'claude-code',
    },
    {
      type: 'list',
      name: 'runtime',
      message: 'Runtime',
      choices: ['tmux', 'process'],
      default: 'tmux',
    },
    {
      type: 'number',
      name: 'port',
      message: 'Port',
      default: 3000,
    },
    {
      type: 'confirm',
      name: 'autoFixCi',
      message: 'Auto-fix CI failures?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'autoReviewComments',
      message: 'Auto-address review comments?',
      default: true,
    },
  ]);

  return answers;
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Interactive wizard to create commander.config.yaml')
    .action(async () => {
      try {
        const cwd = process.cwd();
        const answers = await runInitWizard(cwd);
        const yaml = buildConfigYaml(answers);
        const configPath = path.join(cwd, CONFIG_FILE);

        await writeFile(configPath, yaml, 'utf8');
        await loadConfig(cwd);

        console.log(chalk.green(`✓ ${CONFIG_FILE} created`));
        console.log(chalk.dim('Next: commander deploy'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), msg);
        process.exit(1);
      }
    });
}
