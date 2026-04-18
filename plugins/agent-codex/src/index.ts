import type {
  AgentCommandOpts,
  AgentPlugin,
  Issue,
  PluginDescriptor,
  Project,
} from '@commander/core';

function shellQuote(value: string): string {
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

export class CodexAgent implements AgentPlugin {
  buildCommand(opts: AgentCommandOpts): string {
    const parts = ['codex', shellQuote(opts.prompt)];
    if (opts.model) parts.push('--model', opts.model);
    return parts.join(' ');
  }

  buildPrompt(issue: Issue, project: Project): string {
    return [
      `You are working on issue #${issue.id}: ${issue.title}`,
      `Repository: ${project.repo}`,
      `Branch: commander/${project.id}/issue-${issue.id}`,
      ``,
      `Issue description:`,
      issue.body,
      ``,
      `Instructions:`,
      `- Read the codebase, understand the context`,
      `- Implement the required changes`,
      `- Write or update tests`,
      `- Commit your work with a clear message`,
      `- Do not push — the orchestrator handles that`,
    ].join('\n');
  }
}

const descriptor: PluginDescriptor<'agent', AgentPlugin> = {
  kind: 'agent',
  name: 'codex',
  version: '0.1.0',
  create: () => new CodexAgent(),
};

export default descriptor;
