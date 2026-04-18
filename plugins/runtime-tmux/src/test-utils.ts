import type { ExecaFn, ExecaResult } from '@devfleet/core';

export interface RecordedCall {
  file: string;
  args: readonly string[];
}

export interface MockExeca {
  execa: ExecaFn;
  calls: RecordedCall[];
}

/**
 * Build a mock execa whose response is chosen by matching the joined argv
 * string against keys in `responses`. The first matching prefix wins. Use
 * `__throw:` prefixed values to simulate execa failures.
 */
export function mockExeca(responses: Map<string, string>): MockExeca {
  const calls: RecordedCall[] = [];
  const execa: ExecaFn = async (file, args) => {
    calls.push({ file, args });
    const argv = [file, ...args].join(' ');
    for (const [pattern, response] of responses) {
      if (argv.includes(pattern)) {
        if (response.startsWith('__throw:')) {
          throw new Error(response.slice('__throw:'.length));
        }
        const result: ExecaResult = { stdout: response, stderr: '', exitCode: 0 };
        return result;
      }
    }
    return { stdout: '', stderr: '', exitCode: 0 };
  };
  return { execa, calls };
}
