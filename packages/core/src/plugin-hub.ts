import type { PluginDescriptor, PluginKind } from './types.js';

/** Thrown when a requested plugin is not registered. */
export class PluginNotFoundError extends Error {
  constructor(kind: PluginKind, name: string) {
    super(`No ${kind} plugin registered under name "${name}"`);
    this.name = 'PluginNotFoundError';
  }
}

/** Thrown when two plugins claim the same (kind, name) pair. */
export class PluginConflictError extends Error {
  constructor(kind: PluginKind, name: string) {
    super(`A ${kind} plugin named "${name}" is already registered`);
    this.name = 'PluginConflictError';
  }
}

/**
 * In-memory registry of plugin descriptors, keyed by (kind, name).
 * Later phases will feed this from dynamic imports; phase 1 only needs the
 * registry itself plus resolution.
 */
export class PluginHub {
  private readonly byKey = new Map<string, PluginDescriptor>();

  /** Register a descriptor. Rejects duplicates. */
  register(descriptor: PluginDescriptor): void {
    const key = keyOf(descriptor.kind, descriptor.name);
    if (this.byKey.has(key)) {
      throw new PluginConflictError(descriptor.kind, descriptor.name);
    }
    this.byKey.set(key, descriptor);
  }

  /** Look up a descriptor, throwing if absent. */
  resolve<K extends PluginKind>(kind: K, name: string): PluginDescriptor<K> {
    const found = this.byKey.get(keyOf(kind, name));
    if (!found) throw new PluginNotFoundError(kind, name);
    return found as PluginDescriptor<K>;
  }

  /** Soft lookup — returns undefined instead of throwing. */
  find<K extends PluginKind>(kind: K, name: string): PluginDescriptor<K> | undefined {
    return this.byKey.get(keyOf(kind, name)) as PluginDescriptor<K> | undefined;
  }

  /** All registered descriptors, grouped by kind. */
  catalog(): Record<PluginKind, PluginDescriptor[]> {
    const out: Record<PluginKind, PluginDescriptor[]> = {
      runtime: [],
      agent: [],
      workspace: [],
      tracker: [],
      scm: [],
      notifier: [],
    };
    for (const d of this.byKey.values()) out[d.kind].push(d);
    return out;
  }

  /** Remove a descriptor. Used mostly for tests / reloads. */
  unregister(kind: PluginKind, name: string): boolean {
    return this.byKey.delete(keyOf(kind, name));
  }
}

function keyOf(kind: PluginKind, name: string): string {
  return `${kind}::${name}`;
}
