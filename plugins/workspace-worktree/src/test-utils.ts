import type { ExecaFn, ExecaResult } from '@devfleet/core';
import type { FsOps } from './index.js';

export interface RecordedCall {
  file: string;
  args: readonly string[];
  cwd?: string;
}

export interface MockExeca {
  execa: ExecaFn;
  calls: RecordedCall[];
}

export function mockExeca(responses: Map<string, string | { stdout: string; exitCode: number }>): MockExeca {
  const calls: RecordedCall[] = [];
  const execa: ExecaFn = async (file, args, opts) => {
    calls.push({ file, args, cwd: opts?.cwd });
    const argv = [file, ...args].join(' ');
    for (const [pattern, response] of responses) {
      if (argv.includes(pattern)) {
        if (typeof response === 'string') {
          if (response.startsWith('__throw:')) throw new Error(response.slice('__throw:'.length));
          const result: ExecaResult = { stdout: response, stderr: '', exitCode: 0 };
          return result;
        }
        return { stdout: response.stdout, stderr: '', exitCode: response.exitCode };
      }
    }
    return { stdout: '', stderr: '', exitCode: 0 };
  };
  return { execa, calls };
}

export interface MockFs extends FsOps {
  mkdirCalls: string[];
  rmCalls: string[];
}

export function mockFs(): MockFs {
  const mkdirCalls: string[] = [];
  const rmCalls: string[] = [];
  return {
    mkdirCalls,
    rmCalls,
    mkdirSync(dir: string) {
      mkdirCalls.push(dir);
    },
    rmSync(dir: string) {
      rmCalls.push(dir);
    },
  };
}
