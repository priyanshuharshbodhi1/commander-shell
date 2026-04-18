/** Public entry point for @devfleet/core. Phase 1. */

export type {
  PluginKind,
  PluginRef,
  PluginDescriptor,
  AgentDecl,
  FleetConfig,
  Session,
  SessionStatus,
  FleetSignal,
  FleetSignalType,
  JournalEntry,
} from './types.js';

export { parseConfig, ConfigError } from './config.js';
export { PluginHub, PluginNotFoundError, PluginConflictError } from './plugin-hub.js';
export { DataStore } from './data-store.js';
export { FleetEmitter, type Unsubscribe } from './fleet-emitter.js';
export { EventJournal } from './event-journal.js';
