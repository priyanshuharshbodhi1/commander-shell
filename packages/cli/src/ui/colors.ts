import chalk from 'chalk';
import type { SessionStatus } from '@commander/core';

export const STATUS_COLORS: Record<SessionStatus, (s: string) => string> = {
  pending:   chalk.blue,
  running:   chalk.green,
  waiting:   chalk.yellow,
  done:      chalk.gray,
  failed:    chalk.red,
  cancelled: chalk.gray,
};
