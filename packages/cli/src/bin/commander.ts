#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { registerInit } from '../commands/init.js';
import { registerDeploy } from '../commands/deploy.js';
import { registerFleet } from '../commands/fleet.js';
import { registerHealth } from '../commands/health.js';

const program = new Command();

program
  .name('commander')
  .description('Commander — agentic infrastructure for parallel AI coding agents')
  .version('0.1.0');

registerInit(program);
registerDeploy(program);
registerFleet(program);
registerHealth(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(chalk.red('Error:'), msg);
  process.exit(1);
});
