/**
 * Instance-side contracts for each plugin kind. PluginDescriptor.create()
 * returns one of these shapes. Plugins live in separate packages but every
 * implementation conforms to one of the interfaces here.
 */

import type { Session } from './types.js';

export interface Project {
  id: string;
  repo: string;
  path: string;
  defaultBranch: string;
}

export interface Issue {
  id: string;
  title: string;
  body: string;
}

export interface RuntimeStartOpts {
  cwd?: string;
}

export interface RuntimePlugin {
  start(session: Session, command: string, opts?: RuntimeStartOpts): Promise<void>;
  stop(sessionId: string): Promise<void>;
  send(sessionId: string, message: string): Promise<void>;
  isRunning(sessionId: string): Promise<boolean>;
  getOutput(sessionId: string, lines?: number): Promise<string>;
  list(): Promise<string[]>;
}

export interface AgentCommandOpts {
  prompt: string;
  model?: string;
  allowedTools?: string[];
}

export interface AgentPlugin {
  buildCommand(opts: AgentCommandOpts): string;
  buildPrompt(issue: Issue, project: Project): string;
}

export interface WorkspaceInfo {
  path: string;
  branch: string;
  isClean: boolean;
}

export interface WorkspacePlugin {
  create(project: Project, branch: string): Promise<WorkspaceInfo>;
  remove(workspacePath: string): Promise<void>;
  list(project: Project): Promise<WorkspaceInfo[]>;
}

export type CICheckState = 'success' | 'failure' | 'pending' | 'skipped' | 'cancelled';
export type CIOverallState = 'success' | 'failure' | 'pending';
export type ReviewState = 'approved' | 'changes_requested' | 'commented' | 'pending';
export type PRState = 'open' | 'closed' | 'merged' | 'draft';

export interface CICheck {
  name: string;
  state: CICheckState;
  url?: string;
}

export interface CIStatus {
  state: CIOverallState;
  checks: CICheck[];
}

export interface ReviewComment {
  id: number;
  user: string;
  body: string;
  path?: string;
  line?: number;
  createdAt: string;
}

export interface PRData {
  number: number;
  url: string;
  state: PRState;
  title: string;
  ci?: CIStatus;
  reviewState?: ReviewState;
}

export interface CreatePROpts {
  repo: string;
  head: string;
  base: string;
  title: string;
  body: string;
  draft?: boolean;
}

export interface SCMPlugin {
  createPR(opts: CreatePROpts): Promise<PRData>;
  getPRStatus(repo: string, prNumber: number): Promise<PRData>;
  getCIStatus(repo: string, ref: string): Promise<CIStatus>;
  getReviewComments(repo: string, prNumber: number): Promise<ReviewComment[]>;
}

/**
 * Minimal subprocess shim. Plugins receive an execa-shaped function via
 * their descriptor's create() so tests can inject a stub.
 */
export interface ExecaResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type ExecaFn = (
  file: string,
  args: readonly string[],
  options?: { cwd?: string; reject?: boolean },
) => Promise<ExecaResult>;
