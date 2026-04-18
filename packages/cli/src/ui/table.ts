import Table from 'cli-table3';
import type { Session } from '@commander/core';
import { STATUS_COLORS } from './colors.js';

export function relativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function renderFleetTable(sessions: Session[]): string {
  const table = new Table({
    head: ['SESSION', 'PROJECT', 'ISSUE', 'STATUS', 'BRANCH', 'UPDATED'],
    style: { head: ['cyan'] },
  });

  for (const s of sessions) {
    const colorFn = STATUS_COLORS[s.status] ?? ((v: string) => v);
    table.push([
      s.id,
      s.agentId,
      s.task?.title ?? '-',
      colorFn(s.status),
      (s.metadata['branch'] as string | undefined) ?? '-',
      relativeTime(s.updatedAt),
    ]);
  }

  return table.toString();
}
