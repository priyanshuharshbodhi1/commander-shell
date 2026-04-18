import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { FleetConfig } from './types.js';

const pluginKindSchema = z.enum([
  'runtime',
  'agent',
  'workspace',
  'tracker',
  'scm',
  'notifier',
]);

const pluginRefSchema = z.object({
  kind: pluginKindSchema,
  name: z.string().min(1),
  id: z.string().min(1),
  options: z.record(z.unknown()).default({}),
});

const agentDeclSchema = z.object({
  id: z.string().min(1),
  runtime: z.string().min(1),
  agent: z.string().min(1),
  workspace: z.string().min(1),
  tracker: z.string().optional(),
  scm: z.string().optional(),
  notifier: z.string().optional(),
  options: z.record(z.unknown()).default({}),
});

const fleetConfigSchema = z.object({
  fleet: z.object({
    name: z.string().min(1),
    dataRoot: z.string().min(1),
  }),
  plugins: z.array(pluginRefSchema).default([]),
  agents: z.array(agentDeclSchema).default([]),
});

/** Error thrown when a fleet config fails to parse or validate. */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly issues: readonly string[] = [],
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Parse a fleet config YAML string into a validated {@link FleetConfig}.
 * @param yaml   raw YAML text
 * @param source a label for error messages (usually the file path)
 */
export function parseConfig(yaml: string, source = '<inline>'): FleetConfig {
  let raw: unknown;
  try {
    raw = parseYaml(yaml);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to parse YAML in ${source}: ${msg}`, source);
  }

  if (raw === null || typeof raw !== 'object') {
    throw new ConfigError(
      `Config in ${source} must be a YAML mapping, got ${raw === null ? 'null' : typeof raw}`,
      source,
    );
  }

  const result = fleetConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`,
    );
    throw new ConfigError(
      `Invalid fleet config in ${source}:\n${issues.join('\n')}`,
      source,
      issues,
    );
  }

  validateReferentialIntegrity(result.data, source);
  return result.data;
}

/** Enforce that every agent names plugin ids that were declared in `plugins`. */
function validateReferentialIntegrity(config: FleetConfig, source: string): void {
  const byKind = new Map<string, Set<string>>();
  for (const p of config.plugins) {
    let set = byKind.get(p.kind);
    if (!set) {
      set = new Set();
      byKind.set(p.kind, set);
    }
    set.add(p.id);
  }

  const issues: string[] = [];
  for (const a of config.agents) {
    const slots: Array<[string, string | undefined]> = [
      ['runtime', a.runtime],
      ['agent', a.agent],
      ['workspace', a.workspace],
      ['tracker', a.tracker],
      ['scm', a.scm],
      ['notifier', a.notifier],
    ];
    for (const [kind, id] of slots) {
      if (!id) continue;
      if (!byKind.get(kind)?.has(id)) {
        issues.push(
          `  - agents.${a.id}.${kind}: references ${kind} plugin id "${id}" which is not declared in plugins`,
        );
      }
    }
  }

  if (issues.length > 0) {
    throw new ConfigError(
      `Invalid fleet config in ${source}:\n${issues.join('\n')}`,
      source,
      issues,
    );
  }
}
