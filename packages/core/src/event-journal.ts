import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FleetSignal, FleetSignalType, JournalEntry } from './types.js';

/**
 * Append-only JSONL log of every signal the fleet has ever emitted. Journal
 * lives at `<dataRoot>/journal.jsonl`. Writes are serialized through a promise
 * chain so sequence numbers stay monotonic.
 */
export class EventJournal {
  private readonly file: string;
  private seq = 0;
  private tail: Promise<void> = Promise.resolve();
  private initialized = false;

  constructor(dataRoot: string) {
    this.file = path.join(dataRoot, 'journal.jsonl');
  }

  /** Ensure the journal file exists and seed the sequence from prior contents. */
  async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      const existing = await readFile(this.file, 'utf8');
      const lines = existing.split('\n').filter((l) => l.length > 0);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as JournalEntry;
          if (typeof parsed.seq === 'number' && parsed.seq > this.seq) {
            this.seq = parsed.seq;
          }
        } catch {
          // Tolerate a torn last line.
        }
      }
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
    this.initialized = true;
  }

  /** Append one signal to the journal. Resolves once the line is flushed. */
  record(signal: FleetSignal): Promise<JournalEntry> {
    const write = async (): Promise<JournalEntry> => {
      if (!this.initialized) await this.init();
      this.seq += 1;
      const entry: JournalEntry = {
        seq: this.seq,
        at: new Date().toISOString(),
        signal,
      };
      await appendFile(this.file, JSON.stringify(entry) + '\n', 'utf8');
      return entry;
    };
    const next = this.tail.then(write, write);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  /**
   * Replay the journal. Filter is optional; if provided, only signals whose
   * type matches one of the listed types are yielded.
   */
  async *replay(filter?: readonly FleetSignalType[]): AsyncIterable<JournalEntry> {
    if (!this.initialized) await this.init();
    let contents: string;
    try {
      contents = await readFile(this.file, 'utf8');
    } catch (err) {
      if (isNotFound(err)) return;
      throw err;
    }
    const allow = filter ? new Set<FleetSignalType>(filter) : null;
    for (const line of contents.split('\n')) {
      if (line.length === 0) continue;
      let entry: JournalEntry;
      try {
        entry = JSON.parse(line) as JournalEntry;
      } catch {
        continue;
      }
      if (allow && !allow.has(entry.signal.type)) continue;
      yield entry;
    }
  }

  /** Read every entry into memory. Convenience wrapper around {@link replay}. */
  async readAll(filter?: readonly FleetSignalType[]): Promise<JournalEntry[]> {
    const out: JournalEntry[] = [];
    for await (const e of this.replay(filter)) out.push(e);
    return out;
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
