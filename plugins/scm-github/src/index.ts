import type {
  CICheck,
  CICheckState,
  CIOverallState,
  CIStatus,
  CreatePROpts,
  ExecaFn,
  PluginDescriptor,
  PRData,
  PRState,
  ReviewComment,
  ReviewState,
  SCMPlugin,
} from '@commander/core';

interface GhCheckRun {
  name: string;
  status: string;
  conclusion: string | null;
  html_url?: string;
}

interface GhPRView {
  number: number;
  url: string;
  state: string;
  title: string;
  statusCheckRollup?: GhCheckRun[];
  reviews?: { state: string }[];
}

interface GhCommentRaw {
  id: number;
  user: string | { login: string };
  body: string;
  path?: string;
  line?: number | null;
  original_line?: number | null;
  created_at: string;
}

export class GitHubSCM implements SCMPlugin {
  constructor(private readonly execa: ExecaFn) {}

  async createPR(opts: CreatePROpts): Promise<PRData> {
    const args = [
      'pr',
      'create',
      '--repo',
      opts.repo,
      '--head',
      opts.head,
      '--base',
      opts.base,
      '--title',
      opts.title,
      '--body',
      opts.body,
    ];
    if (opts.draft) args.push('--draft');

    let url: string;
    try {
      const r = await this.execa('gh', args);
      url = r.stdout.trim().split('\n').pop() ?? '';
      if (!url.startsWith('http')) {
        throw new Error(`gh did not return a PR URL (got ${JSON.stringify(r.stdout)})`);
      }
    } catch (err) {
      throw new Error(`[github] Failed to create PR on ${opts.repo}: ${(err as Error).message}`);
    }

    let number: number;
    try {
      const r = await this.execa('gh', ['pr', 'view', url, '--json', 'number', '--jq', '.number']);
      number = Number.parseInt(r.stdout.trim(), 10);
      if (Number.isNaN(number)) throw new Error(`unable to parse PR number from "${r.stdout}"`);
    } catch (err) {
      throw new Error(`[github] Failed to read PR number for ${url}: ${(err as Error).message}`);
    }

    return {
      number,
      url,
      state: opts.draft ? 'draft' : 'open',
      title: opts.title,
    };
  }

  async getPRStatus(repo: string, prNumber: number): Promise<PRData> {
    let raw: GhPRView;
    try {
      const r = await this.execa('gh', [
        'pr',
        'view',
        String(prNumber),
        '--repo',
        repo,
        '--json',
        'number,url,state,title,statusCheckRollup,reviews',
      ]);
      raw = JSON.parse(r.stdout) as GhPRView;
    } catch (err) {
      throw new Error(
        `[github] Failed to read PR status for ${repo}#${prNumber}: ${(err as Error).message}`,
      );
    }

    const checks: CICheck[] = (raw.statusCheckRollup ?? []).map((c) => ({
      name: c.name,
      state: mapCheckState(c.status, c.conclusion),
      ...(c.html_url ? { url: c.html_url } : {}),
    }));
    const ci: CIStatus = { state: rollupState(checks), checks };

    return {
      number: raw.number,
      url: raw.url,
      state: mapPRState(raw.state),
      title: raw.title,
      ci,
      reviewState: latestReviewState(raw.reviews ?? []),
    };
  }

  async getCIStatus(repo: string, ref: string): Promise<CIStatus> {
    let stdout: string;
    try {
      const r = await this.execa('gh', [
        'api',
        `repos/${repo}/commits/${ref}/check-runs`,
        '--jq',
        '.check_runs[] | {name, status, conclusion, html_url}',
      ]);
      stdout = r.stdout;
    } catch (err) {
      throw new Error(
        `[github] Failed to read CI status for ${repo}@${ref}: ${(err as Error).message}`,
      );
    }
    const checks: CICheck[] = parseJsonl<GhCheckRun>(stdout).map((c) => ({
      name: c.name,
      state: mapCheckState(c.status, c.conclusion),
      ...(c.html_url ? { url: c.html_url } : {}),
    }));
    return { state: rollupState(checks), checks };
  }

  async getReviewComments(repo: string, prNumber: number): Promise<ReviewComment[]> {
    let stdout: string;
    try {
      const r = await this.execa('gh', [
        'api',
        `repos/${repo}/pulls/${prNumber}/comments`,
        '--jq',
        '.[] | {id, user: .user.login, body, path, line: .original_line, created_at}',
      ]);
      stdout = r.stdout;
    } catch (err) {
      throw new Error(
        `[github] Failed to read review comments for ${repo}#${prNumber}: ${(err as Error).message}`,
      );
    }
    return parseJsonl<GhCommentRaw>(stdout).map((c) => {
      const user = typeof c.user === 'string' ? c.user : c.user.login;
      const line = c.line ?? c.original_line ?? undefined;
      return {
        id: c.id,
        user,
        body: c.body,
        ...(c.path ? { path: c.path } : {}),
        ...(line !== undefined && line !== null ? { line } : {}),
        createdAt: c.created_at,
      };
    });
  }
}

function parseJsonl<T>(stdout: string): T[] {
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as T);
}

function mapCheckState(status: string, conclusion: string | null): CICheckState {
  if (status !== 'completed') return 'pending';
  switch ((conclusion ?? '').toLowerCase()) {
    case 'success':
      return 'success';
    case 'failure':
    case 'timed_out':
    case 'action_required':
      return 'failure';
    case 'cancelled':
      return 'cancelled';
    case 'skipped':
    case 'neutral':
      return 'skipped';
    default:
      return 'pending';
  }
}

function rollupState(checks: CICheck[]): CIOverallState {
  if (checks.length === 0) return 'success';
  if (checks.some((c) => c.state === 'failure' || c.state === 'cancelled')) return 'failure';
  if (checks.some((c) => c.state === 'pending')) return 'pending';
  return 'success';
}

function mapPRState(state: string): PRState {
  switch (state.toUpperCase()) {
    case 'OPEN':
      return 'open';
    case 'CLOSED':
      return 'closed';
    case 'MERGED':
      return 'merged';
    case 'DRAFT':
      return 'draft';
    default:
      return 'open';
  }
}

function latestReviewState(reviews: { state: string }[]): ReviewState | undefined {
  if (reviews.length === 0) return undefined;
  const last = reviews[reviews.length - 1]!.state.toUpperCase();
  switch (last) {
    case 'APPROVED':
      return 'approved';
    case 'CHANGES_REQUESTED':
      return 'changes_requested';
    case 'COMMENTED':
      return 'commented';
    default:
      return 'pending';
  }
}

const descriptor: PluginDescriptor<'scm', SCMPlugin> = {
  kind: 'scm',
  name: 'github',
  version: '0.1.0',
  create: async (options) => {
    const injected = (options as { execa?: ExecaFn }).execa;
    if (injected) return new GitHubSCM(injected);
    const mod = (await import('execa')) as unknown as { execa: ExecaFn };
    return new GitHubSCM(mod.execa);
  },
};

export default descriptor;
