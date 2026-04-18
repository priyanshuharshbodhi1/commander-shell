/**
 * Phase 1 stub for the commander dashboard. Real implementation (Next.js 15,
 * React 19, Tailwind v4, Kanban + xterm.js) lands in phase 5.
 */
import { PluginHub } from '@commander/core';

export function describe(): string {
  const hub = new PluginHub();
  const total = Object.values(hub.catalog()).reduce((n, xs) => n + xs.length, 0);
  return `@commander/web stub: ${total} plugins known — dashboard arrives in phase 5.`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(describe() + '\n');
}
