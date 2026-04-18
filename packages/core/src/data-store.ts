import { mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Session } from './types.js';

/**
 * File-backed store for session state. One JSON file per session under
 * `<dataRoot>/sessions/<sessionId>.json`. Simple on purpose — the journal is
 * the source of truth for history; this is just the current snapshot.
 */
export class DataStore {
  constructor(private readonly dataRoot: string) {}

  private sessionsDir(): string {
    return path.join(this.dataRoot, 'sessions');
  }

  private sessionFile(id: string): string {
    return path.join(this.sessionsDir(), `${id}.json`);
  }

  /** Ensure the data root layout exists on disk. Safe to call repeatedly. */
  async init(): Promise<void> {
    await mkdir(this.sessionsDir(), { recursive: true });
  }

  /** Persist a session snapshot, overwriting any prior version. */
  async saveSession(session: Session): Promise<void> {
    await this.init();
    const next: Session = { ...session, updatedAt: new Date().toISOString() };
    await writeFile(this.sessionFile(session.id), JSON.stringify(next, null, 2), 'utf8');
  }

  /** Load one session by id, or null if absent. */
  async readSession(id: string): Promise<Session | null> {
    try {
      const raw = await readFile(this.sessionFile(id), 'utf8');
      return JSON.parse(raw) as Session;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /** List all session ids on disk. */
  async listSessions(): Promise<Session[]> {
    try {
      const entries = await readdir(this.sessionsDir());
      const sessions: Session[] = [];
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const id = entry.slice(0, -'.json'.length);
        const s = await this.readSession(id);
        if (s) sessions.push(s);
      }
      return sessions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  /** Remove one session file. Returns true if something was deleted. */
  async deleteSession(id: string): Promise<boolean> {
    try {
      await rm(this.sessionFile(id));
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  );
}
