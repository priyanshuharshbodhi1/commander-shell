/**
 * Core domain types for commander. Everything in the system is expressed in
 * these terms: plugins produce capabilities, fleets compose plugins, sessions
 * track running work, signals move state, journal entries record history.
 */

/** The six plugin capability kinds commander supports. */
export type PluginKind =
  | 'runtime'
  | 'agent'
  | 'workspace'
  | 'tracker'
  | 'scm'
  | 'notifier';

/** A parsed fleet config. Validated by {@link parseConfig}. */
export interface FleetConfig {
  fleet: {
    name: string;
    dataRoot: string;
  };
  plugins: PluginRef[];
  agents: AgentDecl[];
}

/** Reference to a plugin the fleet should load. */
export interface PluginRef {
  kind: PluginKind;
  name: string;
  id: string;
  options: Record<string, unknown>;
}

/** Declaration of one agent slot in the fleet. */
export interface AgentDecl {
  id: string;
  runtime: string;
  agent: string;
  workspace: string;
  tracker?: string;
  scm?: string;
  notifier?: string;
  options: Record<string, unknown>;
}

/** One running or completed unit of agent work. */
export interface Session {
  id: string;
  agentId: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  task?: {
    title: string;
    source: string;
    externalId?: string;
  };
  workspacePath?: string;
  metadata: Record<string, unknown>;
}

export type SessionStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'done'
  | 'failed'
  | 'cancelled';

/** A typed signal on the fleet bus. Payload shape is keyed on `type`. */
export type FleetSignal =
  | { type: 'session.created'; sessionId: string; agentId: string }
  | { type: 'session.status'; sessionId: string; status: SessionStatus }
  | { type: 'session.output'; sessionId: string; stream: 'stdout' | 'stderr'; chunk: string }
  | { type: 'session.reaction'; sessionId: string; source: string; payload: unknown }
  | { type: 'plugin.ready'; kind: PluginKind; id: string }
  | { type: 'plugin.error'; kind: PluginKind; id: string; error: string };

export type FleetSignalType = FleetSignal['type'];

/** One line in the event journal. Journal is append-only JSONL. */
export interface JournalEntry {
  seq: number;
  at: string;
  signal: FleetSignal;
}

/** Minimal shape every plugin descriptor must export. */
export interface PluginDescriptor<Kind extends PluginKind = PluginKind, Instance = unknown> {
  kind: Kind;
  name: string;
  version: string;
  create(options: Record<string, unknown>): Instance | Promise<Instance>;
}
