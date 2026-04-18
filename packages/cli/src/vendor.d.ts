declare module 'inquirer' {
  export interface QuestionBase {
    type?: string;
    name: string;
    message: string;
    default?: unknown;
    choices?: string[];
    validate?: (v: string) => boolean | string | Promise<boolean | string>;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function prompt<T = Record<string, any>>(questions: QuestionBase[]): Promise<T>;
  const inquirer: { prompt: typeof prompt };
  export default inquirer;
}
