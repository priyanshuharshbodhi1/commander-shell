import ora from 'ora';

export async function withSpinner<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const spinner = ora(label).start();
  try {
    const result = await fn();
    spinner.succeed(label);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.fail(msg);
    throw err;
  }
}
