import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseConfig } from '@commander/core';
import type { FleetConfig } from '@commander/core';

export const CONFIG_FILE = 'commander.config.yaml';

export async function loadConfig(cwd = process.cwd()): Promise<FleetConfig> {
  const configPath = path.join(cwd, CONFIG_FILE);
  const raw = await readFile(configPath, 'utf8');
  return parseConfig(raw, configPath);
}
