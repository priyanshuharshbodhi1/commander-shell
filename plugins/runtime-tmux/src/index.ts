import type {
  ExecaFn,
  PluginDescriptor,
  RuntimePlugin,
  RuntimeStartOpts,
  Session,
} from '@devfleet/core';

const PREFIX = 'devfleet-';

export class TmuxRuntime implements RuntimePlugin {
  constructor(private readonly execa: ExecaFn) {}

  async start(session: Session, command: string, opts: RuntimeStartOpts = {}): Promise<void> {
    const name = sessionName(session.id);
    const cwd = opts.cwd ?? session.workspacePath;
    if (!cwd) {
      throw new Error(`[tmux] start needs cwd or session.workspacePath for session ${session.id}`);
    }
    try {
      await this.execa('tmux', ['new-session', '-d', '-s', name, '-c', cwd]);
      await this.execa('tmux', ['send-keys', '-t', name, command, 'Enter']);
    } catch (err) {
      throw new Error(`[tmux] Failed to start session ${session.id}: ${(err as Error).message}`);
    }
  }

  async stop(sessionId: string): Promise<void> {
    try {
      await this.execa('tmux', ['kill-session', '-t', sessionName(sessionId)]);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('no server running') || msg.includes("can't find session")) return;
      throw new Error(`[tmux] Failed to stop session ${sessionId}: ${msg}`);
    }
  }

  async send(sessionId: string, message: string): Promise<void> {
    try {
      await this.execa('tmux', ['send-keys', '-t', sessionName(sessionId), message, 'Enter']);
    } catch (err) {
      throw new Error(`[tmux] Failed to send to session ${sessionId}: ${(err as Error).message}`);
    }
  }

  async isRunning(sessionId: string): Promise<boolean> {
    try {
      const r = await this.execa('tmux', ['has-session', '-t', sessionName(sessionId)]);
      return r.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getOutput(sessionId: string, lines = 50): Promise<string> {
    try {
      const r = await this.execa('tmux', [
        'capture-pane',
        '-t',
        sessionName(sessionId),
        '-p',
        '-S',
        String(-lines),
      ]);
      return r.stdout;
    } catch (err) {
      throw new Error(`[tmux] Failed to capture output for session ${sessionId}: ${(err as Error).message}`);
    }
  }

  async list(): Promise<string[]> {
    try {
      const r = await this.execa('tmux', ['list-sessions', '-F', '#{session_name}']);
      return r.stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith(PREFIX))
        .map((l) => l.slice(PREFIX.length));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('no server running')) return [];
      throw new Error(`[tmux] Failed to list sessions: ${msg}`);
    }
  }
}

function sessionName(id: string): string {
  return `${PREFIX}${id}`;
}

const descriptor: PluginDescriptor<'runtime', RuntimePlugin> = {
  kind: 'runtime',
  name: 'tmux',
  version: '0.1.0',
  create: async (options) => {
    const injected = (options as { execa?: ExecaFn }).execa;
    if (injected) return new TmuxRuntime(injected);
    const mod = (await import('execa')) as unknown as { execa: ExecaFn };
    return new TmuxRuntime(mod.execa);
  },
};

export default descriptor;
