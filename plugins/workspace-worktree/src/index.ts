import path from 'node:path';
import type {
  ExecaFn,
  PluginDescriptor,
  Project,
  WorkspaceInfo,
  WorkspacePlugin,
} from '@devfleet/core';

export const WORKTREES_DIR = 'devfleet-worktrees';

export interface FsOps {
  mkdirSync(dir: string, opts?: { recursive?: boolean }): void;
  rmSync(dir: string, opts?: { recursive?: boolean; force?: boolean }): void;
}

export class WorktreeWorkspace implements WorkspacePlugin {
  constructor(
    private readonly execa: ExecaFn,
    private readonly fs: FsOps,
  ) {}

  async create(project: Project, branch: string): Promise<WorkspaceInfo> {
    const safeBranch = branch.replace(/\//g, '-');
    const worktreePath = path.join(project.path, '..', WORKTREES_DIR, project.id, safeBranch);
    const parentDir = path.dirname(worktreePath);

    try {
      this.fs.mkdirSync(parentDir, { recursive: true });
    } catch (err) {
      throw new Error(`[worktree] Failed to create parent dir ${parentDir}: ${(err as Error).message}`);
    }

    const branchExists = await this.branchExists(project.path, branch);
    if (!branchExists) {
      try {
        await this.execa('git', ['branch', branch, project.defaultBranch], { cwd: project.path });
      } catch (err) {
        throw new Error(
          `[worktree] Failed to create branch ${branch} from ${project.defaultBranch}: ${(err as Error).message}`,
        );
      }
    }

    try {
      await this.execa('git', ['worktree', 'add', worktreePath, branch], { cwd: project.path });
    } catch (err) {
      throw new Error(
        `[worktree] Failed to add worktree at ${worktreePath} for branch ${branch}: ${(err as Error).message}`,
      );
    }

    return { path: worktreePath, branch, isClean: true };
  }

  async remove(workspacePath: string): Promise<void> {
    try {
      await this.execa('git', ['worktree', 'remove', '--force', workspacePath], {
        cwd: workspacePath,
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.includes('is not a working tree') && !msg.includes('No such file')) {
        throw new Error(`[worktree] Failed to remove worktree ${workspacePath}: ${msg}`);
      }
    }
    try {
      this.fs.rmSync(workspacePath, { recursive: true, force: true });
    } catch (err) {
      throw new Error(`[worktree] Failed to rmSync ${workspacePath}: ${(err as Error).message}`);
    }
  }

  async list(project: Project): Promise<WorkspaceInfo[]> {
    let stdout: string;
    try {
      const r = await this.execa('git', ['worktree', 'list', '--porcelain'], { cwd: project.path });
      stdout = r.stdout;
    } catch (err) {
      throw new Error(`[worktree] Failed to list worktrees: ${(err as Error).message}`);
    }
    return parsePorcelain(stdout).filter((w) => w.path.includes(WORKTREES_DIR));
  }

  private async branchExists(repoPath: string, branch: string): Promise<boolean> {
    try {
      const r = await this.execa('git', ['show-ref', '--verify', `refs/heads/${branch}`], {
        cwd: repoPath,
      });
      return r.exitCode === 0;
    } catch {
      return false;
    }
  }
}

interface ParsedBlock {
  worktree?: string;
  branch?: string;
}

export function parsePorcelain(stdout: string): WorkspaceInfo[] {
  const blocks: ParsedBlock[] = [];
  let current: ParsedBlock = {};
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trimEnd();
    if (line === '') {
      if (current.worktree) blocks.push(current);
      current = {};
      continue;
    }
    if (line.startsWith('worktree ')) current.worktree = line.slice('worktree '.length);
    else if (line.startsWith('branch ')) {
      const ref = line.slice('branch '.length);
      current.branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
    }
  }
  if (current.worktree) blocks.push(current);
  return blocks
    .filter((b): b is { worktree: string; branch?: string } => Boolean(b.worktree))
    .map((b) => ({ path: b.worktree, branch: b.branch ?? '(detached)', isClean: true }));
}

const descriptor: PluginDescriptor<'workspace', WorkspacePlugin> = {
  kind: 'workspace',
  name: 'worktree',
  version: '0.1.0',
  create: async (options) => {
    const opts = options as { execa?: ExecaFn; fs?: FsOps };
    const fsImpl: FsOps =
      opts.fs ??
      (await import('node:fs').then((m) => ({
        mkdirSync: m.mkdirSync,
        rmSync: m.rmSync,
      })));
    let execaImpl = opts.execa;
    if (!execaImpl) {
      const mod = (await import('execa')) as unknown as { execa: ExecaFn };
      execaImpl = mod.execa;
    }
    return new WorktreeWorkspace(execaImpl, fsImpl);
  },
};

export default descriptor;
