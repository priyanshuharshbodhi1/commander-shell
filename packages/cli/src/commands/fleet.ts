import { Command } from 'commander';
import chalk from 'chalk';
import { DataStore } from '@commander/core';
import type { Session, SessionStatus } from '@commander/core';
import os from 'node:os';
import path from 'node:path';
import { renderFleetTable } from '../ui/table.js';

export function registerFleet(program: Command): void {
  program
    .command('fleet')
    .description('List active agent sessions')
    .option('--project <id>', 'Filter by project (agentId)')
    .option('--status <status>', 'Filter by session status')
    .option('--json', 'Output raw JSON without decorations')
    .action(async (opts: { project?: string; status?: string; json?: boolean }) => {
      try {
        const dataRoot = path.join(os.homedir(), '.commander');
        const store = new DataStore(dataRoot);
        let sessions: Session[] = await store.listSessions();

        if (opts.project) {
          sessions = sessions.filter((s) => s.agentId === opts.project);
        }
        if (opts.status) {
          sessions = sessions.filter((s) => s.status === (opts.status as SessionStatus));
        }

        if (opts.json) {
          console.log(JSON.stringify(sessions, null, 2));
          return;
        }

        if (sessions.length === 0) {
          console.log(chalk.dim('No active agents. Run commander spawn <project> <issue>'));
          return;
        }

        console.log(renderFleetTable(sessions));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), msg);
        process.exit(1);
      }
    });
}
